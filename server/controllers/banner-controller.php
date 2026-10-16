<?php

require_once __DIR__ . '/../config/database.php';

/**
 * GET /api/banners
 * Lấy danh sách banner chưa xóa.
 * Mặc định chỉ trả về banner đang trong thời gian hiển thị.
 */
function listBanners(): void
{
    try {
        $pdo = db();

        $sql = "
            SELECT
                id,
                title,
                image_url,
                target_url,
                starts_at,
                ends_at,
                sort_order,
                is_active,
                created_at,
                updated_at
            FROM banners
            WHERE COALESCE(is_deleted, 0) = 0
              AND is_active = 1
              AND (starts_at IS NULL OR starts_at <= NOW())
              AND (ends_at IS NULL OR ends_at >= NOW())
            ORDER BY sort_order ASC, id DESC
        ";

        $stmt = $pdo->query($sql);
        $banners = $stmt->fetchAll(PDO::FETCH_ASSOC);

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => $banners,
            'total' => count($banners)
        ], JSON_UNESCAPED_UNICODE);

    } catch (Throwable $e) {
        error_log($e->getMessage());

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể lấy danh sách banner.'
        ], JSON_UNESCAPED_UNICODE);
    }
}

/**
 * GET /api/banners/{id}
 * Xem chi tiết banner đang hiển thị.
 */
function showBanner(int $id): void
{
    try {
        $pdo = db();

        $sql = "
            SELECT
                id,
                title,
                image_url,
                target_url,
                starts_at,
                ends_at,
                sort_order,
                is_active,
                created_at,
                updated_at
            FROM banners
            WHERE id = :id
              AND COALESCE(is_deleted, 0) = 0
              AND is_active = 1
              AND (starts_at IS NULL OR starts_at <= NOW())
              AND (ends_at IS NULL OR ends_at >= NOW())
            LIMIT 1
        ";

        $stmt = $pdo->prepare($sql);
        $stmt->execute(['id' => $id]);
        $banner = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$banner) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Không tìm thấy banner đang hiển thị.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'data' => $banner
        ], JSON_UNESCAPED_UNICODE);

    } catch (Throwable $e) {
        error_log($e->getMessage());

        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể lấy chi tiết banner.'
        ], JSON_UNESCAPED_UNICODE);
    }
}

/**
 * Đọc và kiểm tra dữ liệu Banner.
 */
function readBannerPayload(): ?array
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

    $title = trim((string) ($data['title'] ?? ''));
    $imageUrl = trim((string) ($data['image_url'] ?? ''));
    $targetUrl = trim((string) ($data['target_url'] ?? ''));
    $startsAt = $data['starts_at'] ?? null;
    $endsAt = $data['ends_at'] ?? null;
    $isActive = $data['is_active'] ?? 1;

    if ($title === '' || mb_strlen($title) > 150) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'Tiêu đề không được để trống và tối đa 150 ký tự.'
        ], JSON_UNESCAPED_UNICODE);
        return null;
    }

    if (
        $imageUrl === ''
        || strlen($imageUrl) > 500
        || !filter_var($imageUrl, FILTER_VALIDATE_URL)
        || !in_array(strtolower((string) parse_url($imageUrl, PHP_URL_SCHEME)), ['http', 'https'], true)
    ) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'URL ảnh phải là URL HTTP hoặc HTTPS hợp lệ.'
        ], JSON_UNESCAPED_UNICODE);
        return null;
    }

    if ($targetUrl !== '' && (
        strlen($targetUrl) > 500
        || !filter_var($targetUrl, FILTER_VALIDATE_URL)
        || !in_array(strtolower((string) parse_url($targetUrl, PHP_URL_SCHEME)), ['http', 'https'], true)
    )) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'URL đích phải là URL HTTP hoặc HTTPS hợp lệ.'
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

    foreach (['starts_at' => $startsAt, 'ends_at' => $endsAt] as $field => $value) {
        if ($value !== null && $value !== '') {
            $date = is_string($value)
                ? DateTime::createFromFormat('!Y-m-d H:i:s', $value)
                : false;

            if (!$date || $date->format('Y-m-d H:i:s') !== $value) {
                http_response_code(422);
                echo json_encode([
                    'success' => false,
                    'message' => "$field phải có định dạng YYYY-MM-DD HH:MM:SS hoặc null."
                ], JSON_UNESCAPED_UNICODE);
                return null;
            }
        }
    }

    if (
        $startsAt !== null && $startsAt !== ''
        && $endsAt !== null && $endsAt !== ''
        && $endsAt < $startsAt
    ) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => 'Thời gian kết thúc phải sau hoặc bằng thời gian bắt đầu.'
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
        'title' => $title,
        'sort_order' => $sortOrder,
        'image_url' => $imageUrl,
        'target_url' => $targetUrl !== '' ? $targetUrl : null,
        'starts_at' => $startsAt ?: null,
        'ends_at' => $endsAt ?: null,
        'is_active' => (int) $isActive
    ];
}

/**
 * POST /api/banners
 */
function createBanner(): void
{
    $data = readBannerPayload();
    if ($data === null) {
        return;
    }

    try {
        $pdo = db();
        $stmt = $pdo->prepare("
            INSERT INTO banners
                (title, image_url, target_url, starts_at, ends_at, sort_order, is_active, is_deleted)
            VALUES
                (:title, :image_url, :target_url, :starts_at, :ends_at, :sort_order, :is_active, 0)
        ");
        $stmt->execute($data);

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Tạo banner thành công.',
            'data' => ['id' => (int) $pdo->lastInsertId()]
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể tạo banner.'
        ], JSON_UNESCAPED_UNICODE);
    }
}

/**
 * PUT /api/banners/{id}
 */
function updateBanner(int $id): void
{
    $data = readBannerPayload();
    if ($data === null) {
        return;
    }

    try {
        $pdo = db();
        $data['id'] = $id;

        $stmt = $pdo->prepare("
            UPDATE banners
            SET title = :title,
                image_url = :image_url,
                target_url = :target_url,
                starts_at = :starts_at,
                ends_at = :ends_at,
                sort_order = :sort_order,
                is_active = :is_active
            WHERE id = :id
              AND COALESCE(is_deleted, 0) = 0
        ");
        $stmt->execute($data);

        if ($stmt->rowCount() === 0) {
            $check = $pdo->prepare("
                SELECT id FROM banners
                WHERE id = :id AND COALESCE(is_deleted, 0) = 0
            ");
            $check->execute(['id' => $id]);

            if (!$check->fetchColumn()) {
                http_response_code(404);
                echo json_encode([
                    'success' => false,
                    'message' => 'Không tìm thấy banner.'
                ], JSON_UNESCAPED_UNICODE);
                return;
            }
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Cập nhật banner thành công.'
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể cập nhật banner.'
        ], JSON_UNESCAPED_UNICODE);
    }
}

/**
 * DELETE /api/banners/{id}
 * Xóa mềm, không xóa bản ghi khỏi database.
 */
function deleteBanner(int $id): void
{
    try {
        $pdo = db();
        $stmt = $pdo->prepare("
            UPDATE banners
            SET is_deleted = 1, is_active = 0
            WHERE id = :id AND COALESCE(is_deleted, 0) = 0
        ");
        $stmt->execute(['id' => $id]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode([
                'success' => false,
                'message' => 'Không tìm thấy banner hoặc banner đã bị xóa.'
            ], JSON_UNESCAPED_UNICODE);
            return;
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Xóa banner thành công.'
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Không thể xóa banner.'
        ], JSON_UNESCAPED_UNICODE);
    }
}
