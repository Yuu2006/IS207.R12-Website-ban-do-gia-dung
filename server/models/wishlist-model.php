<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

// CUS-11: one soft-deletable wishlist row per (customer, product); reads only active catalog data.
final class WishlistModel
{
    public function __construct(private readonly \PDO $db) {}

    // One row per saved product (not per SKU/image), with the cheapest current price and total active stock.
    public function getByUserId(int $userId): array
    {
        $statement = $this->db->prepare("SELECT w.id AS wishlist_id, w.product_id, w.created_at, p.name, p.slug, p.product_code,
                (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = 1 AND pi.is_deleted = 0 ORDER BY pi.id DESC LIMIT 1) AS image_url,
                MIN(CASE WHEN v.sale_price IS NOT NULL AND (v.sale_starts_at IS NULL OR v.sale_starts_at <= UTC_TIMESTAMP())
                    AND (v.sale_ends_at IS NULL OR v.sale_ends_at >= UTC_TIMESTAMP()) AND v.sale_price < v.price THEN v.sale_price ELSE v.price END) AS min_price,
                COALESCE(SUM(v.stock_quantity), 0) AS total_stock, COUNT(v.id) AS variant_count
            FROM wishlists w
            JOIN products p ON p.id = w.product_id AND p.is_active = 1 AND p.is_deleted = 0
            LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_active = 1 AND v.is_deleted = 0
            WHERE w.user_id = ? AND w.is_deleted = 0
            GROUP BY w.id, w.product_id, w.created_at, p.id, p.name, p.slug, p.product_code
            ORDER BY w.created_at DESC, w.id DESC");
        $statement->execute([$userId]);
        return $statement->fetchAll(\PDO::FETCH_ASSOC);
    }

    public function activeProductExists(int $productId): bool
    {
        $statement = $this->db->prepare('SELECT 1 FROM products WHERE id = ? AND is_active = 1 AND is_deleted = 0');
        $statement->execute([$productId]);
        return $statement->fetchColumn() !== false;
    }

    // Re-adding a removed product restores the same row instead of inserting a duplicate.
    public function add(int $userId, int $productId): void
    {
        $this->db->prepare('INSERT INTO wishlists (user_id, product_id, is_deleted) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE is_deleted = 0, updated_at = CURRENT_TIMESTAMP')
            ->execute([$userId, $productId]);
    }

    public function remove(int $userId, int $productId): void
    {
        $this->db->prepare('UPDATE wishlists SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND product_id = ? AND is_deleted = 0')
            ->execute([$userId, $productId]);
    }

    public function exists(int $userId, int $productId): bool
    {
        $statement = $this->db->prepare('SELECT 1 FROM wishlists WHERE user_id = ? AND product_id = ? AND is_deleted = 0 LIMIT 1');
        $statement->execute([$userId, $productId]);
        return $statement->fetchColumn() !== false;
    }

    // The SKU must belong to the saved product so "move to cart" cannot add an unrelated item.
    public function skuBelongsToProduct(int $skuId, int $productId): bool
    {
        $statement = $this->db->prepare('SELECT 1 FROM product_variants WHERE id = ? AND product_id = ? AND is_deleted = 0');
        $statement->execute([$skuId, $productId]);
        return $statement->fetchColumn() !== false;
    }
}
