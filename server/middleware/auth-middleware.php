<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

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
