<?php
namespace HomeCare\OrderApi;
class WishlistModel
{
    private PDO $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    // Lấy danh sách sản phẩm yêu thích của khách hàng
    public function getByUserId(int $userId): array
    {
        $sql = "
            SELECT
                w.id AS wishlist_id,
                w.product_id,
                w.created_at,
                p.name,
                p.slug,
                p.product_code,
                p.description,
                pi.image_url,
                pv.id AS variant_id,
                pv.sku,
                pv.price,
                pv.sale_price,
                pv.stock_quantity
            FROM wishlists w
            JOIN products p
                ON p.id = w.product_id
            LEFT JOIN product_images pi
                ON pi.product_id = p.id
                AND pi.is_primary = 1
                AND pi.is_deleted = 0
            LEFT JOIN product_variants pv
                ON pv.product_id = p.id
                AND pv.is_active = 1
                AND pv.is_deleted = 0
            WHERE w.user_id = :user_id
                AND w.is_deleted = 0
                AND p.is_active = 1
                AND p.is_deleted = 0
            ORDER BY w.created_at DESC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute(['user_id' => $userId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Thêm sản phẩm vào wishlist
    public function add(int $userId, int $productId): bool
    {
        $sql = "
            INSERT INTO wishlists (user_id, product_id, is_deleted)
            VALUES (:user_id, :product_id, 0)
            ON DUPLICATE KEY UPDATE
                is_deleted = 0,
                updated_at = CURRENT_TIMESTAMP
        ";

        $stmt = $this->db->prepare($sql);

        return $stmt->execute([
            'user_id' => $userId,
            'product_id' => $productId
        ]);
    }

    // Xóa sản phẩm khỏi wishlist (xóa mềm)
    public function remove(int $userId, int $productId): bool
    {
        $sql = "
            UPDATE wishlists
            SET is_deleted = 1,
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = :user_id
                AND product_id = :product_id
                AND is_deleted = 0
        ";

        $stmt = $this->db->prepare($sql);

        return $stmt->execute([
            'user_id' => $userId,
            'product_id' => $productId
        ]);
    }

    // Kiểm tra sản phẩm có trong wishlist không
    public function exists(int $userId, int $productId): bool
    {
        $sql = "
            SELECT 1
            FROM wishlists
            WHERE user_id = :user_id
                AND product_id = :product_id
                AND is_deleted = 0
            LIMIT 1
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            'user_id' => $userId,
            'product_id' => $productId
        ]);

        return (bool) $stmt->fetchColumn();
    }
}
