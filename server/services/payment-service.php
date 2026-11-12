<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

require_once __DIR__ . '/../config/payment-config.php';

final class PaymentService
{
    public function __construct(private readonly OrderModel $orders, private readonly CheckoutDependencies $checkout) {}

    public function methods(): array
    {
        $bank = $vnpay = false;
        try { bankTransferConfig(); $bank = true; } catch (ApiException) {}
        try { vnpayConfig(); $vnpay = true; } catch (ApiException) {}
        return ['COD' => true, 'BANK_TRANSFER' => $bank, 'VNPAY' => $vnpay];
    }

    private function scoped(array $actor, string $id, bool $staff, bool $lock = false): array
    {
        $this->orders->requireActor($actor, $staff ? ['SALES', 'ADMIN'] : ['CUSTOMER']);
        return $this->orders->find($id, $staff ? null : $actor['id'], $lock);
    }

    // Account and amount come from the stored payment, never from query parameters or frontend state.
    public function status(array $actor, string $id, bool $staff): array
    {
        $order = $this->scoped($actor, $id, $staff);
        $rows = (new PaymentModel($this->orders->pdo))->forOrder($id);
        if (count($rows) !== 1) throw new ApiException(409, 'PAYMENT_CONFLICT', 'Đơn chưa có một khoản thanh toán hợp lệ.');
        $payment = $rows[0];
        if (!in_array($order['payment_method'], ['COD', 'VNPAY', 'BANK_TRANSFER'], true) || $payment['status'] !== $order['payment_status'] || $payment['payment_method'] !== $order['payment_method'] || orderMoney($payment['amount']) !== orderMoney($order['total_amount'])) throw new ApiException(409, 'PAYMENT_CONFLICT', 'Khoản thanh toán không khớp snapshot đơn.');
        $result = ['orderId' => $id, 'orderCode' => $order['order_code'], 'version' => (int) $order['version'], 'reference' => $payment['payment_code'],
            'method' => $payment['payment_method'], 'status' => strtolower($payment['status']), 'amount' => orderMoney($payment['amount']),
            'paidAt' => $payment['paid_at'] ? orderIsoDate($payment['paid_at']) : null, 'refundRequired' => (bool) $order['refund_required'], 'bank' => null,
            'canSimulateRefund' => $staff && $actor['role'] === 'ADMIN' && $order['order_status'] === 'CANCELLED' && $payment['status'] === 'PAID' && orderMoney($payment['amount']) > 0,
            'simulatedRefund' => (new PaymentModel($this->orders->pdo))->simulatedRefund($id)];
        if ($payment['payment_method'] === 'BANK_TRANSFER' && $payment['status'] === 'PENDING' && $order['order_status'] !== 'CANCELLED') {
            $bank = json_decode($payment['metadata_json'] ?? '{}', true, 16, JSON_THROW_ON_ERROR);
            if (!isset($bank['bankBin'], $bank['accountNo'], $bank['accountName'])) throw new ApiException(409, 'BANK_SNAPSHOT_MISSING', 'Thiếu snapshot tài khoản nhận của giao dịch.');
            $result['bank'] = $bank + ['content' => $payment['payment_code'], 'qrUrl' => 'https://img.vietqr.io/image/' . rawurlencode($bank['bankBin']) . '-' . rawurlencode($bank['accountNo']) . '-compact2.png?' . http_build_query(['amount' => $result['amount'], 'addInfo' => $payment['payment_code'], 'accountName' => $bank['accountName']], '', '&', PHP_QUERY_RFC3986)];
        }
        if ($staff) $result['audit'] = (new PaymentModel($this->orders->pdo))->events($id);
        return $result;
    }

    public function byReference(array $actor, string $reference): array
    {
        $payment = (new PaymentModel($this->orders->pdo))->byReference($reference);
        if (!$payment) throw new ApiException(404, 'PAYMENT_NOT_FOUND', 'Không tìm thấy giao dịch.');
        return $this->status($actor, (string) $payment['order_id'], false);
    }

    // CLI worker only; recheck under the same order/payment locks used by callbacks and cancellations.
    public function expirePendingVnpay(CheckoutDependencies $dependencies): int
    {
        $model = new PaymentModel($this->orders->pdo); $count = 0; $pdo = $this->orders->pdo;
        foreach ($model->expiringOrderIds() as $id) {
            $pdo->beginTransaction();
            try {
                $order = $this->orders->find((string) $id, null, true); $rows = $model->lock((string) $id);
                if (count($rows) !== 1 || $order['order_status'] !== 'PENDING' || $order['inventory_state'] !== 'RESERVED' || !in_array($rows[0]['status'], ['PENDING', 'FAILED'], true) || !$rows[0]['expires_at'] || strtotime($rows[0]['expires_at'] . ' UTC') > time()) { $pdo->commit(); continue; }
                $actor = ['id' => null, 'role' => 'SYSTEM'];
                $dependencies->release($pdo, $actor, $order, $this->orders->itemsFor([(string) $id])[(string) $id] ?? []);
                $model->expire($rows[0]);
                $this->orders->transition($order, $actor, ['expectedVersion' => (int) $order['version'], 'reason' => 'Hết hạn thanh toán VNPay.'], ['from' => 'pending', 'to' => 'cancelled', 'payment' => 'failed', 'refundRequired' => false]);
                $pdo->commit(); $count++;
            } catch (\Throwable $error) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $error; }
        }
        return $count;
    }

    // Staff must check bank evidence; customer screenshots and a QR render are never payment confirmation.
    public function confirmTransfer(array $actor, string $id, array $input, string $key): array
    {
        $this->orders->requireActor($actor, ['SALES', 'ADMIN']);
        allowOrderFields($input, ['expectedVersion', 'amount', 'bankTransactionRef', 'reason']);
        $version = orderPositiveInteger($input['expectedVersion'] ?? null, 'expectedVersion');
        $amount = orderPositiveInteger($input['amount'] ?? null, 'amount');
        $reference = orderText($input['bankTransactionRef'] ?? null, 'bankTransactionRef', 1, 80);
        if (!preg_match('/^[A-Za-z0-9._-]+$/D', $reference)) throw new ApiException(422, 'INVALID_REFERENCE', 'Mã giao dịch ngân hàng không hợp lệ.');
        $reason = orderText($input['reason'] ?? null, 'reason', 10, 500);
        return (new OrderIdempotencyModel($this->orders->pdo))->run($actor, 'confirm-transfer:' . $id, $key, $input, function () use ($actor, $id, $version, $amount, $reference, $reason) {
            $order = $this->scoped($actor, $id, true, true);
            $model = new PaymentModel($this->orders->pdo);
            $payments = $model->lock($id);
            if ((int) $order['version'] !== $version) throw new ApiException(409, 'ORDER_VERSION_CONFLICT', 'Đơn đã thay đổi. Hãy tải lại.');
            if (count($payments) !== 1 || $order['payment_method'] !== 'BANK_TRANSFER' || $order['payment_status'] !== 'PENDING' || $payments[0]['payment_method'] !== 'BANK_TRANSFER' || $payments[0]['status'] !== 'PENDING') throw new ApiException(409, 'PAYMENT_CONFLICT', 'Giao dịch không còn chờ xác nhận chuyển khoản.');
            if ($amount !== orderMoney($order['total_amount']) || $amount !== orderMoney($payments[0]['amount'])) throw new ApiException(422, 'AMOUNT_MISMATCH', 'Tiền thực nhận chưa khớp tổng đơn. Cần đối soát trước khi xác nhận.');
            try { $model->settle($order, $payments[0], $actor, 'BANK:' . $reference, $reason); }
            catch (\PDOException $error) { if ((int) ($error->errorInfo[1] ?? 0) === 1062) throw new ApiException(409, 'REFERENCE_ALREADY_USED', 'Giao dịch ngân hàng đã được ghi nhận.'); throw $error; }
            return $this->status($actor, $id, true);
        });
    }

    // ADMIN may simulate a full refund only for a cancelled, fully settled order; no bank API is called.
    public function simulateRefund(array $actor, string $id, array $input, string $key): array
    {
        $this->orders->requireActor($actor, ['ADMIN']);
        allowOrderFields($input, ['expectedVersion', 'reason']);
        $version = orderPositiveInteger($input['expectedVersion'] ?? null, 'expectedVersion');
        $reason = orderText($input['reason'] ?? null, 'reason', 10, 500);
        return (new OrderIdempotencyModel($this->orders->pdo))->run($actor, 'simulate-refund:' . $id, $key, $input, function () use ($actor, $id, $version, $reason) {
            $order = $this->scoped($actor, $id, true, true);
            $model = new PaymentModel($this->orders->pdo);
            $rows = $model->lock($id);
            if ((int) $order['version'] !== $version) throw new ApiException(409, 'ORDER_VERSION_CONFLICT', 'Đơn đã thay đổi. Hãy tải lại.');
            if ($order['order_status'] !== 'CANCELLED' || $order['payment_status'] !== 'PAID' || orderMoney($order['total_amount']) <= 0) throw new ApiException(409, 'REFUND_NOT_ALLOWED', 'Chỉ hoàn toàn bộ tiền mô phỏng cho đơn đã hủy và đã thu đủ tiền.');
            $model->assertSettled($order, $rows);
            $model->simulateRefund($order, $rows[0], $actor, $reason);
            return $this->status($actor, $id, true);
        });
    }

    // Only signed IPN changes financial state. A browser return page can only read existing state.
    public function ipn(array $query): array
    {
        $config = vnpayConfig();
        $params = [];
        foreach ($query as $key => $value) {
            if (!str_starts_with($key, 'vnp_') || !is_string($value) || strlen($value) > 500) return ['RspCode' => '97', 'Message' => 'Invalid parameters'];
            $params[$key] = $value;
        }
        if (!is_string($params['vnp_SecureHash'] ?? null) || !hash_equals(vnpaySignature($params, $config['secret']), strtolower($params['vnp_SecureHash'])) || ($params['vnp_TmnCode'] ?? '') !== $config['code']) return ['RspCode' => '97', 'Message' => 'Invalid signature'];
        $model = new PaymentModel($this->orders->pdo);
        $found = $model->byReference($params['vnp_TxnRef'] ?? '');
        if (!$found || $found['payment_method'] !== 'VNPAY') return ['RspCode' => '01', 'Message' => 'Payment not found'];
        $pdo = $this->orders->pdo;
        $pdo->beginTransaction();
        try {
            $order = $this->orders->find((string) $found['order_id'], null, true);
            $rows = $model->lock((string) $order['id']);
            if (count($rows) !== 1 || (string) $rows[0]['id'] !== (string) $found['id'] || $order['payment_method'] !== 'VNPAY' || $rows[0]['status'] !== $order['payment_status']) throw new ApiException(409, 'PAYMENT_CONFLICT', 'Ambiguous ledger');
            $payment = $rows[0];
            if (($params['vnp_Amount'] ?? '') !== (string) (orderMoney($payment['amount']) * 100) || orderMoney($payment['amount']) !== orderMoney($order['total_amount'])) { $pdo->rollBack(); return ['RspCode' => '04', 'Message' => 'Invalid amount']; }
            if ($payment['status'] === 'PAID' || $payment['status'] === 'REFUNDED') { $pdo->commit(); return ['RspCode' => '02', 'Message' => 'Already confirmed']; }
            if (($params['vnp_ResponseCode'] ?? '') === '00' && ($params['vnp_TransactionStatus'] ?? '') === '00') {
                $reference = $params['vnp_TransactionNo'] ?? '';
                if (!preg_match('/^[1-9][0-9]{0,70}$/D', $reference)) { $pdo->rollBack(); return ['RspCode' => '97', 'Message' => 'Invalid transaction']; }
                $date = \DateTimeImmutable::createFromFormat('!YmdHis', $params['vnp_PayDate'] ?? '', new \DateTimeZone('Asia/Ho_Chi_Minh'));
                if (!$date || $date->format('YmdHis') !== ($params['vnp_PayDate'] ?? '') || $date->getTimestamp() < strtotime($payment['created_at'] . ' UTC') || $date->getTimestamp() > time() + 300) { $pdo->rollBack(); return ['RspCode' => '97', 'Message' => 'Invalid payment date']; }
                $late = $payment['expires_at'] !== null && strtotime($payment['expires_at'] . ' UTC') < $date->getTimestamp();
                // A late payment must not keep stock reserved while staff reconcile the refund.
                if ($late && $order['order_status'] === 'PENDING' && $order['inventory_state'] === 'RESERVED') {
                    $system = ['id' => null, 'role' => 'SYSTEM'];
                    $this->checkout->release($pdo, $system, $order, $this->orders->itemsFor([(string) $order['id']])[(string) $order['id']] ?? []);
                    $model->expire($payment);
                    $this->orders->transition($order, $system, ['expectedVersion' => (int) $order['version'], 'reason' => 'Hết hạn thanh toán VNPay.'], ['from' => 'pending', 'to' => 'cancelled', 'payment' => 'failed', 'refundRequired' => false]);
                    $order['order_status'] = 'CANCELLED';
                }
                $model->settle($order, $payment, ['id' => null, 'role' => 'SYSTEM'], 'VNPAY:' . $reference, 'VNPay Sandbox IPN verified', $late, $date->setTimezone(new \DateTimeZone('UTC'))->format('Y-m-d H:i:s'));
            } else $model->fail($order, $payment, 'VNPay Sandbox response ' . ($params['vnp_ResponseCode'] ?? 'unknown'));
            $pdo->commit();
            return ['RspCode' => '00', 'Message' => 'Confirm success'];
        } catch (\Throwable $error) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $error; }
    }

    // Both document types retain the same immutable sale snapshot; only internal documents expose staff audit.
    public function document(array $actor, string $id, bool $staff, string $type): array
    {
        if (!in_array($type, ['CUSTOMER', 'INTERNAL'], true) || (!$staff && $type !== 'CUSTOMER')) throw new ApiException(403, 'FORBIDDEN', 'Không có quyền xem chứng từ này.');
        $pdo = $this->orders->pdo;
        $pdo->beginTransaction();
        try {
            $order = $this->scoped($actor, $id, $staff, true);
            $model = new PaymentModel($pdo);
            $rows = $model->lock($id);
            $document = $model->document($id, $type);
            if (!$document) {
                if ($order['order_status'] === 'CANCELLED' || (bool) $order['refund_required']) throw new ApiException(409, 'PAYMENT_REVIEW_REQUIRED', 'Khoản thu cần đối soát; không phát hành bill bán hàng mới cho đơn đã hủy.');
                if ($order['payment_status'] !== 'PAID') throw new ApiException(409, 'NOT_PAID', 'Chỉ phát hành biên nhận sau khi đã xác nhận thu tiền.');
                $model->assertSettled($order, $rows);
                $detail = $this->orders->detail($id, $staff ? null : $actor['id'], $staff);
                if (empty($order['merchant_snapshot'])) throw new ApiException(409, 'MERCHANT_SNAPSHOT_MISSING', 'Đơn cũ chưa có snapshot cửa hàng để phát hành biên nhận.');
                $snapshot = ['merchant' => json_decode($order['merchant_snapshot'], true, 16, JSON_THROW_ON_ERROR),
                    'orderCode' => $order['order_code'], 'orderedAt' => $detail['createdAt'], 'customer' => $detail['shippingAddress'],
                    'items' => $detail['items'], 'totals' => $detail['totals'], 'paymentMethod' => $order['payment_method'], 'paidAt' => orderIsoDate($rows[0]['paid_at']), 'currency' => 'VND'];
                // Reuse the first sale snapshot so internal/customer copies cannot diverge after catalog edits.
                $other = $model->document($id, $type === 'CUSTOMER' ? 'INTERNAL' : 'CUSTOMER');
                if ($other) $snapshot = $other['snapshot'];
                $document = $model->insertDocument($order, $type, $snapshot);
            }
            $result = $document + ['type' => $type, 'currentOrderStatus' => strtolower($order['order_status']), 'currentPaymentStatus' => strtolower($order['payment_status']), 'refundRequired' => (bool) $order['refund_required'], 'simulatedRefund' => $model->simulatedRefund($id), 'electronicTaxInvoice' => false];
            if ($type === 'INTERNAL') $result['paymentAudit'] = $model->events($id);
            $pdo->commit();
            return $result;
        } catch (\Throwable $error) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $error; }
    }
}
