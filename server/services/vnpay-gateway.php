<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class VnpayGateway
{
    private const PAYMENT_URL = 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';

    public function __construct(private readonly array $config) {}

    public static function fromEnvironment(): self
    {
        return new self([
            'tmnCode' => trim((string) getenv('VNPAY_TMN_CODE')),
            'hashSecret' => (string) getenv('VNPAY_HASH_SECRET'),
            'returnUrl' => trim((string) getenv('VNPAY_RETURN_URL')),
            'ipnUrl' => trim((string) getenv('VNPAY_IPN_URL')),
        ]);
    }

    public function isConfigured(): bool
    {
        if (($this->config['tmnCode'] ?? '') === '' || ($this->config['hashSecret'] ?? '') === '' || !preg_match('/^[A-Za-z0-9]{1,20}$/D', $this->config['tmnCode'])) return false;
        return $this->isAllowedUrl((string) ($this->config['returnUrl'] ?? '')) && $this->isAllowedUrl((string) ($this->config['ipnUrl'] ?? ''));
    }

    public function requireConfigured(): void
    {
        if (!$this->isConfigured()) throw new ApiException(503, 'VNPAY_NOT_CONFIGURED', 'Thanh toán VNPay chưa được cấu hình đầy đủ. Vui lòng chọn COD hoặc thử lại sau.');
    }

    public function matchesMerchantCode(mixed $merchantCode): bool
    {
        return is_string($merchantCode) && hash_equals((string) $this->config['tmnCode'], $merchantCode);
    }

    // Build a short-lived Sandbox redirect from trusted order data; the secret stays server-side.
    public function createPaymentUrl(string $paymentCode, string $orderCode, int $amount, string $ipAddress, int $expiresAt): string
    {
        $this->requireConfigured();
        if ($amount < 1 || $amount > 9999999999) throw new ApiException(422, 'VNPAY_AMOUNT_UNSUPPORTED', 'Số tiền đơn hàng vượt giới hạn thanh toán VNPay.');
        if (!filter_var($ipAddress, FILTER_VALIDATE_IP)) $ipAddress = '127.0.0.1';
        $zone = new \DateTimeZone('Asia/Ho_Chi_Minh');
        $now = new \DateTimeImmutable('now', $zone);
        $expires = (new \DateTimeImmutable('@' . $expiresAt))->setTimezone($zone);
        if ($expires <= $now || $expires > $now->modify('+16 minutes')) throw new \LogicException('Invalid VNPay expiration time.');
        $parameters = [
            'vnp_Version' => '2.1.0',
            'vnp_Command' => 'pay',
            'vnp_TmnCode' => $this->config['tmnCode'],
            'vnp_Amount' => (string) ($amount * 100),
            'vnp_CurrCode' => 'VND',
            'vnp_TxnRef' => $paymentCode,
            'vnp_OrderInfo' => 'Thanh toan don hang ' . $orderCode,
            'vnp_OrderType' => 'other',
            'vnp_Locale' => 'vn',
            'vnp_ReturnUrl' => $this->config['returnUrl'],
            'vnp_IpAddr' => $ipAddress,
            'vnp_CreateDate' => $now->format('YmdHis'),
            'vnp_ExpireDate' => $expires->format('YmdHis'),
        ];
        $parameters['vnp_SecureHash'] = $this->signature($parameters);
        return self::PAYMENT_URL . '?' . http_build_query($parameters, '', '&', PHP_QUERY_RFC1738);
    }

    // Verify the signed VNPAY fields before looking up or changing a payment.
    public function verifyCallback(array $parameters): bool
    {
        if (!$this->isConfigured() || !is_string($parameters['vnp_SecureHash'] ?? null)) return false;
        $received = strtolower($parameters['vnp_SecureHash']);
        if (!preg_match('/^[a-f0-9]{128}$/D', $received)) return false;
        foreach ($parameters as $key => $value) {
            if (!is_string($key) || !str_starts_with($key, 'vnp_') || (!is_string($value) && !is_int($value))) return false;
        }
        return hash_equals($this->signature($parameters), $received);
    }

    // Generate a digest from sorted, URL-encoded key/value pairs as required by VNPAY 2.1.0.
    private function signature(array $parameters): string
    {
        unset($parameters['vnp_SecureHash'], $parameters['vnp_SecureHashType']);
        ksort($parameters, SORT_STRING);
        $pairs = [];
        foreach ($parameters as $key => $value) {
            if (!str_starts_with((string) $key, 'vnp_') || $value === '' || $value === null) continue;
            $pairs[] = urlencode((string) $key) . '=' . urlencode((string) $value);
        }
        return hash_hmac('sha512', implode('&', $pairs), $this->config['hashSecret']);
    }

    private function isAllowedUrl(string $url): bool
    {
        $parts = parse_url($url);
        if (!is_array($parts) || !in_array(strtolower((string) ($parts['scheme'] ?? '')), ['http', 'https'], true) || empty($parts['host']) || isset($parts['user']) || isset($parts['pass']) || isset($parts['fragment'])) return false;
        $host = strtolower($parts['host']);
        return strtolower($parts['scheme']) === 'https' || in_array($host, ['localhost', '127.0.0.1'], true);
    }
}
