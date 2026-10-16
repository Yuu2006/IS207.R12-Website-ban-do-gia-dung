<?php
declare(strict_types=1);

// Truy vấn quản trị SKU, ảnh đại diện và định nghĩa thông số (PRD-04/05/06, ADM-PRO-03).
class CatalogAdminModel
{
    private const VARIANT_COLUMNS = 'id, product_id, sku, variant_name, price, sale_price, sale_starts_at, sale_ends_at, stock_quantity, low_stock_threshold, is_active';

    public function __construct(private PDO $pdo) {}

    public function productExists(int $id): bool
    {
        $stmt = $this->pdo->prepare('SELECT 1 FROM products WHERE id = ? AND is_deleted = 0');
        $stmt->execute([$id]);
        return (bool) $stmt->fetchColumn();
    }

    public function categoryExists(int $id): bool
    {
        $stmt = $this->pdo->prepare('SELECT 1 FROM categories WHERE id = ? AND is_deleted = 0');
        $stmt->execute([$id]);
        return (bool) $stmt->fetchColumn();
    }

    // Admin thấy cả SKU ngừng bán để bật lại; SKU đã xóa mềm bị ẩn.
    public function variants(int $productId): array
    {
        $stmt = $this->pdo->prepare('SELECT ' . self::VARIANT_COLUMNS . ' FROM product_variants WHERE product_id = ? AND is_deleted = 0 ORDER BY id');
        $stmt->execute([$productId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function variant(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT ' . self::VARIANT_COLUMNS . ' FROM product_variants WHERE id = ? AND is_deleted = 0');
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    // SKU mới luôn tồn 0: số tồn chỉ đổi qua inventory_movements để luôn có log.
    public function insertVariant(int $productId, array $values): int
    {
        $stmt = $this->pdo->prepare('INSERT INTO product_variants (product_id, sku, variant_name, price, sale_price, sale_starts_at, sale_ends_at, low_stock_threshold, is_active, stock_quantity) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)');
        $stmt->execute([$productId, $values['sku'], $values['variant_name'], $values['price'], $values['sale_price'], $values['sale_starts_at'], $values['sale_ends_at'], $values['low_stock_threshold'], (int) $values['is_active']]);
        return (int) $this->pdo->lastInsertId();
    }

    public function updateVariant(int $id, array $values): void
    {
        $stmt = $this->pdo->prepare('UPDATE product_variants SET variant_name = ?, price = ?, sale_price = ?, sale_starts_at = ?, sale_ends_at = ?, low_stock_threshold = ?, is_active = ? WHERE id = ? AND is_deleted = 0');
        $stmt->execute([$values['variant_name'], $values['price'], $values['sale_price'], $values['sale_starts_at'], $values['sale_ends_at'], $values['low_stock_threshold'], (int) $values['is_active'], $id]);
    }

    // Khóa dòng sản phẩm để thao tác ảnh đồng thời không tạo hai ảnh đại diện.
    public function transactionOnProduct(int $productId, callable $work): mixed
    {
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare('SELECT id FROM products WHERE id = ? AND is_deleted = 0 FOR UPDATE');
            $stmt->execute([$productId]);
            $result = $stmt->fetchColumn() ? $work() : null;
            $this->pdo->commit();
            return $result;
        } catch (Throwable $error) {
            $this->pdo->rollBack();
            throw $error;
        }
    }

    public function images(int $productId): array
    {
        $stmt = $this->pdo->prepare('SELECT id, image_url, is_primary, sort_order FROM product_images WHERE product_id = ? AND is_deleted = 0 ORDER BY is_primary DESC, sort_order, id');
        $stmt->execute([$productId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function image(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT id, product_id, image_url, is_primary, sort_order FROM product_images WHERE id = ? AND is_deleted = 0');
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    public function insertImage(int $productId, string $url, int $sortOrder): int
    {
        $this->pdo->prepare('INSERT INTO product_images (product_id, image_url, is_primary, sort_order) VALUES (?, ?, 0, ?)')->execute([$productId, $url, $sortOrder]);
        return (int) $this->pdo->lastInsertId();
    }

    public function updateImageOrder(int $id, int $sortOrder): void
    {
        $this->pdo->prepare('UPDATE product_images SET sort_order = ? WHERE id = ?')->execute([$sortOrder, $id]);
    }

    // Đúng một ảnh đại diện: bật ảnh được chọn, tắt mọi ảnh còn lại của sản phẩm.
    public function makePrimary(int $productId, int $imageId): void
    {
        $this->pdo->prepare('UPDATE product_images SET is_primary = (id = ?) WHERE product_id = ? AND is_deleted = 0')->execute([$imageId, $productId]);
    }

    public function softDeleteImage(int $id): void
    {
        $this->pdo->prepare('UPDATE product_images SET is_deleted = 1, is_primary = 0 WHERE id = ?')->execute([$id]);
    }

    public function insertAttribute(int $categoryId, array $values): int
    {
        $stmt = $this->pdo->prepare('INSERT INTO product_attributes (category_id, name, attribute_key, data_type, unit, is_required) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([$categoryId, $values['name'], $values['attribute_key'], $values['data_type'], $values['unit'], (int) $values['is_required']]);
        return (int) $this->pdo->lastInsertId();
    }

    public function banners(): array
    {
        return $this->pdo->query('SELECT id, title, image_url, target_url, starts_at, ends_at, sort_order, is_active FROM banners WHERE is_deleted = 0 ORDER BY sort_order, id DESC')->fetchAll(PDO::FETCH_ASSOC);
    }
}
