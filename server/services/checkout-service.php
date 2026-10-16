<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

interface CheckoutServiceInterface
{
    public function quoteCheckout(array $principal, array $input): array;
    public function createOrder(array $principal, array $input, string $key): array;
}

// The transaction is implemented; production owner adapters must be supplied explicitly.
final class CheckoutService implements CheckoutServiceInterface
{
    public function __construct(private readonly ?OrderModel $model = null, private readonly ?CheckoutDependencies $dependencies = null) {}

    // Fail closed instead of trusting frontend prices or partially wired dependencies.
    private function ready(array $principal): void
    {
        if ($this->model === null) throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Dịch vụ thanh toán đơn hàng chưa sẵn sàng.');
        $this->model->requireActor($principal, ['CUSTOMER']);
        if ($this->dependencies === null) throw new ApiException(503, 'DEPENDENCY_NOT_READY', 'Giỏ hàng, địa chỉ, voucher và kho chưa được tích hợp.');
    }

    // Validate server-owned snapshots and whole-VND totals before fingerprinting/inserting.
    private function normalize(array $quote, array $input): array
    {
        if (($quote['cartVersion'] ?? null) !== $input['cartVersion'] || empty($quote['items']) || !is_array($quote['items'])) throw new ApiException(409, 'CART_VERSION_CONFLICT', 'Giỏ hàng đã thay đổi hoặc trống.');
        $subtotal = 0;
        $seen = [];
        foreach ($quote['items'] as &$item) {
            $id = orderDatabaseId($item['skuId'] ?? null, 'skuId');
            if (isset($seen[$id])) throw new \LogicException('Owner adapter must merge repeated SKU.');
            $seen[$id] = true;
            $item['unitPrice'] = orderMoney($item['unitPrice'] ?? null);
            $item['quantity'] = orderPositiveInteger($item['quantity'] ?? null, 'quantity');
            $item['skuCode'] = orderText($item['skuCode'] ?? null, 'skuCode', 1, 80);
            $item['productName'] = orderText($item['productName'] ?? null, 'productName', 1, 255);
            $item['variantName'] = orderText($item['variantName'] ?? '', 'variantName', 0, 150);
            $item['imageUrl'] = orderText($item['imageUrl'] ?? '', 'imageUrl', 0, 500);
            if (!is_int($item['warrantyMonths'] ?? null) || $item['warrantyMonths'] < 0 || $item['warrantyMonths'] > 65535) throw new \LogicException('Invalid warranty snapshot.');
            $line = orderLineTotal($item['unitPrice'], $item['quantity']);
            if ($subtotal > MAX_ORDER_INTEGER - $line) throw new ApiException(422, 'INVALID_INPUT', 'Giỏ hàng vượt giới hạn tổng tiền.');
            $subtotal += $line;
        }
        unset($item);
        usort($quote['items'], fn ($a, $b) => strlen($a['skuId']) <=> strlen($b['skuId']) ?: strcmp($a['skuId'], $b['skuId']));
        foreach (['recipientName' => 150, 'phone' => 20, 'addressLine' => 500] as $field => $limit) $quote['shippingAddress'][$field] = orderText($quote['shippingAddress'][$field] ?? null, $field, 1, $limit);
        foreach (['subtotal', 'discount', 'shipping', 'total'] as $field) $quote['totals'][$field] = orderMoney($quote['totals'][$field] ?? null);
        $totals = $quote['totals'];
        // Existing storage uses DECIMAL(14,2): at most 12 whole-VND digits.
        if (max($totals) > 999999999999) throw new ApiException(422, 'INVALID_INPUT', 'Tổng tiền vượt giới hạn lưu trữ đơn hàng.');
        if ($totals['subtotal'] !== $subtotal || $totals['discount'] > $subtotal || $subtotal - $totals['discount'] > MAX_ORDER_INTEGER - $totals['shipping'] || $totals['total'] !== $subtotal - $totals['discount'] + $totals['shipping']) throw new \LogicException('Invalid server quote totals.');
        if (($quote['voucherId'] ?? null) !== null) orderDatabaseId($quote['voucherId'], 'voucherId');
        return $quote;
    }

    // Fingerprint excludes internal adapter metadata, but binds actor/address/cart/payment/voucher.
    private function fingerprint(array $principal, array $input, array $quote): string
    {
        return orderCanonicalHash(['actorId' => $principal['id'], 'input' => array_intersect_key($input, array_flip(['cartVersion', 'addressId', 'paymentMethod', 'voucherCode'])), 'items' => $quote['items'], 'address' => $quote['shippingAddress'], 'totals' => $quote['totals'], 'voucherId' => $quote['voucherId'] ?? null]);
    }

    // Quote is read-only; it is not a reservation or a guarantee of unchanged stock.
    public function quoteCheckout(array $principal, array $input): array
    {
        $this->ready($principal);
        $input = validateCheckoutInput($input);
        if ($input['paymentMethod'] !== 'COD') throw new ApiException(409, 'PAYMENT_NOT_AVAILABLE', 'VNPay sẽ được tích hợp ở task thanh toán.');
        $pdo = $this->model->pdo;
        $pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        $pdo->beginTransaction();
        try {
            $quote = $this->normalize($this->dependencies->quote($pdo, $principal, $input), $input);
            $result = array_intersect_key($quote, array_flip(['cartVersion', 'items', 'shippingAddress', 'totals']));
            $result['quoteFingerprint'] = $this->fingerprint($principal, $input, $quote);
            $pdo->commit();
            return $result;
        } catch (\Throwable $error) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $error;
        }
    }

    // Key -> cart/address/voucher/SKU locks -> re-quote -> snapshots -> reserve -> commit once.
    public function createOrder(array $principal, array $input, string $key): array
    {
        $this->ready($principal);
        $input = validateCheckoutInput($input, true);
        orderIdempotencyKey(['idempotency-key' => $key]);
        if ($input['paymentMethod'] !== 'COD') throw new ApiException(409, 'PAYMENT_NOT_AVAILABLE', 'VNPay sẽ được tích hợp ở task thanh toán.');
        return (new OrderIdempotencyModel($this->model->pdo))->run($principal, 'checkout', $key, $input, function () use ($principal, $input) {
            $quote = $this->normalize($this->dependencies->lockForCreate($this->model->pdo, $principal, $input), $input);
            if (!hash_equals($this->fingerprint($principal, $input, $quote), $input['quoteFingerprint'])) throw new ApiException(409, 'CHECKOUT_CHANGED', 'Giá, địa chỉ hoặc ưu đãi đã thay đổi. Hãy xác nhận lại.');
            $order = (new CheckoutModel($this->model))->insert($principal, $input, $quote);
            $this->dependencies->commitCheckout($this->model->pdo, $principal, $quote, $order);
            return ['order' => $this->model->detail((string) $order['id'], $principal['id'], false), 'payment' => null];
        });
    }
}
