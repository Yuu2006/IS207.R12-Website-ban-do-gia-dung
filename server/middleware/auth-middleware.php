<?php

require_once __DIR__ . '/../config/database.php';

/**
 * Cấu hình cookie session trước khi session_start().
 * Chỉ gọi khi session chưa được khởi tạo.
 */
function startAppSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_samesite', 'Lax');

    // Môi trường localhost đang dùng HTTP.
    // Khi triển khai HTTPS, cần bật cookie_secure.
    ini_set('session.cookie_secure', '0');

    session_start();
}

/**
 * Trả về thông tin user đã được xác thực trong session.
 * Chưa có session hợp lệ thì trả về null.
 */
function currentAuthenticatedUser(): ?array
{
    startAppSession();

    $userId = $_SESSION['user_id'] ?? null;

    if (!is_numeric($userId) || (int) $userId <= 0) {
        return null;
    }

    $stmt = db()->prepare(
        'SELECT id, full_name, email, role, status
         FROM users
         WHERE id = :id AND is_deleted = 0
         LIMIT 1'
    );

    $stmt->execute(['id' => (int) $userId]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user || $user['status'] !== 'ACTIVE') {
        $_SESSION = [];
        session_destroy();
        return null;
    }

    return $user;
}

/**
 * Yêu cầu người dùng đã đăng nhập.
 */
function requireAuthenticatedUser(): array
{
    $user = currentAuthenticatedUser();

    if ($user === null) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Vui lòng đăng nhập.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    return $user;
}
