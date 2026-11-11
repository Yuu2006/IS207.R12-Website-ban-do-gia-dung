<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

interface VnpayPaymentServiceInterface
{
    public function getAttempt(array $principal, string $paymentCode): array;
}

final class VnpayPaymentService implements VnpayPaymentServiceInterface
{
    public function __construct(private readonly OrderModel $orders) {}

    // The browser return only resolves an attempt owned by the current customer; it cannot settle it.
    public function getAttempt(array $principal, string $paymentCode): array
    {
        $this->orders->requireActor($principal, ['CUSTOMER']);
        $paymentCode = orderText($paymentCode, 'paymentCode', 1, 80);
        $row = (new PaymentModel($this->orders->pdo))->findOwnedVnpayAttempt($paymentCode, (string) $principal['id']);
        if (!$row) throw new ApiException(404, 'PAYMENT_ATTEMPT_NOT_FOUND', 'Không tìm thấy kết quả thanh toán.');
        return ['orderId' => (string) $row['order_id'], 'orderCode' => $row['order_code'], 'paymentStatus' => strtolower($row['status']),
            'orderStatus' => strtolower($row['order_status']), 'expiresAt' => $row['expires_at'] === null ? null : orderIsoDate($row['expires_at']), 'refundRequired' => (bool) $row['refund_required']];
    }
}
