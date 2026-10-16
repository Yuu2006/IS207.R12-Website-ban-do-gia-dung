<?php
declare(strict_types=1);

// Order API guard (Tấn Vĩ) dùng namespace; auth/hồ sơ/catalog dùng global scope.
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

const AUTH_ROLES = ['CUSTOMER', 'ADMIN', 'SALES', 'WAREHOUSE'];

// Allowlist cố định, từ chối role lạ và không cho ADMIN tự vượt mọi quyền.
function requireRole(?array $principal, array $allowedRoles): array
{
    $principal = requirePrincipal($principal);
    if (!in_array($principal['role'] ?? null, AUTH_ROLES, true) || !in_array($principal['role'], $allowedRoles, true)) {
        throw new ApiException('Bạn không có quyền thực hiện thao tác này.', 403);
    }
    return $principal;
}

// Guard cho route catalog/kho dạng procedural; lỗi đi qua ApiException để index trả JSON 401/403.
function requireSessionRole(array $allowedRoles): array
{
    return requireRole(currentPrincipal(), $allowedRoles);
}

function requireAdmin(): array
{
    return requireSessionRole(['ADMIN']);
}

}
