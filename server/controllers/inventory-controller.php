<?php

require_once __DIR__ . '/../config/database.php';

/**
 * GET /api/inventory
 * Xem catalog tồn kho, có thể lọc theo SKU hoặc hàng sắp hết.
 */
function listInventory(): void
{
    try {
        $pdo = db();

        $sql = "
            SELECT
                pv.id AS variant_id,
                pv.sku,
                pv.variant_name,
                pv.price,
                pv.stock_quantity,
                pv.low_stock_threshold,
                CASE
                    WHEN pv.stock_quantity = 0 THEN 'out_of_stock'
                    WHEN pv.stock_quantity <= pv.low_stock_threshold THEN 'low_stock'
                    ELSE 'in_stock'
                END AS stock_status,
                p.id AS product_id,
                p.product_code,
                p.name AS product_name,
                c.id AS category_id,
                c.name AS category_name,
                b.id AS brand_id,
                b.name AS brand_name
            FROM product_variants pv
            INNER JOIN products p ON p.id = pv.product_id
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN brands b ON b.id = p.brand_id
            WHERE COALESCE(pv.is_deleted, 0) = 0
              AND COALESCE(p.is_deleted, 0) = 0
        ";

        $params = [];

        if (isset($_GET['sku']) && trim($_GET['sku']) !== '') {
            $sql .= " AND pv.sku = :sku";
            $params['sku'] = trim($_GET['sku']);
        }

        if (isset($_GET['low_stock']) && $_GET['low_stock'] === '1') {
            $sql .= " AND pv.stock_quantity <= pv.low_stock_threshold";
        }

        $sql .= " ORDER BY p.id ASC, pv.id ASC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => $items,
            'total' => count($items)
        ], JSON_UNESCAPED_UNICODE);

    } catch (Throwable $e) {
        error_log($e->getMessage());

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể lấy catalog tồn kho.'
        ], JSON_UNESCAPED_UNICODE);
    }
}
