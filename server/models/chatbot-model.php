<?php
declare(strict_types=1);

// Reads public, active catalog SKUs with their current effective price and stock count.
final class ChatbotModel
{
    public function __construct(private PDO $pdo) {}

    public function searchCatalog(string $query, ?string $categoryId, int $limit): array
    {
        $sql = "SELECT p.id AS product_id, p.name AS product_name, p.product_code, p.slug, p.warranty_months,
                c.id AS category_id, c.name AS category_name, b.name AS brand_name,
                (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = p.id AND pi.is_primary = 1 AND pi.is_deleted = 0 ORDER BY pi.id DESC LIMIT 1) AS image_url,
                v.id AS variant_id, v.sku, v.variant_name, v.stock_quantity,
                CASE WHEN v.sale_price IS NOT NULL AND (v.sale_starts_at IS NULL OR v.sale_starts_at <= UTC_TIMESTAMP())
                    AND (v.sale_ends_at IS NULL OR v.sale_ends_at >= UTC_TIMESTAMP()) AND v.sale_price < v.price THEN v.sale_price ELSE v.price END AS current_price,
                UTC_TIMESTAMP() AS checked_at
            FROM products p
            JOIN categories c ON c.id = p.category_id AND c.is_active = 1 AND c.is_deleted = 0
            JOIN brands b ON b.id = p.brand_id AND b.is_active = 1 AND b.is_deleted = 0
            JOIN product_variants v ON v.product_id = p.id AND v.is_active = 1 AND v.is_deleted = 0
            WHERE p.is_active = 1 AND p.is_deleted = 0";
        $parameters = [];
        if ($query !== '') {
            $pattern = '%' . strtr($query, ['=' => '==', '%' => '=%', '_' => '=_']) . '%';
            $sql .= " AND (p.name LIKE ? ESCAPE '=' OR p.product_code LIKE ? ESCAPE '=' OR v.sku LIKE ? ESCAPE '=' OR b.name LIKE ? ESCAPE '=' OR c.name LIKE ? ESCAPE '=')";
            array_push($parameters, $pattern, $pattern, $pattern, $pattern, $pattern);
        }
        if ($categoryId !== null) {
            $sql .= ' AND p.category_id = ?';
            $parameters[] = $categoryId;
        }
        $sql .= ' ORDER BY (v.stock_quantity > 0) DESC, p.name, v.id LIMIT ?';
        $statement = $this->pdo->prepare($sql);
        foreach ($parameters as $index => $value) $statement->bindValue($index + 1, $value, PDO::PARAM_STR);
        $statement->bindValue(count($parameters) + 1, $limit, PDO::PARAM_INT);
        $statement->execute();
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        $checkedAt = $rows[0]['checked_at'] ?? $this->pdo->query('SELECT UTC_TIMESTAMP()')->fetchColumn();
        return [
            'checkedAt' => str_replace(' ', 'T', (string) $checkedAt) . 'Z',
            'items' => array_map(static fn (array $row): array => [
                'productId' => (string) $row['product_id'], 'productName' => $row['product_name'],
                'productCode' => $row['product_code'], 'slug' => $row['slug'],
                'categoryId' => (string) $row['category_id'], 'categoryName' => $row['category_name'],
                'brandName' => $row['brand_name'], 'warrantyMonths' => $row['warranty_months'] === null ? null : (int) $row['warranty_months'],
                'imageUrl' => $row['image_url'], 'variantId' => (string) $row['variant_id'],
                'sku' => $row['sku'], 'variantName' => $row['variant_name'],
                'currentPrice' => (string) $row['current_price'], 'stockQuantity' => (int) $row['stock_quantity'],
                'availability' => (int) $row['stock_quantity'] > 0 ? 'IN_STOCK' : 'OUT_OF_STOCK',
                'href' => '/catalog/products/' . rawurlencode((string) $row['product_id']) . '?variantId=' . rawurlencode((string) $row['variant_id']),
            ], $rows),
        ];
    }
}
