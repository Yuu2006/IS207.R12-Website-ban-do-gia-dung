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

    public function findByCode(string $paymentCode): ?array
    {
        $statement = $this->pdo->prepare('SELECT id, order_id, payment_code, payment_method, amount, status, expires_at FROM payments WHERE payment_code = ? AND is_deleted = 0 LIMIT 1');
        $statement->execute([$paymentCode]);
        $row = $statement->fetch(\PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function findOwnedVnpayAttempt(string $paymentCode, string $customerId): ?array
    {
        $statement = $this->pdo->prepare('SELECT p.order_id, p.status, p.expires_at, o.order_code, o.order_status, o.refund_required FROM payments p JOIN orders o ON o.id = p.order_id WHERE p.payment_code = ? AND p.payment_method = ? AND p.is_deleted = 0 AND o.customer_id = ? AND o.is_deleted = 0 LIMIT 1');
        $statement->execute([$paymentCode, 'VNPAY', $customerId]);
        $row = $statement->fetch(\PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    public function expiredVnpayPaymentCodes(int $limit): array
    {
        $statement = $this->pdo->query("SELECT payment_code FROM payments WHERE payment_method = 'VNPAY' AND status IN ('PENDING', 'FAILED') AND expires_at <= UTC_TIMESTAMP() AND is_deleted = 0 ORDER BY expires_at, id LIMIT " . $limit);
        return $statement->fetchAll(\PDO::FETCH_COLUMN);
    }

    public function markVnpayPaid(array $payment, string $transactionCode, string $responseCode): void
    {
        $statement = $this->pdo->prepare("UPDATE payments SET status = 'PAID', provider_transaction_code = ?, provider_response_code = ?, paid_at = UTC_TIMESTAMP(), callback_received_at = UTC_TIMESTAMP() WHERE id = ? AND payment_method = 'VNPAY' AND status IN ('PENDING', 'FAILED')");
        $statement->execute([$transactionCode, $responseCode, $payment['id']]);
        if ($statement->rowCount() !== 1) throw new ApiException(409, 'PAYMENT_CONFLICT', 'Khoản thanh toán VNPay đã được xử lý.');
    }

    public function markVnpayFailed(array $payment, string $responseCode): void
    {
        $statement = $this->pdo->prepare("UPDATE payments SET status = 'FAILED', provider_response_code = ?, callback_received_at = UTC_TIMESTAMP() WHERE id = ? AND payment_method = 'VNPAY' AND status = 'PENDING'");
        $statement->execute([$responseCode, $payment['id']]);
        if ($statement->rowCount() !== 1) throw new ApiException(409, 'PAYMENT_CONFLICT', 'Khoản thanh toán VNPay đã được xử lý.');
    }

    public function markVnpayExpired(array $payment): void
    {
        $statement = $this->pdo->prepare("UPDATE payments SET status = 'FAILED', provider_response_code = 'EXPIRED' WHERE id = ? AND payment_method = 'VNPAY' AND status IN ('PENDING', 'FAILED') AND expires_at <= UTC_TIMESTAMP()");
        $statement->execute([$payment['id']]);
    }

    public function updateOrderPayment(string $orderId, string $status, bool $refundRequired): void
    {
        $statement = $this->pdo->prepare('UPDATE orders SET payment_status = ?, refund_required = ?, version = version + 1 WHERE id = ? AND payment_status <> ?');
        $statement->execute([$status, (int) $refundRequired, $orderId, $status]);
        if ($statement->rowCount() !== 1) throw new ApiException(409, 'PAYMENT_CONFLICT', 'Trạng thái thanh toán của đơn đã thay đổi.');
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
