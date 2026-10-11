<?php

require_once __DIR__ . '/../config/database.php';

function getProducts(array $filters = []): array
{
    $pdo = db();

    $sql = "
        SELECT
            p.id,
            p.product_code,
            p.name,
            p.slug,
            p.description,
            p.specifications,
            p.warranty_months,
            p.is_active,
            c.id AS category_id,
            c.name AS category_name,
            b.id AS brand_id,
            b.name AS brand_name,
            COALESCE(v.variant_count, 0) AS variant_count,
            COALESCE(v.min_price, 0) AS min_price,
            COALESCE(v.total_stock, 0) AS total_stock
        FROM products p
        INNER JOIN categories c ON c.id = p.category_id
        INNER JOIN brands b ON b.id = p.brand_id
        LEFT JOIN (
            SELECT
                product_id,
                COUNT(*) AS variant_count,
                MIN(
        CASE
        WHEN sale_price IS NOT NULL
         AND (sale_starts_at IS NULL OR sale_starts_at <= NOW())
         AND (sale_ends_at IS NULL OR sale_ends_at >= NOW())
         AND sale_price < price
        THEN sale_price
        ELSE price
    END
) AS min_price,
                SUM(stock_quantity) AS total_stock
            FROM product_variants
            WHERE is_deleted = 0 AND is_active = 1
            GROUP BY product_id
        ) v ON v.product_id = p.id
        WHERE p.is_deleted = 0
    ";

    $params = [];

    if (!empty($filters['keyword'])) {
        $sql .= " AND (p.name LIKE :keyword OR p.product_code LIKE :keyword)";
        $params['keyword'] = '%' . $filters['keyword'] . '%';
    }

    if (!empty($filters['category_id'])) {
        $sql .= " AND p.category_id = :category_id";
        $params['category_id'] = (int) $filters['category_id'];
    }

    if (!empty($filters['brand_id'])) {
        $sql .= " AND p.brand_id = :brand_id";
        $params['brand_id'] = (int) $filters['brand_id'];
    }

    if (isset($filters['is_active']) && $filters['is_active'] !== '') {
        $sql .= " AND p.is_active = :is_active";
        $params['is_active'] = (int) $filters['is_active'];
    }

    $sql .= " ORDER BY p.created_at DESC, p.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function getProductById(int $id): ?array
{
    $pdo = db();

    $stmt = $pdo->prepare("
        SELECT
            p.*,
            c.name AS category_name,
            b.name AS brand_name
        FROM products p
        INNER JOIN categories c ON c.id = p.category_id
        INNER JOIN brands b ON b.id = p.brand_id
        WHERE p.id = :id AND p.is_deleted = 0
        LIMIT 1
    ");

    $stmt->execute(['id' => $id]);
    $product = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$product) {
        return null;
    }

    $stmt = $pdo->prepare("
       SELECT
    id,
    sku,
    variant_name,
    price,
        CASE
        WHEN sale_price IS NOT NULL
         AND (sale_starts_at IS NULL OR sale_starts_at <= NOW())
         AND (sale_ends_at IS NULL OR sale_ends_at >= NOW())
         AND sale_price < price
        THEN sale_price
        ELSE price
    END AS effective_price,
    sale_price,
    sale_starts_at,
    sale_ends_at,
    stock_quantity,
    low_stock_threshold,
    is_active
FROM product_variants
WHERE product_id = :product_id
  AND is_deleted = 0
  AND is_active = 1
ORDER BY id
    ");

    $stmt->execute(['product_id' => $id]);
    $product['variants'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    return $product;
}

function updateProduct(int $id, array $input): bool
{
    $pdo = db();

    $allowedFields = [
        'category_id',
        'brand_id',
        'product_code',
        'name',
        'slug',
        'description',
        'specifications',
        'warranty_months',
        'is_active',
    ];

    $updates = [];
    $params = ['id' => $id];

    foreach ($allowedFields as $field) {
        if (!array_key_exists($field, $input)) {
            continue;
        }

        $updates[] = "`{$field}` = :{$field}";

        if ($field === 'specifications' && is_array($input[$field])) {
            $params[$field] = json_encode(
                $input[$field],
                JSON_UNESCAPED_UNICODE
            );
        } else {
            $params[$field] = $input[$field];
        }
    }

    if (empty($updates)) {
        return false;
    }

    $sql = "UPDATE products
            SET " . implode(', ', $updates) . "
            WHERE id = :id AND is_deleted = 0";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    return $stmt->rowCount() > 0;
}
function deleteProduct(int $id): bool
{
    $pdo = db();

    try {
        $pdo->beginTransaction();

        // Soft-delete san pham
        $stmt = $pdo->prepare("
            UPDATE products
            SET is_deleted = 1,
                is_active = 0
            WHERE id = :id
              AND is_deleted = 0
        ");
        $stmt->execute(['id' => $id]);

        if ($stmt->rowCount() === 0) {
            $pdo->rollBack();
            return false;
        }

        // Ngung hoat dong va soft-delete cac bien the
        $stmt = $pdo->prepare("
            UPDATE product_variants
            SET is_deleted = 1,
                is_active = 0
            WHERE product_id = :product_id
              AND is_deleted = 0
        ");
        $stmt->execute(['product_id' => $id]);

        $pdo->commit();
        return true;
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        throw $e;
    }
}
