<?php
declare(strict_types=1);
require_once __DIR__ . '/../controllers/audit-controller.php';

// Only ADMIN can read audit history; no mutation endpoint is exposed.
function dispatchAuditRoute(string $method, string $path, array $query, ?array $principal, AuditService $service): bool
{
    if ($path !== '/admin/audit-logs') return false;
    if ($method !== 'GET') { header('Allow: GET'); throw new ApiException('HTTP method không được hỗ trợ.', 405); }
    auditController($principal, $query, $service);
    return true;
}
