<?php
declare(strict_types=1);

require_once __DIR__ . '/../services/audit-service.php';

// Keep HTTP handling thin; authorization and filter validation live in AuditService.
function auditController(?array $principal, array $query, AuditService $service): void
{
    respondJson($service->list($principal, $query), 'Thành công.');
}
