<?php

require_once __DIR__ . '/../config/database.php';

/**
 * GET /api/categories
 * Lấy danh sách danh mục chưa bị xóa.
 */
function listCategories(): void
{
    try {
        $pdo = db();

        $sql = "
            SELECT
                id,
                parent_id,
                name,
                slug,
                sort_order,
                is_active,
                created_at,
                updated_at
            FROM categories
            WHERE COALESCE(is_deleted, 0) = 0
            ORDER BY sort_order ASC, id ASC
        ";

        $stmt = $pdo->query($sql);
        $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => $categories,
            'total' => count($categories)
        ], JSON_UNESCAPED_UNICODE);

    } catch (Throwable $e) {
        error_log($e->getMessage());

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể lấy danh sách danh mục.'
        ], JSON_UNESCAPED_UNICODE);
    }
}

/**
 * GET /api/categories/{id}
 * Xem chi tiết một danh mục.
 */
function showCategory(int $id): void
{
    try {
        $pdo = db();

        $sql = "
            SELECT
                id,
                parent_id,
                name,
                slug,
                sort_order,
                is_active,
                created_at,
                updated_at
            FROM categories
            WHERE id = :id
              AND COALESCE(is_deleted, 0) = 0
            LIMIT 1
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute(['id' => $id]);

        $category = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$category) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Không tìm thấy danh mục.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => $category
        ], JSON_UNESCAPED_UNICODE);

    } catch (Throwable $e) {
        error_log($e->getMessage());

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể lấy chi tiết danh mục.'
        ], JSON_UNESCAPED_UNICODE);
    }
}

/**
 * Đọc và kiểm tra dữ liệu danh mục.
 */
function readCategoryPayload(): ?array
{
    $data = json_decode(file_get_contents('php://input'), true);

    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Dữ liệu JSON không hợp lệ.'
        ], JSON_UNESCAPED_UNICODE);
        return null;
    }

    $name = trim((string) ($data['name'] ?? ''));
    $slug = trim((string) ($data['slug'] ?? ''));
    $parentId = $data['parent_id'] ?? null;
    $isActive = $data['is_active'] ?? 1;

    if (
        $name === '' || mb_strlen($name) > 150
        || $slug === '' || mb_strlen($slug) > 180
        || !preg_match('/^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/', $slug)
    ) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'Tên không được trống (tối đa 150 ký tự); slug phải hợp lệ và tối đa 180 ký tự.'
        ], JSON_UNESCAPED_UNICODE);
        return null;
    }

    if (!in_array($isActive, [0, 1, true, false, '0', '1'], true)) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'is_active chỉ nhận giá trị 0 hoặc 1.'
        ], JSON_UNESCAPED_UNICODE);
        return null;
    }

    if ($parentId !== null && $parentId !== '' &&
        (!filter_var($parentId, FILTER_VALIDATE_INT) || (int) $parentId <= 0)) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'parent_id không hợp lệ.'
        ], JSON_UNESCAPED_UNICODE);
        return null;
    }

    // Thứ tự hiển thị (nhỏ đứng trước); mặc định 0.
    $sortOrder = filter_var($data['sort_order'] ?? 0, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 100000]]);
    if ($sortOrder === false) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'sort_order là số nguyên từ 0 đến 100000.'
        ], JSON_UNESCAPED_UNICODE);
        return null;
    }

    return [
        'name' => $name,
        'slug' => $slug,
        'sort_order' => $sortOrder,
        'parent_id' => ($parentId === null || $parentId === '')
            ? null : (int) $parentId,
        'is_active' => (int) $isActive
    ];
}

/**
 * POST /api/categories
 */
function createCategory(): void
{
    $data = readCategoryPayload();
    if ($data === null) {
        return;
    }

    try {
        $pdo = db();

        if ($data['parent_id'] !== null) {
            $stmt = $pdo->prepare("
                SELECT id FROM categories
                WHERE id = :id AND COALESCE(is_deleted, 0) = 0 AND parent_id IS NULL
            ");
            $stmt->execute(['id' => $data['parent_id']]);

            if (!$stmt->fetchColumn()) {
                http_response_code(422);
                echo json_encode([
                    'success' => false,
                    'message' => 'Danh mục cha phải là danh mục gốc đang tồn tại (tối đa hai cấp).'
                ], JSON_UNESCAPED_UNICODE);
                return;
            }
        }

        $stmt = $pdo->prepare("
            INSERT INTO categories (parent_id, name, slug, sort_order, is_active, is_deleted)
            VALUES (:parent_id, :name, :slug, :sort_order, :is_active, 0)
        ");
        $stmt->execute($data);

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Tạo danh mục thành công.',
            'data' => ['id' => (int) $pdo->lastInsertId()]
        ], JSON_UNESCAPED_UNICODE);
    } catch (PDOException $e) {
        error_log($e->getMessage());

        if ($e->getCode() === '23000') {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'message' => 'Slug đã tồn tại hoặc dữ liệu vi phạm ràng buộc.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể tạo danh mục.'
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể tạo danh mục.'
        ], JSON_UNESCAPED_UNICODE);
    }
}

/**
 * PUT /api/categories/{id}
 */
function updateCategory(int $id): void
{
    $data = readCategoryPayload();
    if ($data === null) {
        return;
    }

    try {
        $pdo = db();

        $stmt = $pdo->prepare("
            SELECT id FROM categories
            WHERE id = :id AND COALESCE(is_deleted, 0) = 0
        ");
        $stmt->execute(['id' => $id]);

        if (!$stmt->fetchColumn()) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Không tìm thấy danh mục.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        if ($data['parent_id'] === $id) {
            http_response_code(422);
            echo json_encode([
                'success' => false,
                'message' => 'Danh mục không thể là danh mục cha của chính nó.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        if ($data['parent_id'] !== null) {
            $stmt = $pdo->prepare("
                SELECT id FROM categories
                WHERE id = :parent_id AND COALESCE(is_deleted, 0) = 0 AND parent_id IS NULL
            ");
            $stmt->execute(['parent_id' => $data['parent_id']]);

            if (!$stmt->fetchColumn()) {
                http_response_code(422);
                echo json_encode([
                    'success' => false,
                    'message' => 'Danh mục cha phải là danh mục gốc đang tồn tại (tối đa hai cấp).'
                ], JSON_UNESCAPED_UNICODE);
                return;
            }

            // Danh mục đang có danh mục con thì không thể trở thành cấp 2.
            $stmt = $pdo->prepare("
                SELECT id FROM categories
                WHERE parent_id = :id AND COALESCE(is_deleted, 0) = 0
                LIMIT 1
            ");
            $stmt->execute(['id' => $id]);

            if ($stmt->fetchColumn()) {
                http_response_code(422);
                echo json_encode([
                    'success' => false,
                    'message' => 'Danh mục đang có danh mục con nên không thể đặt làm cấp 2.'
                ], JSON_UNESCAPED_UNICODE);
                return;
            }

            // Không cho chọn một danh mục con làm cha của chính tổ tiên nó.
            $stmt = $pdo->prepare("
                WITH RECURSIVE descendants AS (
                    SELECT id FROM categories WHERE parent_id = :id
                    UNION ALL
                    SELECT c.id
                    FROM categories c
                    INNER JOIN descendants d ON c.parent_id = d.id
                )
                SELECT id FROM descendants WHERE id = :parent_id LIMIT 1
            ");
            $stmt->execute([
                'id' => $id,
                'parent_id' => $data['parent_id']
            ]);

            if ($stmt->fetchColumn()) {
                http_response_code(422);
                echo json_encode([
                    'success' => false,
                    'message' => 'Không thể chọn danh mục con làm danh mục cha.'
                ], JSON_UNESCAPED_UNICODE);
                return;
            }
        }

        $data['id'] = $id;
        $stmt = $pdo->prepare("
            UPDATE categories
            SET parent_id = :parent_id,
                name = :name,
                slug = :slug,
                sort_order = :sort_order,
                is_active = :is_active
            WHERE id = :id AND COALESCE(is_deleted, 0) = 0
        ");
        $stmt->execute($data);

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Cập nhật danh mục thành công.'
        ], JSON_UNESCAPED_UNICODE);
    } catch (PDOException $e) {
        error_log($e->getMessage());

        if ($e->getCode() === '23000') {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'message' => 'Slug đã tồn tại hoặc dữ liệu vi phạm ràng buộc.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể cập nhật danh mục.'
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể cập nhật danh mục.'
        ], JSON_UNESCAPED_UNICODE);
    }
}

/**
 * DELETE /api/categories/{id}
 * Xóa mềm; từ chối nếu còn sản phẩm hoặc danh mục con chưa xóa.
 */
function deleteCategory(int $id): void
{
    try {
        $pdo = db();

        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            SELECT id FROM categories
            WHERE id = :id AND COALESCE(is_deleted, 0) = 0
            FOR UPDATE
        ");
        $stmt->execute(['id' => $id]);

        if (!$stmt->fetchColumn()) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Không tìm thấy danh mục.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        $stmt = $pdo->prepare("
            SELECT id FROM products
            WHERE category_id = :id AND COALESCE(is_deleted, 0) = 0
            LIMIT 1
        ");
        $stmt->execute(['id' => $id]);

        if ($stmt->fetchColumn()) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'message' => 'Không thể xóa danh mục đang có sản phẩm.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        $stmt = $pdo->prepare("
            SELECT id FROM categories
            WHERE parent_id = :id AND COALESCE(is_deleted, 0) = 0
            LIMIT 1
        ");
        $stmt->execute(['id' => $id]);

        if ($stmt->fetchColumn()) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'message' => 'Hãy xử lý danh mục con trước khi xóa danh mục này.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        $stmt = $pdo->prepare("
            UPDATE categories
            SET is_deleted = 1, is_active = 0
            WHERE id = :id
        ");
        $stmt->execute(['id' => $id]);

        $pdo->commit();

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Xóa mềm danh mục thành công.'
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        if (isset($pdo) && $pdo->inTransaction()) {
            $pdo->rollBack();
        }

        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể xóa danh mục.'
        ], JSON_UNESCAPED_UNICODE);
    }
}
