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
        if (count($payments) !== 1) throw new ApiException(409, 'PAYMENT_CONFLICT', 'Đơn phải có một ledger thanh toán duy nhất.');
        $paid = array_values(array_filter($payments, fn ($payment) => $payment['status'] === 'PAID'));
        if (count($paid) !== 1 || $paid[0]['payment_method'] !== $order['payment_method'] || orderMoney($paid[0]['amount']) !== orderMoney($order['total_amount']) || $paid[0]['paid_at'] === null || ($order['payment_method'] !== 'COD' && empty($paid[0]['provider_transaction_code']))) throw new ApiException(409, 'PAYMENT_CONFLICT', 'Khoản thanh toán chưa có dữ liệu xác nhận hợp lệ.');
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

    public function byReference(string $reference): ?array
    {
        $query = $this->pdo->prepare('SELECT * FROM payments WHERE payment_code = ? AND is_deleted = 0');
        $query->execute([$reference]);
        return $query->fetch(\PDO::FETCH_ASSOC) ?: null;
    }

    public function forOrder(string $orderId): array
    {
        $query = $this->pdo->prepare('SELECT * FROM payments WHERE order_id = ? AND is_deleted = 0 ORDER BY id');
        $query->execute([$orderId]);
        return $query->fetchAll(\PDO::FETCH_ASSOC);
    }

    public function events(string $orderId): array
    {
        $query = $this->pdo->prepare('SELECT e.event_type, e.amount, e.actor_id, e.actor_role, e.reference_code, e.reason, e.created_at FROM payment_events e JOIN payments p ON p.id = e.payment_id WHERE p.order_id = ? ORDER BY e.id');
        $query->execute([$orderId]);
        return $query->fetchAll(\PDO::FETCH_ASSOC);
    }

    // Append-only financial audit; the unique reference also prevents allocating one transfer twice.
    public function audit(array $payment, array $actor, string $type, ?string $reference, string $reason): void
    {
        $query = $this->pdo->prepare('INSERT INTO payment_events (payment_id, event_type, amount, actor_id, actor_role, reference_code, reason, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())');
        $query->execute([$payment['id'], $type, $payment['amount'], $actor['id'], $actor['role'], $reference, $reason]);
    }

    // Caller locks order then payment. No external provider call takes place in this transaction.
    public function settle(array $order, array $payment, array $actor, string $reference, string $reason, bool $late = false, ?string $providerPaidAt = null): void
    {
        $query = $this->pdo->prepare("UPDATE payments SET status = 'PAID', paid_at = ?, provider_transaction_code = ? WHERE id = ? AND status IN ('PENDING','FAILED')");
        $query->execute([$providerPaidAt ?? gmdate('Y-m-d H:i:s'), $reference, $payment['id']]);
        if ($query->rowCount() !== 1) throw new ApiException(409, 'PAYMENT_CONFLICT', 'Giao dịch đã được xử lý.');
        $query = $this->pdo->prepare("UPDATE orders SET payment_status = 'PAID', refund_required = ?, version = version + 1 WHERE id = ?");
        $query->execute([(int) ($late || $order['order_status'] === 'CANCELLED'), $order['id']]);
        $this->audit($payment, $actor, $late || $order['order_status'] === 'CANCELLED' ? 'PAID_REQUIRES_REVIEW' : 'PAID', $reference, $reason);
    }

    public function fail(array $order, array $payment, string $reason): void
    {
        $query = $this->pdo->prepare("UPDATE payments SET status = 'FAILED' WHERE id = ? AND status = 'PENDING'");
        $query->execute([$payment['id']]);
        if ($query->rowCount() === 1) {
            $this->pdo->prepare("UPDATE orders SET payment_status = 'FAILED', version = version + 1 WHERE id = ?")->execute([$order['id']]);
            $this->audit($payment, ['id' => null, 'role' => 'SYSTEM'], 'FAILED', null, $reason);
        }
    }

    public function expiringOrderIds(): array
    {
        return $this->pdo->query("SELECT o.id FROM orders o JOIN payments p ON p.order_id = o.id WHERE o.order_status = 'PENDING' AND o.inventory_state = 'RESERVED' AND p.payment_method = 'VNPAY' AND p.status IN ('PENDING','FAILED') AND p.expires_at <= UTC_TIMESTAMP() AND p.is_deleted = 0 AND o.is_deleted = 0 ORDER BY p.expires_at LIMIT 100")->fetchAll(\PDO::FETCH_COLUMN);
    }

    public function expire(array $payment): void
    {
        $this->pdo->prepare("UPDATE payments SET status = 'FAILED' WHERE id = ? AND status IN ('PENDING','FAILED')")->execute([$payment['id']]);
        $this->audit($payment, ['id' => null, 'role' => 'SYSTEM'], 'EXPIRED', null, 'Hết hạn VNPay Sandbox; hủy đơn chờ và giải phóng reservation.');
    }

    public function document(string $orderId, string $type): ?array
    {
        $query = $this->pdo->prepare('SELECT document_code, snapshot_json, created_at FROM order_documents WHERE order_id = ? AND document_type = ?');
        $query->execute([$orderId, $type]);
        $row = $query->fetch(\PDO::FETCH_ASSOC);
        return $row ? ['code' => $row['document_code'], 'issuedAt' => orderIsoDate($row['created_at']), 'snapshot' => json_decode($row['snapshot_json'], true, 64, JSON_THROW_ON_ERROR)] : null;
    }

    public function insertDocument(array $order, string $type, array $snapshot): array
    {
        $code = ($type === 'CUSTOMER' ? 'BILL-' : 'INT-') . $order['order_code'];
        $query = $this->pdo->prepare('INSERT INTO order_documents (order_id, document_type, document_code, snapshot_json, created_at) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())');
        $query->execute([$order['id'], $type, $code, json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
        return $this->document((string) $order['id'], $type);
    }
}
