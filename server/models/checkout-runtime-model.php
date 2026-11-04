<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class CheckoutRuntimeModel
{
    public function __construct(private readonly \PDO $pdo) {}

    // Read or lock the customer's one active cart row; versioning is added by migration 013.
    public function cart(string $customerId, bool $lock = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT id, cart_version FROM carts WHERE user_id = ? AND is_deleted = 0' . ($lock ? ' FOR UPDATE' : ''));
        $statement->execute([$customerId]);
        $cart = $statement->fetch(\PDO::FETCH_ASSOC);
        return $cart ?: null;
    }

    // Ensure a cart exists inside the caller transaction, then lock it before any line or SKU rows.
    public function ensureLockedCart(string $customerId): array
    {
        if (!$this->pdo->inTransaction()) throw new \LogicException('Cart creation requires the order transaction.');
        $statement = $this->pdo->prepare('INSERT INTO carts (user_id, cart_version, is_deleted) VALUES (?, 1, 0) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)');
        $statement->execute([$customerId]);
        $cart = $this->cart($customerId, true);
        if (!$cart) throw new ApiException(409, 'CART_NOT_AVAILABLE', 'Giỏ hàng hiện không khả dụng.');
        return $cart;
    }

    // Cart mutations lock the parent cart first, so item locks follow one stable SKU order.
    public function cartLines(string $cartId, bool $lock = false): array
    {
        $statement = $this->pdo->prepare('SELECT variant_id, quantity FROM cart_items WHERE cart_id = ? AND is_deleted = 0 ORDER BY variant_id' . ($lock ? ' FOR UPDATE' : ''));
        $statement->execute([$cartId]);
        return $statement->fetchAll(\PDO::FETCH_ASSOC);
    }

    // Set the already-validated merged quantity, reviving an older soft-deleted SKU row when needed.
    public function setCartItemQuantity(string $cartId, string $variantId, int $quantity): void
    {
        $statement = $this->pdo->prepare('INSERT INTO cart_items (cart_id, variant_id, quantity, is_deleted) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), is_deleted = 0');
        $statement->execute([$cartId, $variantId, $quantity]);
    }

    // Advance the cart version once after every item in a reorder was merged successfully.
    public function incrementCartVersion(string $cartId, int $expectedVersion): void
    {
        if ($expectedVersion >= MAX_ORDER_INTEGER) throw new ApiException(409, 'CART_VERSION_CONFLICT', 'Phiên bản giỏ hàng đã đạt giới hạn an toàn.');
        $statement = $this->pdo->prepare('UPDATE carts SET cart_version = cart_version + 1 WHERE id = ? AND cart_version = ? AND is_deleted = 0');
        $statement->execute([$cartId, $expectedVersion]);
        if ($statement->rowCount() !== 1) throw new ApiException(409, 'CART_VERSION_CONFLICT', 'Giỏ hàng đã thay đổi. Hãy tải lại.');
    }

    // Customer ownership is part of the query and a write checkout holds the address row stable.
    public function address(string $addressId, string $customerId, bool $lock = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT id, recipient_name, phone, address_line, ward, district, province FROM addresses WHERE id = ? AND user_id = ? AND is_deleted = 0' . ($lock ? ' FOR UPDATE' : ''));
        $statement->execute([$addressId, $customerId]);
        $address = $statement->fetch(\PDO::FETCH_ASSOC);
        return $address ?: null;
    }

    // A voucher row serializes both global and per-customer reservation counts.
    public function voucherByCode(string $code, bool $lock = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT v.*, (v.starts_at <= UTC_TIMESTAMP() AND v.ends_at >= UTC_TIMESTAMP()) AS is_in_window FROM vouchers v WHERE UPPER(v.code) = UPPER(?) AND v.is_deleted = 0' . ($lock ? ' FOR UPDATE' : ''));
        $statement->execute([$code]);
        $voucher = $statement->fetch(\PDO::FETCH_ASSOC);
        return $voucher ?: null;
    }

    // Cancellation also needs to release a voucher that has since been disabled or expired.
    public function voucherById(string $voucherId, bool $lock = false): ?array
    {
        $statement = $this->pdo->prepare('SELECT id, used_count FROM vouchers WHERE id = ?' . ($lock ? ' FOR UPDATE' : ''));
        $statement->execute([$voucherId]);
        $voucher = $statement->fetch(\PDO::FETCH_ASSOC);
        return $voucher ?: null;
    }

    // Locking reads see committed reservations after the caller has locked the voucher row.
    public function lockVoucherReservations(string $voucherId, string $customerId): array
    {
        $statement = $this->pdo->prepare("SELECT id FROM voucher_redemptions WHERE voucher_id = ? AND customer_id = ? AND status = 'RESERVED' ORDER BY id FOR UPDATE");
        $statement->execute([$voucherId, $customerId]);
        return $statement->fetchAll(\PDO::FETCH_ASSOC);
    }

    // Load current active SKU/product data in ascending variant ID for quote or reservation.
    public function variants(array $lines, bool $lock = false): array
    {
        $ids = array_values(array_unique(array_map(static fn ($line) => (string) $line['variant_id'], $lines)));
        if ($ids === []) return [];
        sort($ids, SORT_NUMERIC);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $sql = "SELECT v.id, v.sku, v.variant_name, v.price, v.sale_price, v.sale_starts_at, v.sale_ends_at, v.stock_quantity,
                       p.name AS product_name, p.warranty_months,
                       (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_deleted = 0 ORDER BY pi.is_primary DESC, pi.sort_order, pi.id LIMIT 1) AS image_url
                FROM product_variants v
                JOIN products p ON p.id = v.product_id
                WHERE v.id IN ({$placeholders}) AND v.is_active = 1 AND v.is_deleted = 0 AND p.is_active = 1 AND p.is_deleted = 0
                ORDER BY v.id" . ($lock ? ' FOR UPDATE' : '');
        $statement = $this->pdo->prepare($sql);
        $statement->execute($ids);
        $rows = $statement->fetchAll(\PDO::FETCH_ASSOC);
        $result = [];
        foreach ($rows as $row) $result[(string) $row['id']] = $row;
        return $result;
    }

    // Snapshot cart data uses current active-sale prices; checkout still validates stock separately.
    public function cartSnapshot(string $customerId): array
    {
        $cart = $this->cart($customerId);
        if ($cart === null) return ['cartVersion' => 1, 'items' => []];
        $lines = $this->cartLines((string) $cart['id']);
        $variants = $this->variants($lines);
        if (count($variants) !== count($lines)) throw new ApiException(409, 'CART_ITEM_UNAVAILABLE', 'Một sản phẩm trong giỏ không còn được bán. Hãy cập nhật giỏ hàng.');
        return ['cartVersion' => (int) $cart['cart_version'], 'items' => $this->mapItems($lines, $variants, false)];
    }

    // Atomically decrement one available SKU and append its immutable stock movement.
    public function reserveStock(array $actor, array $order, array $item): void
    {
        $variantId = (string) $item['variant_id'];
        $before = $this->stockForUpdate($variantId);
        $quantity = (int) $item['quantity'];
        if ($before < $quantity) throw new ApiException(409, 'OUT_OF_STOCK', 'Sản phẩm vừa hết hàng. Hãy tải lại giỏ hàng.');
        $statement = $this->pdo->prepare('UPDATE product_variants SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ? AND is_active = 1 AND is_deleted = 0');
        $statement->execute([$quantity, $variantId, $quantity]);
        if ($statement->rowCount() !== 1) throw new ApiException(409, 'OUT_OF_STOCK', 'Sản phẩm vừa hết hàng. Hãy tải lại giỏ hàng.');
        $this->insertMovement($actor, $order, $item, -$quantity, $before, $before - $quantity, 'RESERVE');
    }

    // Return only an order's tracked reservation; the order transaction makes this idempotent.
    public function releaseStock(array $actor, array $order, array $item): void
    {
        $variantId = (string) $item['variant_id'];
        $before = $this->stockForUpdate($variantId);
        $quantity = (int) $item['quantity'];
        if ($before > 4294967295 - $quantity) throw new ApiException(409, 'INVENTORY_CONFLICT', 'Số lượng tồn vượt giới hạn lưu trữ.');
        $statement = $this->pdo->prepare('UPDATE product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?');
        $statement->execute([$quantity, $variantId]);
        if ($statement->rowCount() !== 1) throw new ApiException(409, 'INVENTORY_CONFLICT', 'Không thể hoàn lại reservation kho.');
        $this->insertMovement($actor, $order, $item, $quantity, $before, $before + $quantity, 'RELEASE');
    }

    // Fetch the locked quantity so movement before/after values match the same transaction.
    private function stockForUpdate(string $variantId): int
    {
        if (!$this->pdo->inTransaction()) throw new \LogicException('Stock mutation requires the checkout transaction.');
        $statement = $this->pdo->prepare('SELECT stock_quantity FROM product_variants WHERE id = ? FOR UPDATE');
        $statement->execute([$variantId]);
        $stock = $statement->fetchColumn();
        if ($stock === false) throw new ApiException(409, 'INVENTORY_CONFLICT', 'SKU không còn trong kho.');
        return (int) $stock;
    }

    // A unique reference makes a repeated reserve/release fail and roll back instead of double-moving stock.
    private function insertMovement(array $actor, array $order, array $item, int $delta, int $before, int $after, string $kind): void
    {
        $statement = $this->pdo->prepare('INSERT INTO inventory_movements (variant_id, order_item_id, movement_type, quantity_change, quantity_before, quantity_after, reference_code, performed_by, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
        $statement->execute([$item['variant_id'], $item['id'], $kind, $delta, $before, $after, $kind . ':' . $order['id'] . ':' . $item['id'], $actor['id'], $kind === 'RESERVE' ? 'Giữ tồn khi tạo đơn COD' : 'Hoàn tồn khi hủy đơn']);
    }

    // Cart is cleared only after order, payment, history, stock and voucher writes have succeeded.
    public function clearCartAfterCheckout(string $cartId, int $expectedVersion): void
    {
        $statement = $this->pdo->prepare('UPDATE cart_items SET is_deleted = 1 WHERE cart_id = ? AND is_deleted = 0');
        $statement->execute([$cartId]);
        $statement = $this->pdo->prepare('UPDATE carts SET cart_version = cart_version + 1 WHERE id = ? AND cart_version = ? AND is_deleted = 0');
        $statement->execute([$cartId, $expectedVersion]);
        if ($statement->rowCount() !== 1) throw new ApiException(409, 'CART_VERSION_CONFLICT', 'Giỏ hàng đã thay đổi. Hãy xác nhận lại.');
    }

    // Recheck the global cap in SQL even though the voucher row is already locked.
    public function reserveVoucher(string $voucherId, string $customerId, string $orderId): void
    {
        $statement = $this->pdo->prepare('UPDATE vouchers SET used_count = used_count + 1 WHERE id = ? AND is_active = 1 AND is_deleted = 0 AND (usage_limit IS NULL OR used_count < usage_limit)');
        $statement->execute([$voucherId]);
        if ($statement->rowCount() !== 1) throw new ApiException(409, 'VOUCHER_EXHAUSTED', 'Mã ưu đãi vừa hết lượt sử dụng.');
        $statement = $this->pdo->prepare("INSERT INTO voucher_redemptions (voucher_id, customer_id, order_id, status) VALUES (?, ?, ?, 'RESERVED')");
        $statement->execute([$voucherId, $customerId, $orderId]);
    }

    // Cancellation releases a voucher slot once and preserves the audit row.
    public function releaseVoucher(array $order): void
    {
        $statement = $this->pdo->prepare("SELECT id, voucher_id FROM voucher_redemptions WHERE order_id = ? AND status = 'RESERVED' FOR UPDATE");
        $statement->execute([$order['id']]);
        $redemption = $statement->fetch(\PDO::FETCH_ASSOC);
        if (!$redemption || (string) $redemption['voucher_id'] !== (string) $order['voucher_id']) throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Không tìm thấy lượt voucher đã giữ cho đơn này.');
        $statement = $this->pdo->prepare('UPDATE vouchers SET used_count = used_count - 1 WHERE id = ? AND used_count > 0');
        $statement->execute([$redemption['voucher_id']]);
        if ($statement->rowCount() !== 1) throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Bộ đếm voucher không khớp lịch sử sử dụng.');
        $statement = $this->pdo->prepare("UPDATE voucher_redemptions SET status = 'RELEASED', released_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'RESERVED'");
        $statement->execute([$redemption['id']]);
        if ($statement->rowCount() !== 1) throw new ApiException(409, 'VOUCHER_CONFLICT', 'Lượt voucher đã được xử lý.');
    }

    // Format trusted catalog values into the checkout contract after price and stock checks.
    public function mapItems(array $lines, array $variants, bool $checkStock): array
    {
        $items = [];
        foreach ($lines as $line) {
            $id = (string) $line['variant_id'];
            $variant = $variants[$id] ?? null;
            if (!$variant) throw new ApiException(409, 'CART_ITEM_UNAVAILABLE', 'Một sản phẩm trong giỏ không còn được bán. Hãy cập nhật giỏ hàng.');
            $quantity = (int) $line['quantity'];
            if ($quantity < 1 || $quantity > 4294967295) throw new ApiException(409, 'CART_DATA_INCOMPATIBLE', 'Số lượng trong giỏ không hợp lệ.');
            if ($checkStock && (int) $variant['stock_quantity'] < $quantity) throw new ApiException(409, 'OUT_OF_STOCK', 'Số lượng tồn không đủ cho sản phẩm trong giỏ.');
            $saleStart = $variant['sale_starts_at'];
            $saleEnd = $variant['sale_ends_at'];
            $now = time();
            $onSale = $variant['sale_price'] !== null
                && ($saleStart === null || strtotime($saleStart . ' UTC') <= $now)
                && ($saleEnd === null || strtotime($saleEnd . ' UTC') >= $now);
            $price = orderMoney($onSale ? $variant['sale_price'] : $variant['price']);
            if ($price <= 0) throw new ApiException(503, 'CATALOG_DATA_INCOMPATIBLE', 'Giá SKU không hợp lệ.');
            $items[] = [
                'skuId' => $id,
                'skuCode' => $variant['sku'],
                'productName' => $variant['product_name'],
                'variantName' => $variant['variant_name'],
                'unitPrice' => $price,
                'quantity' => $quantity,
                'warrantyMonths' => (int) $variant['warranty_months'],
                'imageUrl' => $variant['image_url'] ?? '',
            ];
        }
        return $items;
    }
}
