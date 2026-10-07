<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

// Bốn role cố định; SYSTEM chỉ là nguồn audit nội bộ, không phải role client.
function requireOrderRole(array $principal, array $allowedRoles): void
{
    if (!in_array($principal['role'], ['CUSTOMER', 'ADMIN', 'SALES', 'WAREHOUSE'], true) ||
        !in_array($principal['role'], $allowedRoles, true)) {
        throw new ApiException(403, 'FORBIDDEN', 'Tài khoản không có quyền thực hiện thao tác này.');
    }
}
