<?php

require_once __DIR__ . '/../config/database.php';

/**
 * GET /api/inventory/movements
 * Lấy lịch sử biến động kho.
 */

function listInventoryMovements(): void
{
    try {
        $pdo = db();

        $sql = "
            SELECT
                im.id,
                im.variant_id,
                pv.sku,
                pv.variant_name,
                im.movement_type,
                im.quantity_change,
                im.quantity_before,
                im.quantity_after,
                im.reference_code,
                im.note,
                im.performed_by,
                u.full_name AS performed_by_name,
                im.created_at
            FROM inventory_movements im
            LEFT JOIN users u
                ON u.id = im.performed_by
            INNER JOIN product_variants pv
                ON pv.id = im.variant_id
            INNER JOIN products p
                ON p.id = pv.product_id
            WHERE COALESCE(im.is_deleted, 0) = 0
              AND COALESCE(pv.is_deleted, 0) = 0
              AND COALESCE(p.is_deleted, 0) = 0
        ";

        $params = [];

        // Lọc theo SKU
        if (isset($_GET['sku']) && trim($_GET['sku']) !== '') {
            $sql .= " AND pv.sku = :sku";
            $params['sku'] = trim($_GET['sku']);
        }

        // Lọc theo loại biến động
        if (isset($_GET['movement_type']) && $_GET['movement_type'] !== '') {
            $type = trim($_GET['movement_type']);

            if (!in_array($type, ['import', 'export'], true)) {
                http_response_code(400);
                echo json_encode([
                    'success' => false,
                    'message' => 'Loại biến động chỉ được là import hoặc export.'
                ], JSON_UNESCAPED_UNICODE);
                return;
            }

            $sql .= " AND im.movement_type = :movement_type";
            $params['movement_type'] = $type;
        }

        // shortcut: trả 200 dòng mới nhất, chưa phân trang; thêm page/pageSize khi lịch sử lớn.
        $sql .= " ORDER BY im.created_at DESC, im.id DESC LIMIT 200";

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
            'message' => 'Không thể lấy lịch sử biến động kho.'
        ], JSON_UNESCAPED_UNICODE);
    }
}

/**
 * POST /api/inventory/movements
 * Nhập kho hoặc xuất kho và ghi lại lịch sử.
 *
 * JSON:
 * {
 *   "sku": "HC-001-01",
 *   "movement_type": "import",
 *   "quantity": 5,
 *   "reference_code": "IMPORT-20261010-001",
 *   "note": "Nhap hang"
 * }
 */
function createInventoryMovement(int $performedBy): void
{
    $input = json_decode(file_get_contents('php://input'), true);

    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Dữ liệu JSON không hợp lệ.'
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    $sku = trim((string) ($input['sku'] ?? ''));
    $type = $input['movement_type'] ?? '';
    $quantity = filter_var(
        $input['quantity'] ?? null,
        FILTER_VALIDATE_INT
    );
    $referenceCode = trim((string) ($input['reference_code'] ?? ''));
    $note = trim((string) ($input['note'] ?? ''));

    if (
        $sku === ''
        || !in_array($type, ['import', 'export'], true)
        || $quantity === false
        || $quantity === null
        || $quantity <= 0
        || $referenceCode === ''
        || $note === ''
    ) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'SKU, loại biến động, số lượng dương, mã tham chiếu và lý do là bắt buộc.'
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    if (strlen($referenceCode) > 100 || mb_strlen($note) > 500) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Mã tham chiếu hoặc ghi chú vượt quá độ dài cho phép.'
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    $pdo = db();

    try {
        $pdo->beginTransaction();

        // Khóa dòng tồn kho để tránh hai yêu cầu cập nhật đồng thời.
        $stmt = $pdo->prepare("
            SELECT id, stock_quantity
            FROM product_variants
            WHERE sku = :sku
              AND COALESCE(is_deleted, 0) = 0
              AND is_active = 1
            FOR UPDATE
        ");
        $stmt->execute(['sku' => $sku]);
        $variant = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$variant) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Không tìm thấy SKU đang hoạt động.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        $variantId = (int) $variant['id'];
        $before = (int) $variant['stock_quantity'];

        if ($type === 'export' && $quantity > $before) {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Số lượng xuất vượt quá tồn kho hiện tại.',
                'stock_quantity' => $before
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        $after = $type === 'import'
            ? $before + $quantity
            : $before - $quantity;

        if ($after > 4294967295) {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Số lượng tồn kho vượt giới hạn cho phép.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        $update = $pdo->prepare("
            UPDATE product_variants
            SET stock_quantity = :stock_quantity
            WHERE id = :id
        ");
        $update->execute([
            'stock_quantity' => $after,
            'id' => $variantId
        ]);

        $insert = $pdo->prepare("
            INSERT INTO inventory_movements (
                variant_id,
                movement_type,
                quantity_change,
                quantity_before,
                quantity_after,
                reference_code,
                note,
                performed_by
            ) VALUES (
                :variant_id,
                :movement_type,
                :quantity_change,
                :quantity_before,
                :quantity_after,
                :reference_code,
                :note,
                :performed_by
            )
        ");

        $insert->execute([
            'variant_id' => $variantId,
            'movement_type' => $type,
            'quantity_change' => $type === 'import' ? $quantity : -$quantity,
            'quantity_before' => $before,
            'quantity_after' => $after,
            'reference_code' => $referenceCode,
            'note' => $note,
            'performed_by' => $performedBy
        ]);

        $movementId = (int) $pdo->lastInsertId();
        $pdo->commit();

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Ghi nhận biến động kho thành công.',
            'data' => [
                'id' => $movementId,
                'sku' => $sku,
                'movement_type' => $type,
                'quantity_change' => $type === 'import' ? $quantity : -$quantity,
                'quantity_before' => $before,
                'quantity_after' => $after,
                'reference_code' => $referenceCode
            ]
        ], JSON_UNESCAPED_UNICODE);

    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }

        error_log($e->getMessage());

        if ($e instanceof PDOException && $e->getCode() === '23000') {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'message' => 'Mã tham chiếu đã tồn tại hoặc dữ liệu vi phạm ràng buộc.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể ghi nhận biến động kho.'
        ], JSON_UNESCAPED_UNICODE);
    }
}
