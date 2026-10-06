<?php
declare(strict_types=1);
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
