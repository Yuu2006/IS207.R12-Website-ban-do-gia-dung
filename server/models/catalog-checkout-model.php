<?php
declare(strict_types=1);
namespace HomeCare\OrderApi;

// Production adapter over catalog/cart/address tables. All writes use the caller's transaction.
final class CatalogCheckoutDependencies implements CheckoutDependencies
{
    public function quote(\PDO $pdo, array $actor, array $input): array { return $this->read($pdo, $actor, $input, false); }
    public function lockForCreate(\PDO $pdo, array $actor, array $input): array { return $this->read($pdo, $actor, $input, true); }

    private function read(\PDO $pdo, array $actor, array $input, bool $lock): array
    {
        $suffix = $lock ? ' FOR UPDATE' : '';
        $query = $pdo->prepare('SELECT id, version FROM carts WHERE user_id = ? AND is_deleted = 0' . $suffix);
        $query->execute([$actor['id']]); $cart = $query->fetch(\PDO::FETCH_ASSOC);
        if (!$cart || (int) $cart['version'] !== $input['cartVersion']) throw new ApiException(409, 'CART_VERSION_CONFLICT', 'Giỏ hàng đã thay đổi.');
        $query = $pdo->prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ? AND is_deleted = 0' . $suffix);
        $query->execute([$input['addressId'], $actor['id']]); $address = $query->fetch(\PDO::FETCH_ASSOC);
        if (!$address) throw new ApiException(404, 'ADDRESS_NOT_FOUND', 'Không tìm thấy địa chỉ của bạn.');
        $voucher = null;
        if ($input['voucherCode'] !== null) {
            $query = $pdo->prepare('SELECT * FROM vouchers WHERE code = ? AND is_active = 1 AND is_deleted = 0 AND starts_at <= UTC_TIMESTAMP() AND ends_at >= UTC_TIMESTAMP()' . $suffix);
            $query->execute([$input['voucherCode']]); $voucher = $query->fetch(\PDO::FETCH_ASSOC);
            if (!$voucher || ($voucher['usage_limit'] !== null && (int) $voucher['used_count'] >= (int) $voucher['usage_limit'])) throw new ApiException(422, 'VOUCHER_INVALID', 'Mã ưu đãi không còn hiệu lực hoặc đã hết lượt.');
            $query = $pdo->prepare('SELECT COUNT(*) FROM voucher_usages WHERE voucher_id = ? AND customer_id = ? AND released_at IS NULL');
            $query->execute([$voucher['id'], $actor['id']]);
            if ($voucher['per_customer_limit'] !== null && (int) $query->fetchColumn() >= (int) $voucher['per_customer_limit']) throw new ApiException(422, 'VOUCHER_LIMIT', 'Bạn đã dùng hết lượt của mã ưu đãi.');
        }
        $items = $this->cart($pdo, $actor, $lock, true)['items'];
        if (!$items) throw new ApiException(422, 'EMPTY_CART', 'Giỏ hàng trống.');
        $subtotal = array_sum(array_map(fn ($item) => orderLineTotal($item['unitPrice'], $item['quantity']), $items));
        if (!is_int($subtotal) || $subtotal > 999999999999) throw new ApiException(422, 'INVALID_TOTAL', 'Giỏ hàng vượt giới hạn tổng tiền.');
        $discount = 0;
        if ($voucher) {
            if ($subtotal < orderMoney($voucher['min_order_amount'])) throw new ApiException(422, 'VOUCHER_MINIMUM', 'Đơn chưa đạt giá trị tối thiểu của ưu đãi.');
            if ($voucher['discount_type'] === 'PERCENT') {
                $percent = (string) $voucher['discount_value'];
                if (!preg_match('/^(\d{1,3})(?:\.(\d{1,2}))?$/D', $percent, $match)) throw new ApiException(409, 'VOUCHER_DATA_INVALID', 'Cấu hình ưu đãi cần kiểm tra.');
                $basis = (int) $match[1] * 100 + (int) str_pad($match[2] ?? '', 2, '0');
                if ($basis > 10000) throw new ApiException(409, 'VOUCHER_DATA_INVALID', 'Tỷ lệ giảm giá không hợp lệ.');
                $discount = intdiv($subtotal * $basis + 5000, 10000);
            } elseif ($voucher['discount_type'] === 'FIXED') $discount = orderMoney($voucher['discount_value']);
            else throw new ApiException(409, 'VOUCHER_DATA_INVALID', 'Loại ưu đãi chưa được hỗ trợ.');
            if ($voucher['max_discount'] !== null) $discount = min($discount, orderMoney($voucher['max_discount']));
            $discount = min($subtotal, $discount);
        }
        $fee = getenv('CHECKOUT_SHIPPING_VND');
        if ($fee === false || !preg_match('/^\d{1,9}$/D', $fee)) throw new ApiException(503, 'SHIPPING_NOT_CONFIGURED', 'Cửa hàng chưa cấu hình phí giao hàng.');
        $shipping = (int) $fee;
        $threshold = getenv('CHECKOUT_FREE_SHIPPING_MIN_VND');
        if ($threshold !== false && $threshold !== '') {
            if (!preg_match('/^\d{1,12}$/D', $threshold)) throw new ApiException(503, 'SHIPPING_NOT_CONFIGURED', 'Cấu hình phí giao hàng cần kiểm tra.');
            if ($subtotal >= (int) $threshold) $shipping = 0;
        }
        return ['cartId' => (string) $cart['id'], 'cartVersion' => (int) $cart['version'], 'voucherId' => $voucher ? (string) $voucher['id'] : null,
            'items' => $items, 'shippingAddress' => ['recipientName' => $address['recipient_name'], 'phone' => $address['phone'], 'addressLine' => implode(', ', array_filter([$address['address_line'], $address['ward'], $address['district'], $address['province']]))],
            'totals' => ['subtotal' => $subtotal, 'discount' => $discount, 'shipping' => $shipping, 'total' => $subtotal - $discount + $shipping]];
    }

    // Re-price active SKUs on every read. The locked version also serializes supported cart mutations.
    public function cart(\PDO $pdo, array $actor, bool $lock = false, bool $strict = false): array
    {
        $suffix = $lock ? ' FOR UPDATE' : '';
        $query = $pdo->prepare('SELECT id, version FROM carts WHERE user_id = ? AND is_deleted = 0' . $suffix);
        $query->execute([$actor['id']]); $cart = $query->fetch(\PDO::FETCH_ASSOC);
        if (!$cart) return ['cartVersion' => 1, 'items' => []];
        $query = $pdo->prepare('SELECT variant_id, quantity FROM cart_items WHERE cart_id = ? AND is_deleted = 0 ORDER BY variant_id' . $suffix);
        $query->execute([$cart['id']]); $lines = $query->fetchAll(\PDO::FETCH_ASSOC);
        if (count($lines) > 100) throw new ApiException(422, 'CART_TOO_LARGE', 'Giỏ hàng tối đa 100 SKU.');
        $items = [];
        foreach ($lines as $line) {
            $query = $pdo->prepare("SELECT v.*, p.name, p.warranty_months, p.is_active AS product_active, p.is_deleted AS product_deleted, c.is_active AS category_active, c.is_deleted AS category_deleted, CASE WHEN v.sale_price IS NOT NULL AND (v.sale_starts_at IS NULL OR v.sale_starts_at <= UTC_TIMESTAMP()) AND (v.sale_ends_at IS NULL OR v.sale_ends_at >= UTC_TIMESTAMP()) THEN v.sale_price ELSE v.price END AS effective_price FROM product_variants v JOIN products p ON p.id = v.product_id JOIN categories c ON c.id = p.category_id WHERE v.id = ?" . $suffix);
            $query->execute([$line['variant_id']]); $sku = $query->fetch(\PDO::FETCH_ASSOC);
            $quantity = orderPositiveInteger((int) $line['quantity'], 'quantity');
            if (!$sku || ($strict && ((int) $sku['stock_quantity'] < $quantity || !(int) $sku['is_active'] || (int) $sku['is_deleted'] || !(int) $sku['product_active'] || (int) $sku['product_deleted'] || !(int) $sku['category_active'] || (int) $sku['category_deleted']))) throw new ApiException(409, 'OUT_OF_STOCK', 'Có SKU ngừng bán hoặc không đủ tồn kho.');
            $items[] = ['skuId' => (string) $sku['id'], 'skuCode' => $sku['sku'], 'productName' => $sku['name'], 'variantName' => $sku['variant_name'], 'quantity' => $quantity, 'unitPrice' => orderMoney($sku['effective_price']), 'warrantyMonths' => (int) $sku['warranty_months'], 'imageUrl' => ''];
        }
        return ['cartVersion' => (int) $cart['version'], 'items' => $items];
    }

    public function addresses(\PDO $pdo, array $actor): array
    {
        $query = $pdo->prepare('SELECT * FROM addresses WHERE user_id = ? AND is_deleted = 0 ORDER BY is_default DESC, id');
        $query->execute([$actor['id']]);
        return ['items' => array_map(fn ($row) => ['id' => (string) $row['id'], 'recipientName' => $row['recipient_name'], 'phone' => $row['phone'], 'addressLine' => implode(', ', array_filter([$row['address_line'], $row['ward'], $row['district'], $row['province']])), 'isDefault' => (bool) $row['is_default']], $query->fetchAll(\PDO::FETCH_ASSOC))];
    }

    // A complete versioned cart replacement; rejects duplicate SKU and never accepts prices.
    public function replaceCart(\PDO $pdo, array $actor, array $input, string $key): array
    {
        allowOrderFields($input, ['expectedCartVersion', 'items']);
        $version = orderPositiveInteger($input['expectedCartVersion'] ?? null, 'expectedCartVersion');
        if (!is_array($input['items'] ?? null) || !array_is_list($input['items']) || count($input['items']) > 100) throw new ApiException(422, 'INVALID_CART', 'Giỏ hàng tối đa 100 SKU.');
        $lines = [];
        foreach ($input['items'] as $item) {
            if (!is_array($item)) throw new ApiException(422, 'INVALID_CART', 'Dòng giỏ hàng không hợp lệ.');
            allowOrderFields($item, ['skuId', 'quantity']);
            $id = orderDatabaseId($item['skuId'] ?? null, 'skuId');
            if (isset($lines[$id])) throw new ApiException(422, 'DUPLICATE_SKU', 'SKU trong giỏ phải gộp số lượng.');
            $lines[$id] = orderPositiveInteger($item['quantity'] ?? null, 'quantity');
        }
        uksort($lines, fn ($a, $b) => strlen((string) $a) <=> strlen((string) $b) ?: strcmp((string) $a, (string) $b));
        return (new OrderIdempotencyModel($pdo))->run($actor, 'replace-cart', $key, $input, function () use ($pdo, $actor, $version, $lines) {
            $pdo->prepare('INSERT INTO carts (user_id) VALUES (?) ON DUPLICATE KEY UPDATE is_deleted = 0')->execute([$actor['id']]);
            $query = $pdo->prepare('SELECT id, version FROM carts WHERE user_id = ? FOR UPDATE'); $query->execute([$actor['id']]); $cart = $query->fetch(\PDO::FETCH_ASSOC);
            if ((int) $cart['version'] !== $version) throw new ApiException(409, 'CART_VERSION_CONFLICT', 'Giỏ hàng đã thay đổi.');
            $pdo->prepare('DELETE FROM cart_items WHERE cart_id = ?')->execute([$cart['id']]);
            $query = $pdo->prepare('INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES (?, ?, ?)');
            foreach ($lines as $sku => $quantity) {
                $check = $pdo->prepare('SELECT v.id FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = ? AND v.is_active = 1 AND v.is_deleted = 0 AND p.is_active = 1 AND p.is_deleted = 0 AND v.stock_quantity >= ? FOR UPDATE');
                $check->execute([$sku, $quantity]);
                if (!$check->fetchColumn()) throw new ApiException(409, 'OUT_OF_STOCK', 'SKU không còn bán hoặc không đủ tồn.');
                $query->execute([$cart['id'], $sku, $quantity]);
            }
            $result = $this->cart($pdo, $actor, true, true);
            $pdo->prepare('UPDATE carts SET version = version + 1 WHERE id = ?')->execute([$cart['id']]);
            $result['cartVersion']++;
            return $result;
        });
    }

    public function commitCheckout(\PDO $pdo, array $actor, array $quote, array $order): void
    {
        foreach ((new OrderModel($pdo))->itemsFor([(string) $order['id']])[(string) $order['id']] as $item) $this->move($pdo, $actor, $order, $item, -(int) $item['quantity'], 'RESERVE');
        if ($quote['voucherId'] !== null) {
            $pdo->prepare('UPDATE vouchers SET used_count = used_count + 1 WHERE id = ?')->execute([$quote['voucherId']]);
            $pdo->prepare('INSERT INTO voucher_usages (voucher_id, customer_id, order_id) VALUES (?, ?, ?)')->execute([$quote['voucherId'], $actor['id'], $order['id']]);
        }
        $pdo->prepare('DELETE FROM cart_items WHERE cart_id = ?')->execute([$quote['cartId']]);
        $pdo->prepare('UPDATE carts SET version = version + 1 WHERE id = ?')->execute([$quote['cartId']]);
    }

    public function release(\PDO $pdo, array $actor, array $order, array $items): void
    {
        if ($order['voucher_id'] !== null) {
            $lock = $pdo->prepare('SELECT id FROM vouchers WHERE id = ? FOR UPDATE'); $lock->execute([$order['voucher_id']]);
            $query = $pdo->prepare('UPDATE voucher_usages SET released_at = UTC_TIMESTAMP() WHERE order_id = ? AND released_at IS NULL'); $query->execute([$order['id']]);
            if ($query->rowCount() === 1) $pdo->prepare('UPDATE vouchers SET used_count = used_count - 1 WHERE id = ? AND used_count > 0')->execute([$order['voucher_id']]);
        }
        usort($items, fn ($a, $b) => (int) $a['variant_id'] <=> (int) $b['variant_id']);
        foreach ($items as $item) $this->move($pdo, $actor, $order, $item, (int) $item['quantity'], 'RELEASE');
    }

    private function move(\PDO $pdo, array $actor, array $order, array $item, int $change, string $kind): void
    {
        $query = $pdo->prepare('SELECT stock_quantity FROM product_variants WHERE id = ? FOR UPDATE'); $query->execute([$item['variant_id']]);
        $before = $query->fetchColumn();
        if ($before === false || (int) $before + $change < 0) throw new ApiException(409, 'OUT_OF_STOCK', 'Tồn kho đã thay đổi.');
        $pdo->prepare('UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?')->execute([$change, $item['variant_id']]);
        $pdo->prepare('INSERT INTO inventory_movements (variant_id, order_item_id, movement_type, quantity_change, quantity_before, quantity_after, reference_code, note, performed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')->execute([$item['variant_id'], $item['id'], $kind, $change, $before, (int) $before + $change, 'ORDER-' . $order['id'] . '-ITEM-' . $item['id'] . '-' . $kind, 'Checkout reservation/release', $actor['id']]);
    }

    public function reorder(\PDO $pdo, array $actor, array $order, array $items, array $input): array
    {
        $pdo->prepare('INSERT INTO carts (user_id) VALUES (?) ON DUPLICATE KEY UPDATE is_deleted = 0')->execute([$actor['id']]);
        $query = $pdo->prepare('SELECT id, version FROM carts WHERE user_id = ? FOR UPDATE'); $query->execute([$actor['id']]); $cart = $query->fetch(\PDO::FETCH_ASSOC);
        if ((int) $cart['version'] !== $input['expectedCartVersion']) throw new ApiException(409, 'CART_VERSION_CONFLICT', 'Giỏ hàng đã thay đổi.');
        $query = $pdo->prepare('SELECT variant_id, quantity FROM cart_items WHERE cart_id = ? AND is_deleted = 0'); $query->execute([$cart['id']]);
        $merged = [];
        foreach ($query->fetchAll(\PDO::FETCH_ASSOC) as $line) $merged[$line['variant_id']] = (int) $line['quantity'];
        foreach ($items as $item) $merged[$item['variant_id']] = ($merged[$item['variant_id']] ?? 0) + (int) $item['quantity'];
        if (count($merged) > 100) throw new ApiException(422, 'CART_TOO_LARGE', 'Giỏ hàng tối đa 100 SKU.');
        ksort($merged, SORT_NUMERIC);
        $pdo->prepare('DELETE FROM cart_items WHERE cart_id = ?')->execute([$cart['id']]);
        $insert = $pdo->prepare('INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES (?, ?, ?)');
        foreach ($merged as $sku => $quantity) $insert->execute([$cart['id'], $sku, $quantity]);
        $result = $this->cart($pdo, $actor, true, true);
        $pdo->prepare('UPDATE carts SET version = version + 1 WHERE id = ?')->execute([$cart['id']]);
        $result['cartVersion']++;
        return $result;
    }
}
