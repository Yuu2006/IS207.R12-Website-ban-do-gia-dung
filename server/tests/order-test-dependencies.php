<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

if (PHP_SAPI !== 'cli' || getenv('ORDER_MYSQL_TEST') !== 'isolated') { http_response_code(404); exit; }

// SQL adapter for isolated tests ONLY. No production auth/cart/voucher/kho endpoint imports it.
final class SqlTestCheckoutDependencies implements CheckoutDependencies
{
    public bool $failAfterReserve = false;

    public function quote(\PDO $pdo, array $principal, array $input): array { return $this->read($pdo, $principal, $input, false); }
    public function lockForCreate(\PDO $pdo, array $principal, array $input): array { return $this->read($pdo, $principal, $input, true); }

    // Test-only cart_version lives in test_cart_versions, not a migration owned by Vĩ.
    private function read(\PDO $pdo, array $principal, array $input, bool $lock): array
    {
        $suffix = $lock ? ' FOR UPDATE' : '';
        $statement = $pdo->prepare('SELECT c.id, v.version FROM carts c JOIN test_cart_versions v ON v.cart_id = c.id WHERE c.user_id = ?' . $suffix);
        $statement->execute([$principal['id']]);
        $cart = $statement->fetch();
        if (!$cart || (int) $cart['version'] !== $input['cartVersion']) throw new ApiException(409, 'CART_VERSION_CONFLICT', 'Cart changed.');
        $statement = $pdo->prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ? AND is_deleted = 0' . $suffix);
        $statement->execute([$input['addressId'], $principal['id']]);
        $address = $statement->fetch();
        if (!$address) throw new ApiException(404, 'ADDRESS_NOT_FOUND', 'Unknown address.');
        if ($input['voucherCode'] !== null) throw new ApiException(422, 'VOUCHER_INVALID', 'Voucher adapter pending owner mapping.');
        $statement = $pdo->prepare('SELECT * FROM cart_items WHERE cart_id = ? AND is_deleted = 0 ORDER BY variant_id' . $suffix);
        $statement->execute([$cart['id']]);
        $lines = $statement->fetchAll();
        if (!$lines) throw new ApiException(422, 'EMPTY_CART', 'Cart empty.');
        $items = [];
        $subtotal = 0;
        foreach ($lines as $line) {
            $statement = $pdo->prepare('SELECT v.*, p.name, p.warranty_months FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = ? AND v.is_active = 1 AND v.is_deleted = 0 AND p.is_active = 1 AND p.is_deleted = 0' . $suffix);
            $statement->execute([$line['variant_id']]);
            $sku = $statement->fetch();
            if (!$sku || (int) $sku['stock_quantity'] < (int) $line['quantity']) throw new ApiException(409, 'OUT_OF_STOCK', 'Stock unavailable.');
            $price = orderMoney($sku['price']);
            $subtotal += orderLineTotal($price, (int) $line['quantity']);
            $items[] = ['skuId' => (string) $sku['id'], 'skuCode' => $sku['sku'], 'productName' => $sku['name'], 'variantName' => $sku['variant_name'], 'unitPrice' => $price, 'quantity' => (int) $line['quantity'], 'warrantyMonths' => (int) $sku['warranty_months'], 'imageUrl' => ''];
        }
        // Explicit fixture policy, NOT a production shipping-fee approval.
        $shipping = $subtotal >= 500000 ? 0 : 30000;
        return ['cartVersion' => (int) $cart['version'], 'cartId' => (string) $cart['id'], 'voucherId' => null, 'items' => $items, 'shippingAddress' => ['recipientName' => $address['recipient_name'], 'phone' => $address['phone'], 'addressLine' => $address['address_line'] . ', ' . $address['province']], 'totals' => ['subtotal' => $subtotal, 'discount' => 0, 'shipping' => $shipping, 'total' => $subtotal + $shipping]];
    }

    // Decrement + unique movement + cart clear/version all remain inside service transaction.
    public function commitCheckout(\PDO $pdo, array $principal, array $quote, array $order): void
    {
        $model = new OrderModel($pdo);
        foreach ($model->itemsFor([(string) $order['id']])[(string) $order['id']] as $item) $this->move($pdo, $principal, $order, $item, -(int) $item['quantity'], 'RESERVE');
        if ($this->failAfterReserve) throw new \RuntimeException('Injected failure after reservation.');
        $statement = $pdo->prepare('DELETE FROM cart_items WHERE cart_id = ?');
        $statement->execute([$quote['cartId']]);
        $statement = $pdo->prepare('UPDATE test_cart_versions SET version = version + 1 WHERE cart_id = ? AND version = ?');
        $statement->execute([$quote['cartId'], $quote['cartVersion']]);
        if ($statement->rowCount() !== 1) throw new ApiException(409, 'CART_VERSION_CONFLICT', 'Cart changed.');
    }

    // Restore precisely the reserved quantity; state/version locking is enforced by OrderService.
    public function release(\PDO $pdo, array $principal, array $order, array $items): void
    {
        usort($items, fn ($a, $b) => (int) $a['variant_id'] <=> (int) $b['variant_id']);
        foreach ($items as $item) $this->move($pdo, $principal, $order, $item, (int) $item['quantity'], 'RELEASE');
    }

    private function move(\PDO $pdo, array $actor, array $order, array $item, int $delta, string $kind): void
    {
        $statement = $pdo->prepare('SELECT stock_quantity FROM product_variants WHERE id = ? FOR UPDATE');
        $statement->execute([$item['variant_id']]);
        $before = $statement->fetchColumn();
        if ($before === false || (int) $before + $delta < 0) throw new ApiException(409, 'OUT_OF_STOCK', 'Stock unavailable.');
        $statement = $pdo->prepare('UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ? AND stock_quantity >= ?');
        $statement->execute([$delta, $item['variant_id'], max(0, -$delta)]);
        if ($statement->rowCount() !== 1) throw new ApiException(409, 'OUT_OF_STOCK', 'Stock unavailable.');
        $statement = $pdo->prepare('INSERT INTO inventory_movements (variant_id, order_item_id, movement_type, quantity_change, quantity_before, quantity_after, reference_code, performed_by, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $statement->execute([$item['variant_id'], $item['id'], $kind, $delta, $before, (int) $before + $delta, $kind . ':' . $order['id'] . ':' . $item['id'], $actor['id'], 'Isolated test reservation']);
    }

    // Reorder deliberately refuses until the real current-SKU/cart owner adapter is mapped.
    public function reorder(\PDO $pdo, array $principal, array $order, array $items, array $input): array { throw new ApiException(503, 'DEPENDENCY_NOT_READY', 'Reorder mapping pending.'); }
}
