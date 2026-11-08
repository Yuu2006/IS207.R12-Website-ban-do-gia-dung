<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

require_once __DIR__ . '/../models/checkout-runtime-model.php';

// Production SQL adapter: one PDO transaction owns checkout, inventory, voucher and cart writes.
final class MysqlCheckoutDependencies implements CheckoutDependencies
{
    // Quote from the current cart/catalog/address/voucher without reserving stock or coupon usage.
    public function quote(\PDO $pdo, array $principal, array $input): array
    {
        return $this->buildQuote(new CheckoutRuntimeModel($pdo), $principal, $input, false);
    }

    // Lock cart -> address -> voucher/usage -> SKU, then rebuild the exact quote before insert.
    public function lockForCreate(\PDO $pdo, array $principal, array $input): array
    {
        if (!$pdo->inTransaction()) throw new \LogicException('Checkout locks require the order transaction.');
        return $this->buildQuote(new CheckoutRuntimeModel($pdo), $principal, $input, true);
    }

    // Return the authenticated customer's cart DTO for GET /cart.
    public function getCart(\PDO $pdo, array $principal): array
    {
        $cart = (new CheckoutRuntimeModel($pdo))->cartSnapshot($principal['id']);
        return $cart;
    }

    // Add a SKU under cart and SKU locks; stale versions and insufficient stock do not mutate rows.
    public function addCartItem(\PDO $pdo, array $principal, array $input): array
    {
        if (!$pdo->inTransaction()) throw new \LogicException('Cart writes require the idempotency transaction.');
        $runtime = new CheckoutRuntimeModel($pdo);
        $cart = $runtime->ensureLockedCart((string) $principal['id']);
        $cartId = (string) $cart['id'];
        $cartVersion = (int) $cart['cart_version'];
        if ($cartVersion !== $input['expectedCartVersion']) throw new ApiException(409, 'CART_VERSION_CONFLICT', 'Giỏ hàng đã thay đổi. Hãy tải lại trước khi thêm sản phẩm.');

        $variantId = $input['variantId'];
        $quantity = $input['quantity'];
        $existingQuantity = 0;
        foreach ($runtime->cartLines($cartId, true) as $line) {
            if ((string) $line['variant_id'] === $variantId) $existingQuantity = (int) $line['quantity'];
        }
        if ($existingQuantity > 4294967295 - $quantity) throw new ApiException(409, 'CART_QUANTITY_LIMIT', 'Số lượng sản phẩm vượt giới hạn giỏ hàng.');
        $mergedQuantity = $existingQuantity + $quantity;
        $lines = [['variant_id' => $variantId, 'quantity' => $mergedQuantity]];
        $variants = $runtime->variants($lines, true);
        if (!isset($variants[$variantId])) throw new ApiException(409, 'SKU_UNAVAILABLE', 'SKU này không còn được bán. Hãy tải lại danh sách sản phẩm.');
        if ((int) $variants[$variantId]['stock_quantity'] < $mergedQuantity) throw new ApiException(409, 'OUT_OF_STOCK', 'Số lượng tồn không đủ cho yêu cầu này.');

        $runtime->setCartItemQuantity($cartId, $variantId, $mergedQuantity);
        $runtime->incrementCartVersion($cartId, $cartVersion);
        return $runtime->cartSnapshot((string) $principal['id']);
    }

    // Update a cart line under cart/SKU locks; quantity and stock are revalidated before one version bump.
    public function updateCartItem(\PDO $pdo, array $principal, string $variantId, array $input): array
    {
        if (!$pdo->inTransaction()) throw new \LogicException('Cart writes require the idempotency transaction.');
        $runtime = new CheckoutRuntimeModel($pdo);
        $cart = $runtime->ensureLockedCart((string) $principal['id']);
        $cartId = (string) $cart['id'];
        $cartVersion = (int) $cart['cart_version'];
        if ($cartVersion !== $input['expectedCartVersion']) throw new ApiException(409, 'CART_VERSION_CONFLICT', 'Giỏ hàng đã thay đổi. Hãy tải lại trước khi cập nhật số lượng.');

        $lineExists = false;
        foreach ($runtime->cartLines($cartId, true) as $line) {
            if ((string) $line['variant_id'] === $variantId) { $lineExists = true; break; }
        }
        if (!$lineExists) throw new ApiException(404, 'CART_ITEM_NOT_FOUND', 'Sản phẩm không còn trong giỏ hàng.');
        $variants = $runtime->variants([['variant_id' => $variantId, 'quantity' => $input['quantity']]], true);
        if (!isset($variants[$variantId])) throw new ApiException(409, 'SKU_UNAVAILABLE', 'SKU này không còn được bán.');
        if ((int) $variants[$variantId]['stock_quantity'] < $input['quantity']) throw new ApiException(409, 'OUT_OF_STOCK', 'Số lượng tồn không đủ cho yêu cầu này.');

        $runtime->setCartItemQuantity($cartId, $variantId, $input['quantity']);
        $runtime->incrementCartVersion($cartId, $cartVersion);
        return $runtime->cartSnapshot((string) $principal['id']);
    }

    // Soft-delete one cart line under the cart lock; removal never changes inventory.
    public function removeCartItem(\PDO $pdo, array $principal, string $variantId, array $input): array
    {
        if (!$pdo->inTransaction()) throw new \LogicException('Cart writes require the idempotency transaction.');
        $runtime = new CheckoutRuntimeModel($pdo);
        $cart = $runtime->ensureLockedCart((string) $principal['id']);
        $cartId = (string) $cart['id'];
        $cartVersion = (int) $cart['cart_version'];
        if ($cartVersion !== $input['expectedCartVersion']) throw new ApiException(409, 'CART_VERSION_CONFLICT', 'Giỏ hàng đã thay đổi. Hãy tải lại trước khi xóa sản phẩm.');

        $lineExists = false;
        foreach ($runtime->cartLines($cartId, true) as $line) {
            if ((string) $line['variant_id'] === $variantId) { $lineExists = true; break; }
        }
        if (!$lineExists) throw new ApiException(404, 'CART_ITEM_NOT_FOUND', 'Sản phẩm không còn trong giỏ hàng.');
        $runtime->removeCartItem($cartId, $variantId);
        $runtime->incrementCartVersion($cartId, $cartVersion);
        return $runtime->cartSnapshot((string) $principal['id']);
    }

    // Calculate whole-VND subtotal, voucher, shipping policy and address snapshot from database values.
    private function buildQuote(CheckoutRuntimeModel $model, array $principal, array $input, bool $lock): array
    {
        $cart = $model->cart($principal['id'], $lock);
        if (!$cart) throw new ApiException(422, 'EMPTY_CART', 'Giỏ hàng đang trống.');
        if ((int) $cart['cart_version'] !== $input['cartVersion']) throw new ApiException(409, 'CART_VERSION_CONFLICT', 'Giỏ hàng đã thay đổi. Hãy tải lại.');
        $lines = $model->cartLines((string) $cart['id'], $lock);
        if ($lines === []) throw new ApiException(422, 'EMPTY_CART', 'Giỏ hàng đang trống.');

        $address = $model->address($input['addressId'], $principal['id'], $lock);
        if (!$address) throw new ApiException(404, 'ADDRESS_NOT_FOUND', 'Không tìm thấy địa chỉ giao hàng.');

        $voucher = null;
        $reservedVoucherCount = [];
        if ($input['voucherCode'] !== null) {
            $voucher = $model->voucherByCode($input['voucherCode'], $lock);
            if (!$voucher || !(bool) $voucher['is_active'] || !(bool) $voucher['is_in_window']) throw new ApiException(422, 'VOUCHER_INVALID', 'Mã ưu đãi không tồn tại, chưa có hiệu lực hoặc đã hết hạn.');
            $reservedVoucherCount = $model->lockVoucherReservations((string) $voucher['id'], $principal['id']);
            if ($voucher['usage_limit'] !== null && (int) $voucher['used_count'] >= (int) $voucher['usage_limit']) throw new ApiException(422, 'VOUCHER_EXHAUSTED', 'Mã ưu đãi đã hết lượt sử dụng.');
            if ($voucher['per_customer_limit'] !== null && count($reservedVoucherCount) >= (int) $voucher['per_customer_limit']) throw new ApiException(422, 'VOUCHER_CUSTOMER_LIMIT', 'Bạn đã sử dụng hết lượt của mã ưu đãi này.');
        }

        $variants = $model->variants($lines, $lock);
        $items = $model->mapItems($lines, $variants, true);
        $subtotal = 0;
        foreach ($items as $item) {
            $lineTotal = orderLineTotal($item['unitPrice'], $item['quantity']);
            if ($subtotal > MAX_ORDER_INTEGER - $lineTotal) throw new ApiException(422, 'INVALID_INPUT', 'Giỏ hàng vượt giới hạn tổng tiền.');
            $subtotal += $lineTotal;
        }

        $discount = $voucher === null ? 0 : $this->voucherDiscount($voucher, $subtotal);
        $shipping = $subtotal >= 500000 ? 0 : 30000;
        if ($subtotal - $discount > MAX_ORDER_INTEGER - $shipping) throw new ApiException(422, 'INVALID_INPUT', 'Tổng thanh toán vượt giới hạn.');
        $addressParts = array_filter([
            trim((string) $address['address_line']),
            trim((string) ($address['ward'] ?? '')),
            trim((string) ($address['district'] ?? '')),
            trim((string) $address['province']),
        ], static fn ($part) => $part !== '');

        return [
            'cartVersion' => (int) $cart['cart_version'],
            'cartId' => (string) $cart['id'],
            'voucherId' => $voucher === null ? null : (string) $voucher['id'],
            'items' => $items,
            'shippingAddress' => [
                'recipientName' => $address['recipient_name'],
                'phone' => $address['phone'],
                'addressLine' => implode(', ', $addressParts),
            ],
            'totals' => ['subtotal' => $subtotal, 'discount' => $discount, 'shipping' => $shipping, 'total' => $subtotal - $discount + $shipping],
        ];
    }

    // Voucher types follow the current admin form: percent or amount; percentage rounds down to whole VND.
    private function voucherDiscount(array $voucher, int $subtotal): int
    {
        $minimum = orderMoney($voucher['min_order_amount']);
        if ($subtotal < $minimum) throw new ApiException(422, 'VOUCHER_MINIMUM_NOT_MET', 'Đơn hàng chưa đạt giá trị tối thiểu của mã ưu đãi.');
        $value = orderMoney($voucher['discount_value']);
        if ($value <= 0) throw new ApiException(503, 'VOUCHER_DATA_INCOMPATIBLE', 'Mức giảm của mã ưu đãi không hợp lệ.');
        if ($voucher['discount_type'] === 'percent') {
            if ($value > 100) throw new ApiException(503, 'VOUCHER_DATA_INCOMPATIBLE', 'Tỷ lệ giảm của mã ưu đãi vượt giới hạn.');
            $discount = intdiv($subtotal * $value, 100);
            if ($voucher['max_discount'] !== null) $discount = min($discount, orderMoney($voucher['max_discount']));
        } elseif ($voucher['discount_type'] === 'amount') {
            $discount = $value;
        } else {
            throw new ApiException(503, 'VOUCHER_DATA_INCOMPATIBLE', 'Loại giảm giá chưa được hỗ trợ.');
        }
        return min($subtotal, $discount);
    }

    // Reserve each SKU once, account for the voucher, then clear/version the cart in the same TX.
    public function commitCheckout(\PDO $pdo, array $principal, array $quote, array $order): void
    {
        if (!$pdo->inTransaction()) throw new \LogicException('Checkout writes require the order transaction.');
        $runtime = new CheckoutRuntimeModel($pdo);
        $items = (new OrderModel($pdo))->itemsFor([(string) $order['id']])[(string) $order['id']] ?? [];
        usort($items, static fn ($left, $right) => (int) $left['variant_id'] <=> (int) $right['variant_id']);
        foreach ($items as $item) $runtime->reserveStock($principal, $order, $item);
        if (($quote['voucherId'] ?? null) !== null) $runtime->reserveVoucher($quote['voucherId'], $principal['id'], (string) $order['id']);
        $runtime->clearCartAfterCheckout($quote['cartId'], $quote['cartVersion']);
    }

    // Cancellation restores only this order's tracked stock and voucher reservation in the same TX.
    public function release(\PDO $pdo, array $principal, array $order, array $items): void
    {
        if (!$pdo->inTransaction()) throw new \LogicException('Cancellation release requires the order transaction.');
        $runtime = new CheckoutRuntimeModel($pdo);
        if ($order['voucher_id'] !== null) {
            if (!$runtime->voucherById((string) $order['voucher_id'], true)) throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Không tìm thấy mã ưu đãi đã gắn với đơn.');
            $runtime->releaseVoucher($order);
        }
        usort($items, static fn ($left, $right) => (int) $left['variant_id'] <=> (int) $right['variant_id']);
        foreach ($items as $item) $runtime->releaseStock($principal, $order, $item);
    }

    // Merge an owned order's SKUs into the current cart using current availability and one version bump.
    public function reorder(\PDO $pdo, array $principal, array $order, array $items, array $input): array
    {
        if (!$pdo->inTransaction()) throw new \LogicException('Reorder requires the order transaction.');
        if ($items === []) throw new ApiException(409, 'ORDER_ITEMS_UNAVAILABLE', 'Đơn hàng không còn dòng sản phẩm để mua lại.');

        $runtime = new CheckoutRuntimeModel($pdo);
        $cart = $runtime->ensureLockedCart((string) $principal['id']);
        $cartId = (string) $cart['id'];
        $cartVersion = (int) $cart['cart_version'];
        if ($cartVersion !== (int) $input['expectedCartVersion']) {
            throw new ApiException(409, 'CART_VERSION_CONFLICT', 'Giỏ hàng đã thay đổi. Hãy tải lại trước khi mua lại.');
        }

        $existing = [];
        foreach ($runtime->cartLines($cartId, true) as $line) {
            $existing[(string) $line['variant_id']] = (int) $line['quantity'];
        }

        $additions = [];
        foreach ($items as $item) {
            $variantId = (string) ($item['variant_id'] ?? '');
            $quantity = (int) ($item['quantity'] ?? 0);
            if (!preg_match('/^[1-9][0-9]{0,19}$/D', $variantId) || $quantity < 1 || $quantity > 4294967295) {
                throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Dòng sản phẩm trong đơn không hợp lệ để mua lại.');
            }
            $current = $additions[$variantId] ?? 0;
            if ($current > 4294967295 - $quantity) throw new ApiException(409, 'CART_QUANTITY_LIMIT', 'Số lượng sản phẩm vượt giới hạn giỏ hàng.');
            $additions[$variantId] = $current + $quantity;
        }

        $merged = $existing;
        foreach ($additions as $variantId => $quantity) {
            $current = $merged[$variantId] ?? 0;
            if ($current > 4294967295 - $quantity) throw new ApiException(409, 'CART_QUANTITY_LIMIT', 'Số lượng sản phẩm vượt giới hạn giỏ hàng.');
            $merged[$variantId] = $current + $quantity;
        }

        ksort($merged, SORT_NUMERIC);
        $lines = [];
        foreach ($merged as $variantId => $quantity) $lines[] = ['variant_id' => (string) $variantId, 'quantity' => $quantity];
        $variants = $runtime->variants($lines, true);
        foreach ($lines as $line) {
            $variantId = (string) $line['variant_id'];
            if (!isset($variants[$variantId])) {
                $code = isset($additions[$variantId]) ? 'SKU_UNAVAILABLE' : 'CART_ITEM_UNAVAILABLE';
                throw new ApiException(409, $code, 'Có sản phẩm trong giỏ không còn được bán. Hãy cập nhật giỏ hàng.');
            }
        }
        $runtime->mapItems($lines, $variants, true);

        foreach ($additions as $variantId => $_quantity) {
            $runtime->setCartItemQuantity($cartId, (string) $variantId, $merged[$variantId]);
        }
        $runtime->incrementCartVersion($cartId, $cartVersion);

        return $runtime->cartSnapshot((string) $principal['id']);
    }
}
