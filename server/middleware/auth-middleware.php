<?php
declare(strict_types=1);

// Order API guard (Tấn Vĩ) dùng namespace; catalog/auth guard dùng global scope.
namespace HomeCare\OrderApi {

// Chỉ nhận dữ liệu phiên server; không đọc principal từ body/query/header client.
function requireOrderPrincipal(array $session, ?int $now = null): array
{
    $user = $session['user'] ?? null;
    $expiresAt = $session['expiresAt'] ?? null;
    $id = is_array($user) ? ($user['id'] ?? null) : null;
    if (!is_array($user) || (!is_string($id) && !is_int($id)) ||
        preg_match('/^[1-9][0-9]*$/D', (string) $id) !== 1 ||
        !is_string($user['role'] ?? null) || !is_int($expiresAt) || $expiresAt <= ($now ?? time())) {
        throw new ApiException(401, 'AUTH_REQUIRED', 'Vui lòng đăng nhập để tiếp tục.');
    }
    return ['id' => (string) $id, 'role' => $user['role'], 'fullName' => $user['fullName'] ?? ''];
}

// Token session và header phải khớp; cookie đọc được chỉ là phương tiện chuyển token.
function requireOrderCsrf(array $session, array $headers): void
{
    $expected = $session['csrfToken'] ?? null;
    $provided = $headers['x-csrf-token'] ?? null;
    if (!is_string($expected) || $expected === '' || !is_string($provided) ||
        $provided === '' || !hash_equals($expected, $provided)) {
        throw new ApiException(403, 'CSRF_INVALID', 'Phiên xác nhận thao tác không hợp lệ.');
    }
}

}

namespace {

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

}
