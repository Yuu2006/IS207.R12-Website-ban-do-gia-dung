<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

interface VnpayPaymentServiceInterface
{
    public function handleIpn(array $parameters): array;
    public function getAttempt(array $principal, string $paymentCode): array;
}

final class VnpayPaymentService implements VnpayPaymentServiceInterface
{
    public function __construct(
        private readonly OrderModel $orders,
        private readonly CheckoutDependencies $checkout,
        private readonly VnpayGateway $gateway,
    ) {}

    // VNPAY's IPN is the only source that can settle a VNPay payment; browser return is read-only.
    public function handleIpn(array $parameters): array
    {
        $reply = static fn (string $code, string $message): array => ['RspCode' => $code, 'Message' => $message];
        if (!$this->gateway->isConfigured()) return $reply('99', 'System error');
        if (!$this->gateway->verifyCallback($parameters)) return $reply('97', 'Invalid signature');
        if (!$this->gateway->matchesMerchantCode($parameters['vnp_TmnCode'] ?? null)) return $reply('01', 'Order not found');

        $paymentCode = $parameters['vnp_TxnRef'] ?? null;
        $amount = $parameters['vnp_Amount'] ?? null;
        if (!is_string($paymentCode) || $paymentCode === '' || !is_string($amount) || !preg_match('/^[0-9]{1,14}$/D', $amount)) return $reply('99', 'System error');
        $payment = $this->orders->pdo;
        $ledger = new PaymentModel($payment);
        $initial = $ledger->findByCode($paymentCode);
        if (!$initial || $initial['payment_method'] !== 'VNPAY' || $initial['order_id'] === null) return $reply('01', 'Order not found');

        try {
            $payment->beginTransaction();
            $order = $this->orders->find((string) $initial['order_id'], null, true);
            $ledger = new PaymentModel($payment);
            $rows = $ledger->lock((string) $initial['order_id']);
            $attempt = null;
            foreach ($rows as $row) if ($row['payment_code'] === $paymentCode) { $attempt = $row; break; }
            if (!$attempt || $attempt['payment_method'] !== 'VNPAY') { $payment->rollBack(); return $reply('01', 'Order not found'); }

            $expectedAmount = orderMoney($order['total_amount']);
            if (orderMoney($attempt['amount']) !== $expectedAmount || $expectedAmount > 9999999999 || (string) ($expectedAmount * 100) !== $amount) {
                $payment->rollBack();
                return $reply('04', 'Invalid amount');
            }
            if ($attempt['status'] === 'PAID') { $payment->commit(); return $reply('02', 'Order already confirmed'); }
            if (!in_array($attempt['status'], ['PENDING', 'FAILED'], true)) { $payment->rollBack(); return $reply('02', 'Order already confirmed'); }

            $success = ($parameters['vnp_ResponseCode'] ?? null) === '00' && ($parameters['vnp_TransactionStatus'] ?? null) === '00';
            $transactionCode = $parameters['vnp_TransactionNo'] ?? null;
            if ($success && (!is_string($transactionCode) || !preg_match('/^[A-Za-z0-9_-]{1,100}$/D', $transactionCode))) { $payment->rollBack(); return $reply('99', 'System error'); }
            $expired = $attempt['expires_at'] !== null && strtotime($attempt['expires_at'] . ' UTC') <= time();
            if ($expired && $order['order_status'] === 'PENDING' && $order['inventory_state'] === 'RESERVED') {
                $systemActor = ['id' => null, 'role' => 'SYSTEM'];
                $this->checkout->release($payment, $systemActor, $order, $this->orders->itemsFor([(string) $order['id']])[(string) $order['id']] ?? []);
                $ledger->markVnpayExpired($attempt);
                $this->orders->expireVnpayOrder($order, $systemActor);
                if ($success) {
                    $ledger->markVnpayPaid($attempt, $transactionCode, (string) ($parameters['vnp_ResponseCode'] ?? '00'));
                    $ledger->updateOrderPayment((string) $order['id'], 'PAID', true);
                }
                $payment->commit();
                return $reply('00', 'Confirm Success');
            }
            if (!$success) {
                if ($attempt['status'] === 'FAILED') { $payment->commit(); return $reply('02', 'Order already confirmed'); }
                $ledger->markVnpayFailed($attempt, (string) ($parameters['vnp_ResponseCode'] ?? '99'));
                $ledger->updateOrderPayment((string) $order['id'], 'FAILED', false);
                $payment->commit();
                return $reply('00', 'Confirm Success');
            }

            $refundRequired = (bool) $order['refund_required'] || $order['order_status'] === 'CANCELLED' || $order['inventory_state'] !== 'RESERVED';
            $ledger->markVnpayPaid($attempt, $transactionCode, (string) ($parameters['vnp_ResponseCode'] ?? '00'));
            $ledger->updateOrderPayment((string) $order['id'], 'PAID', $refundRequired);
            $payment->commit();
            return $reply('00', 'Confirm Success');
        } catch (\Throwable $error) {
            if ($payment->inTransaction()) $payment->rollBack();
            error_log('VNPAY IPN failed: ' . get_class($error));
            return $reply('99', 'System error');
        }
    }

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

    // Release reservations and voucher usage once after the 15-minute VNPay payment window.
    public function expirePending(int $limit = 100): int
    {
        if ($limit < 1 || $limit > 500) throw new \InvalidArgumentException('Expiry batch must be between 1 and 500.');
        $candidates = (new PaymentModel($this->orders->pdo))->expiredVnpayPaymentCodes($limit);
        $expired = 0;
        foreach ($candidates as $paymentCode) {
            $pdo = $this->orders->pdo;
            try {
                $pdo->beginTransaction();
                $ledger = new PaymentModel($pdo);
                $candidate = $ledger->findByCode($paymentCode);
                if (!$candidate || $candidate['order_id'] === null) { $pdo->rollBack(); continue; }
                $order = $this->orders->find((string) $candidate['order_id'], null, true);
                $rows = $ledger->lock((string) $order['id']);
                $attempt = null;
                foreach ($rows as $row) if ($row['payment_code'] === $paymentCode) { $attempt = $row; break; }
                if (!$attempt || !in_array($attempt['status'], ['PENDING', 'FAILED'], true) || $attempt['expires_at'] === null || strtotime($attempt['expires_at'] . ' UTC') > time()) { $pdo->commit(); continue; }
                if ($order['order_status'] === 'CANCELLED') {
                    $ledger->markVnpayExpired($attempt);
                    if ($order['payment_status'] === 'PENDING') $ledger->updateOrderPayment((string) $order['id'], 'FAILED', false);
                    $pdo->commit();
                    continue;
                }
                if ($order['order_status'] !== 'PENDING') { $pdo->commit(); continue; }
                if ($order['inventory_state'] !== 'RESERVED') throw new ApiException(409, 'INVENTORY_UNTRACKED', 'VNPay order has no active stock reservation.');
                $actor = ['id' => null, 'role' => 'SYSTEM'];
                $this->checkout->release($pdo, $actor, $order, $this->orders->itemsFor([(string) $order['id']])[(string) $order['id']] ?? []);
                $ledger->markVnpayExpired($attempt);
                $this->orders->expireVnpayOrder($order, $actor);
                $pdo->commit();
                $expired++;
            } catch (\Throwable $error) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                error_log('VNPAY expiry worker failed: ' . get_class($error));
                throw $error;
            }
        }
        return $expired;
    }

}
