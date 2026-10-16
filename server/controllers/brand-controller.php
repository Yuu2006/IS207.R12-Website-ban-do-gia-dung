<?php

require_once __DIR__ . '/../config/database.php';

/**
 * GET /api/brands
 * Lấy danh sách thương hiệu chưa bị xóa.
 */
function listBrands(): void
{
    try {
        $pdo = db();

        $sql = "
            SELECT
                id,
                name,
                logo_url,
                description,
                is_active,
                created_at,
                updated_at
            FROM brands
            WHERE COALESCE(is_deleted, 0) = 0
            ORDER BY id ASC
        ";

        $stmt = $pdo->query($sql);
        $brands = $stmt->fetchAll(PDO::FETCH_ASSOC);

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => $brands,
            'total' => count($brands)
        ], JSON_UNESCAPED_UNICODE);

    } catch (Throwable $e) {
        error_log($e->getMessage());

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể lấy danh sách thương hiệu.'
        ], JSON_UNESCAPED_UNICODE);
    }
}

/**
 * GET /api/brands/{id}
 * Xem chi tiết thương hiệu.
 */
function showBrand(int $id): void
{
    try {
        $pdo = db();

        $sql = "
            SELECT
                id,
                name,
                logo_url,
                description,
                is_active,
                created_at,
                updated_at
            FROM brands
            WHERE id = :id
              AND COALESCE(is_deleted, 0) = 0
            LIMIT 1
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute(['id' => $id]);

        $brand = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$brand) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Không tìm thấy thương hiệu.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => $brand
        ], JSON_UNESCAPED_UNICODE);

    } catch (Throwable $e) {
        error_log($e->getMessage());

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể lấy chi tiết thương hiệu.'
        ], JSON_UNESCAPED_UNICODE);
    }
}

/**
 * Đọc và kiểm tra dữ liệu thương hiệu.
 */
function readBrandPayload(): ?array
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
    $logoUrl = trim((string) ($data['logo_url'] ?? ''));
    $description = trim((string) ($data['description'] ?? ''));
    $isActive = $data['is_active'] ?? 1;

    if ($name === '' || mb_strlen($name) > 150) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'Tên thương hiệu không được để trống và tối đa 150 ký tự.'
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

    if ($logoUrl !== '') {
        if (
            strlen($logoUrl) > 500
            || !filter_var($logoUrl, FILTER_VALIDATE_URL)
            || !in_array(
                strtolower((string) parse_url($logoUrl, PHP_URL_SCHEME)),
                ['http', 'https'],
                true
            )
        ) {
            http_response_code(422);
            echo json_encode([
                'success' => false,
                'message' => 'logo_url phải là URL HTTP hoặc HTTPS hợp lệ.'
            ], JSON_UNESCAPED_UNICODE);
            return null;
        }
    }

    if (mb_strlen($description) > 1000) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'Mô tả thương hiệu tối đa 1000 ký tự.'
        ], JSON_UNESCAPED_UNICODE);
        return null;
    }

    return [
        'name' => $name,
        'logo_url' => $logoUrl !== '' ? $logoUrl : null,
        'description' => $description !== '' ? $description : null,
        'is_active' => (int) $isActive
    ];
}

/**
 * POST /api/brands
 */
function createBrand(): void
{
    $data = readBrandPayload();
    if ($data === null) {
        return;
    }

    try {
        $pdo = db();
        $stmt = $pdo->prepare("
            INSERT INTO brands (name, logo_url, description, is_active, is_deleted)
            VALUES (:name, :logo_url, :description, :is_active, 0)
        ");
        $stmt->execute($data);

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Tạo thương hiệu thành công.',
            'data' => ['id' => (int) $pdo->lastInsertId()]
        ], JSON_UNESCAPED_UNICODE);
    } catch (PDOException $e) {
        error_log($e->getMessage());

        if ($e->getCode() === '23000') {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'message' => 'Tên thương hiệu đã tồn tại.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể tạo thương hiệu.'
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể tạo thương hiệu.'
        ], JSON_UNESCAPED_UNICODE);
    }
}

/**
 * PUT /api/brands/{id}
 */
function updateBrand(int $id): void
{
    $data = readBrandPayload();
    if ($data === null) {
        return;
    }

    try {
        $pdo = db();

        $stmt = $pdo->prepare("
            UPDATE brands
            SET name = :name,
                logo_url = :logo_url,
                description = :description,
                is_active = :is_active
            WHERE id = :id AND COALESCE(is_deleted, 0) = 0
        ");
        $data['id'] = $id;
        $stmt->execute($data);

        $check = $pdo->prepare("
            SELECT id FROM brands
            WHERE id = :id AND COALESCE(is_deleted, 0) = 0
        ");
        $check->execute(['id' => $id]);

        if (!$check->fetchColumn()) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Không tìm thấy thương hiệu.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Cập nhật thương hiệu thành công.'
        ], JSON_UNESCAPED_UNICODE);
    } catch (PDOException $e) {
        error_log($e->getMessage());

        if ($e->getCode() === '23000') {
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'message' => 'Tên thương hiệu đã tồn tại.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể cập nhật thương hiệu.'
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể cập nhật thương hiệu.'
        ], JSON_UNESCAPED_UNICODE);
    }
}

/**
 * DELETE /api/brands/{id}
 * Xóa mềm; không xóa thương hiệu đang được sản phẩm sử dụng.
 */
function deleteBrand(int $id): void
{
    try {
        $pdo = db();
        $pdo->beginTransaction();

        $stmt = $pdo->prepare("
            SELECT id FROM brands
            WHERE id = :id AND COALESCE(is_deleted, 0) = 0
            FOR UPDATE
        ");
        $stmt->execute(['id' => $id]);

        if (!$stmt->fetchColumn()) {
            $pdo->rollBack();
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Không tìm thấy thương hiệu.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        $stmt = $pdo->prepare("
            SELECT id FROM products
            WHERE brand_id = :id AND COALESCE(is_deleted, 0) = 0
            LIMIT 1
        ");
        $stmt->execute(['id' => $id]);

        if ($stmt->fetchColumn()) {
            $pdo->rollBack();
            http_response_code(409);
            echo json_encode([
                'success' => false,
                'message' => 'Không thể xóa thương hiệu đang có sản phẩm.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        $stmt = $pdo->prepare("
            UPDATE brands
            SET is_deleted = 1, is_active = 0
            WHERE id = :id
        ");
        $stmt->execute(['id' => $id]);

        $pdo->commit();

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Xóa mềm thương hiệu thành công.'
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        if (isset($pdo) && $pdo->inTransaction()) {
            $pdo->rollBack();
        }

        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể xóa thương hiệu.'
        ], JSON_UNESCAPED_UNICODE);
    }
}
