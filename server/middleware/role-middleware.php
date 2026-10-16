<?php
declare(strict_types=1);

// Order API guard (Tấn Vĩ) dùng namespace; catalog/auth guard dùng global scope.
namespace HomeCare\OrderApi {

// Bốn role cố định; SYSTEM chỉ là nguồn audit nội bộ, không phải role client.
function requireOrderRole(array $principal, array $allowedRoles): void
{
    if (!in_array($principal['role'], ['CUSTOMER', 'ADMIN', 'SALES', 'WAREHOUSE'], true) ||
        !in_array($principal['role'], $allowedRoles, true)) {
        throw new ApiException(403, 'FORBIDDEN', 'Tài khoản không có quyền thực hiện thao tác này.');
    }
}

}

namespace {

require_once __DIR__ . '/auth-middleware.php';

/**
 * Yêu cầu người dùng đã đăng nhập và có một trong các role cho phép.
 *
 * Ví dụ:
 * requireRole(['ADMIN']);
 */
function requireRole(array $allowedRoles): array
{
    $user = requireAuthenticatedUser();

    if (!in_array($user['role'], $allowedRoles, true)) {
        http_response_code(403);
        echo json_encode([
            'success' => false,
            'message' => 'Bạn không có quyền thực hiện thao tác này.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    return $user;
}

/**
 * Chỉ cho phép ADMIN quản lý catalog.
 */
function requireAdmin(): array
{
    return requireRole(['ADMIN']);
}

}
