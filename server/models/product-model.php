<?php

require_once __DIR__ . '/../config/database.php';

// $publicOnly: catalog công khai chỉ thấy sản phẩm đang bán; ADMIN truyền false để thấy cả sản phẩm ẩn.
function getProducts(array $filters = [], bool $publicOnly = false): array
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
            c.slug AS category_slug,
            b.id AS brand_id,
            b.name AS brand_name,
            COALESCE(v.variant_count, 0) AS variant_count,
            COALESCE(v.min_price, 0) AS min_price,
            COALESCE(v.total_stock, 0) AS total_stock,
            (SELECT pi.image_url FROM product_images pi
             WHERE pi.product_id = p.id AND pi.is_primary = 1 AND pi.is_deleted = 0
             ORDER BY pi.id DESC LIMIT 1) AS primary_image
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
        // PDO native prepare (config/database.php) không cho dùng lại một placeholder hai lần.
        $sql .= " AND (p.name LIKE :keyword_name OR p.product_code LIKE :keyword_code)";
        $params['keyword_name'] = $params['keyword_code'] = '%' . $filters['keyword'] . '%';
    }

    if (!empty($filters['category_id'])) {
        $sql .= " AND p.category_id = :category_id";
        $params['category_id'] = (int) $filters['category_id'];
    }

if (isset($filters['brand_id']) && $filters['brand_id'] !== '') {
    $brandIds = is_array($filters['brand_id'])
        ? $filters['brand_id']
        : explode(',', (string) $filters['brand_id']);

    $brandIds = array_values(array_unique(array_filter(
        array_map('intval', $brandIds),
        fn($id) => $id > 0
    )));

    if (!empty($brandIds)) {
        $placeholders = [];

        foreach ($brandIds as $index => $id) {
            $key = 'brand_id_' . $index;
            $placeholders[] = ':' . $key;
            $params[$key] = $id;
        }
$sql .= ' AND p.brand_id IN (' .
    implode(',', $placeholders) . ')';
    }
}

    if ($publicOnly) {
        $sql .= " AND p.is_active = 1";
    } elseif (isset($filters['is_active']) && $filters['is_active'] !== '') {
        $sql .= " AND p.is_active = :is_active";
        $params['is_active'] = (int) $filters['is_active'];
    }

    $sql .= " ORDER BY p.created_at DESC, p.id DESC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    return $stmt->fetchAll(PDO::FETCH_ASSOC);
}

function getProductById(int $id, bool $publicOnly = false): ?array
{
    $pdo = db();

    $stmt = $pdo->prepare("
        SELECT
            p.*,
            c.name AS category_name,
            c.slug AS category_slug,
            b.name AS brand_name
        FROM products p
        INNER JOIN categories c ON c.id = p.category_id
        INNER JOIN brands b ON b.id = p.brand_id
        WHERE p.id = :id AND p.is_deleted = 0" . ($publicOnly ? ' AND p.is_active = 1' : '') . "
        LIMIT 1
    ");

    $stmt->execute(['id' => $id]);
    $product = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$product) {
        return null;
    }
    // Giải mã thông số kỹ thuật từ JSON
$specifications = json_decode(
    $product['specifications'] ?? '{}',
    true
);

if (!is_array($specifications)) {
    $specifications = [];
}

$product['specifications'] = $specifications;

// Tách các thông số cần thiết
$product['power_watts'] = $specifications['power_watts'] ?? null;
$product['capacity_liters'] = $specifications['capacity_liters'] ?? null;

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

    $stmt = $pdo->prepare("
        SELECT id, image_url, is_primary, sort_order
        FROM product_images
        WHERE product_id = :product_id AND is_deleted = 0
        ORDER BY is_primary DESC, sort_order, id
    ");
    $stmt->execute(['product_id' => $id]);
    $product['images'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Chỉ tính đánh giá đang hiển thị của các đơn vị sản phẩm này.
    $stmt = $pdo->prepare("
        SELECT COUNT(*) AS review_count, ROUND(AVG(pr.rating), 1) AS rating_average
        FROM product_reviews pr
        INNER JOIN order_items oi ON oi.id = pr.order_item_id
        INNER JOIN product_variants pv ON pv.id = oi.variant_id
        WHERE pv.product_id = :product_id AND pr.is_visible = 1 AND pr.is_deleted = 0 AND oi.is_deleted = 0
    ");
    $stmt->execute(['product_id' => $id]);
    $product['review_summary'] = $stmt->fetch(PDO::FETCH_ASSOC);

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
function getProductsPaginated(array $filters = [], bool $publicOnly = true): array
{
    $pdo = db();

    $from = "
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
                            AND (sale_starts_at IS NULL OR sale_starts_at <= UTC_TIMESTAMP())
                            AND (sale_ends_at IS NULL OR sale_ends_at >= UTC_TIMESTAMP())
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

        LEFT JOIN (
            SELECT
                pv.product_id,
                SUM(oi.quantity) AS sold_quantity
            FROM order_items oi
            INNER JOIN orders o ON o.id = oi.order_id
            INNER JOIN product_variants pv ON pv.id = oi.variant_id
            WHERE o.order_status = 'COMPLETED'
                AND o.is_deleted = 0
                AND oi.is_deleted = 0
                AND pv.is_deleted = 0
            GROUP BY pv.product_id
        ) s ON s.product_id = p.id

        LEFT JOIN (
            SELECT
                pv.product_id,
                COUNT(pr.id) AS review_count,
                AVG(pr.rating) AS rating_average
            FROM product_reviews pr
            INNER JOIN order_items oi ON oi.id = pr.order_item_id
            INNER JOIN product_variants pv ON pv.id = oi.variant_id
            WHERE pr.is_visible = 1
                AND pr.is_deleted = 0
                AND oi.is_deleted = 0
                AND pv.is_deleted = 0
            GROUP BY pv.product_id
        ) r ON r.product_id = p.id

        WHERE p.is_deleted = 0
    ";

    $where = '';
    $params = [];

    if ($publicOnly) {
        // Storefront: hide inactive/deleted category or brand and products without a sellable SKU.
        $where .= " AND p.is_active = 1 AND c.is_active = 1 AND c.is_deleted = 0 AND b.is_active = 1 AND b.is_deleted = 0 AND COALESCE(v.variant_count, 0) > 0";
    } elseif (isset($filters['is_active']) && $filters['is_active'] !== '') {
        $where .= " AND p.is_active = :is_active";
        $params['is_active'] = (int) $filters['is_active'];
    }

    if (!empty($filters['keyword'])) {
        $where .= " AND (
            p.name LIKE :keyword_name
            OR p.product_code LIKE :keyword_code
        )";

        // Escape LIKE wildcards so "%" and "_" are searched literally (MySQL default escape is backslash).
        $keyword = '%' . addcslashes(mb_substr(trim((string) $filters['keyword']), 0, 100), '%_\\') . '%';
        $params['keyword_name'] = $keyword;
        $params['keyword_code'] = $keyword;
    }

    if (!empty($filters['category_id'])) {
        $where .= " AND p.category_id = :category_id";
        $params['category_id'] = (int) $filters['category_id'];
    }

    // brand_id accepts one ID or a comma-separated list (the filter panel allows several brands).
    if (!empty($filters['brand_id'])) {
        $brandIds = array_values(array_unique(array_filter(array_map('intval', explode(',', (string) $filters['brand_id'])), fn ($id) => $id > 0)));
        if ($brandIds !== []) {
            $placeholders = [];
            foreach ($brandIds as $index => $brandId) {
                $placeholders[] = ':brand_' . $index;
                $params['brand_' . $index] = $brandId;
            }
            $where .= ' AND p.brand_id IN (' . implode(',', $placeholders) . ')';
        }
    }

    if (isset($filters['min_price']) && $filters['min_price'] !== '') {
        $where .= " AND COALESCE(v.min_price, 0) >= :min_price";
        $params['min_price'] = max(0, (int) $filters['min_price']);
    }

    if (isset($filters['max_price']) && $filters['max_price'] !== '') {
        $where .= " AND COALESCE(v.min_price, 0) <= :max_price";
        $params['max_price'] = max(0, (int) $filters['max_price']);
    }

 if (
    isset($filters['warranty_months']) &&
    $filters['warranty_months'] !== ''
) {
    $warrantyValues = is_array($filters['warranty_months'])
        ? $filters['warranty_months']
        : explode(',', (string) $filters['warranty_months']);

    $warrantyValues = array_values(array_unique(array_filter(
        array_map('intval', $warrantyValues),
        fn($months) => $months > 0
    )));

    if (!empty($warrantyValues)) {
        $placeholders = [];

        foreach ($warrantyValues as $index => $months) {
            $key = 'warranty_' . $index;
            $placeholders[] = ':' . $key;
            $params[$key] = $months;
        }

        $where .= ' AND p.warranty_months IN (' .
            implode(',', $placeholders) . ')';
    }
}
    $countSql = "SELECT COUNT(*) " . $from . $where;
    $countStmt = $pdo->prepare($countSql);
    $countStmt->execute($params);
    $totalItems = (int) $countStmt->fetchColumn();

    $sortOptions = [
        'newest' => 'p.created_at DESC, p.id DESC',
        'price_asc' => 'v.min_price ASC, p.id DESC',
        'price_desc' => 'v.min_price DESC, p.id DESC',
        'best_selling' => 'COALESCE(s.sold_quantity, 0) DESC, p.id DESC',
        'rating_desc' => 'r.rating_average DESC, p.id DESC',
    ];

    $sort = $filters['sort'] ?? 'newest';
    $orderBy = $sortOptions[$sort] ?? $sortOptions['newest'];

    $page = max(1, (int) ($filters['page'] ?? 1));
    $pageSize = max(1, min(100, (int) ($filters['page_size'] ?? 12)));
    $offset = ($page - 1) * $pageSize;

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
            c.slug AS category_slug,
            b.id AS brand_id,
            b.name AS brand_name,
            COALESCE(v.variant_count, 0) AS variant_count,
            COALESCE(v.min_price, 0) AS min_price,
            COALESCE(v.total_stock, 0) AS total_stock,
            COALESCE(s.sold_quantity, 0) AS sold_quantity,
            COALESCE(r.review_count, 0) AS review_count,
            ROUND(r.rating_average, 1) AS rating_average,
            (
                SELECT pi.image_url
                FROM product_images pi
                WHERE pi.product_id = p.id
                    AND pi.is_primary = 1
                    AND pi.is_deleted = 0
                ORDER BY pi.id DESC
                LIMIT 1
            ) AS primary_image
        " . $from . $where . "
        ORDER BY {$orderBy}
        LIMIT :limit OFFSET :offset
    ";

    $stmt = $pdo->prepare($sql);

    foreach ($params as $key => $value) {
        $stmt->bindValue(':' . $key, $value);
    }

    $stmt->bindValue(':limit', $pageSize, PDO::PARAM_INT);
    $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);

    $stmt->execute();

    return [
        'items' => $stmt->fetchAll(PDO::FETCH_ASSOC),
        'pagination' => [
            'page' => $page,
            'page_size' => $pageSize,
            'total_items' => $totalItems,
            'total_pages' => (int) ceil($totalItems / $pageSize),
        ],
    ];
}