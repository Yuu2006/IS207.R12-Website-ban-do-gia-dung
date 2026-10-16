<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class PaymentModel
{
    // Use the order transaction; never call a payment provider in an open transaction.
    public function __construct(private readonly \PDO $pdo) {}

    // Lock payments after order and in increasing ID order, before cart/voucher/SKU.
    public function lock(string $orderId): array
    {
        $statement = $this->pdo->prepare('SELECT * FROM payments WHERE order_id = ? AND is_deleted = 0 ORDER BY id FOR UPDATE');
        $statement->execute([$orderId]);
        return $statement->fetchAll(\PDO::FETCH_ASSOC);
    }

    // A paid order header alone is not evidence of a valid payment ledger.
    public function assertSettled(array $order, array $payments): void
    {
        $paid = array_values(array_filter($payments, fn ($payment) => $payment['status'] === 'PAID'));
        if (count($paid) !== 1 || $paid[0]['payment_method'] !== $order['payment_method'] || orderMoney($paid[0]['amount']) !== orderMoney($order['total_amount']) || $paid[0]['paid_at'] === null || ($order['payment_method'] === 'VNPAY' && empty($paid[0]['provider_transaction_code']))) throw new ApiException(409, 'PAYMENT_CONFLICT', 'Khoản thanh toán chưa có dữ liệu xác nhận hợp lệ.');
    }

    // Record COD only on validated delivery; reject missing/ambiguous/mismatched payment rows.
    public function collectCod(array $order, array $payments): void
    {
        if (count($payments) !== 1 || $payments[0]['payment_method'] !== 'COD' || $payments[0]['status'] !== 'UNPAID' || orderMoney($payments[0]['amount']) !== orderMoney($order['total_amount'])) {
            throw new ApiException(409, 'PAYMENT_CONFLICT', 'Không thể xác nhận khoản thu COD.');
        }
        $statement = $this->pdo->prepare('UPDATE payments SET status = ?, paid_at = UTC_TIMESTAMP() WHERE id = ? AND status = ?');
        $statement->execute(['PAID', $payments[0]['id'], 'UNPAID']);
        if ($statement->rowCount() !== 1) throw new ApiException(409, 'PAYMENT_CONFLICT', 'Khoản thanh toán đã thay đổi.');
    }
}
