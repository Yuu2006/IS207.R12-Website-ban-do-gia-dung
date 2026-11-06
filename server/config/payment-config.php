<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

// Beneficiary data is configured on the server and snapshotted per payment, never supplied by a buyer.
function bankTransferConfig(): array
{
    $bin = getenv('BANK_TRANSFER_BIN') ?: '';
    $account = getenv('BANK_TRANSFER_ACCOUNT_NO') ?: '';
    $name = trim(getenv('BANK_TRANSFER_ACCOUNT_NAME') ?: '');
    if (!preg_match('/^\d{6}$/D', $bin) || !preg_match('/^\d{6,30}$/D', $account) || $name === '' || strlen($name) > 120) throw new ApiException(503, 'BANK_NOT_CONFIGURED', 'Chuyển khoản chưa được cấu hình tài khoản nhận.');
    return ['bankBin' => $bin, 'accountNo' => $account, 'accountName' => $name];
}

function vnpayConfig(): array
{
    $code = getenv('VNPAY_TMN_CODE') ?: '';
    $secret = getenv('VNPAY_HASH_SECRET') ?: '';
    $return = getenv('VNPAY_RETURN_URL') ?: '';
    $url = parse_url($return);
    if ($code === '' || strlen($secret) < 16 || !$url || !in_array($url['scheme'] ?? '', ['http', 'https'], true) || isset($url['user']) || isset($url['pass'])) throw new ApiException(503, 'VNPAY_NOT_CONFIGURED', 'VNPay Sandbox chưa được cấu hình.');
    return ['code' => $code, 'secret' => $secret, 'returnUrl' => $return];
}

// VNPAY 2.1.0 signs sorted, form-url-encoded parameters using HMAC SHA512.
function vnpaySignature(array $parameters, string $secret): string
{
    unset($parameters['vnp_SecureHash'], $parameters['vnp_SecureHashType']);
    ksort($parameters);
    return hash_hmac('sha512', http_build_query($parameters, '', '&', PHP_QUERY_RFC1738), $secret);
}

function vnpayRedirect(array $payment): string
{
    $config = vnpayConfig();
    $zone = new \DateTimeZone('Asia/Ho_Chi_Minh');
    $params = ['vnp_Version' => '2.1.0', 'vnp_Command' => 'pay', 'vnp_TmnCode' => $config['code'],
        'vnp_Amount' => (string) (orderMoney($payment['amount']) * 100), 'vnp_CurrCode' => 'VND',
        'vnp_TxnRef' => $payment['payment_code'], 'vnp_OrderInfo' => 'Thanh toan ' . $payment['payment_code'],
        'vnp_OrderType' => 'other', 'vnp_Locale' => 'vn', 'vnp_ReturnUrl' => $config['returnUrl'],
        'vnp_IpAddr' => filter_var($_SERVER['REMOTE_ADDR'] ?? '', FILTER_VALIDATE_IP) ?: '127.0.0.1',
        'vnp_CreateDate' => (new \DateTimeImmutable($payment['created_at'], new \DateTimeZone('UTC')))->setTimezone($zone)->format('YmdHis'),
        'vnp_ExpireDate' => (new \DateTimeImmutable($payment['expires_at'], new \DateTimeZone('UTC')))->setTimezone($zone)->format('YmdHis')];
    $params['vnp_SecureHash'] = vnpaySignature($params, $config['secret']);
    return 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?' . http_build_query($params, '', '&', PHP_QUERY_RFC1738);
}
