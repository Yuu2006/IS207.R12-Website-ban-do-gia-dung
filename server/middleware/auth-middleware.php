<?php
declare(strict_types=1);

// Order API guard (Tấn Vĩ) dùng namespace; auth/hồ sơ/catalog dùng global scope.
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

require_once __DIR__ . '/../utils/response.php';

// Principal chỉ lấy từ phiên máy chủ hoặc truyền trực tiếp trong kiểm tra CLI.
function requirePrincipal(?array $principal): array
{
    if (!$principal || !is_string($principal['id'] ?? null) || $principal['id'] === '' ||
        ($principal['status'] ?? '') !== 'ACTIVE' || !is_int($principal['expiresAt'] ?? null) ||
        $principal['expiresAt'] <= time()) {
        throw new ApiException('Bạn cần đăng nhập hoặc phiên đã hết hạn.', 401);
    }
    return $principal;
}

// Một cookie phiên HttpOnly cho mọi module; Secure khi chạy HTTPS.
function startAppSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_cache_limiter(''); // index.php đã gửi Cache-Control: no-store
    session_name('HOMECARE_SESSION');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'samesite' => 'Lax']);
    session_start();
    issueCsrfToken();
}

// Token CSRF theo phiên; cookie XSRF-TOKEN đọc được để client đọc lại (double-submit), không phải cookie xác thực.
function issueCsrfToken(bool $rotate = false): void
{
    if ($rotate || empty($_SESSION['csrfToken'])) $_SESSION['csrfToken'] = bin2hex(random_bytes(32));
    if (($_COOKIE['XSRF-TOKEN'] ?? '') !== $_SESSION['csrfToken'] && !headers_sent()) {
        setcookie('XSRF-TOKEN', $_SESSION['csrfToken'], ['path' => '/', 'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'samesite' => 'Lax']);
    }
}

// Principal của request hiện tại; index.php đã đối chiếu phiên với MySQL trước khi dispatch.
function currentPrincipal(): ?array
{
    return $_SESSION['principal'] ?? null;
}

}
