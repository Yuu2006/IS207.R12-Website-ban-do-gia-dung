<?php
declare(strict_types=1);

require_once __DIR__ . '/../middleware/auth-middleware.php';
require_once __DIR__ . '/../models/audit-model.php';

/**
 * Append a catalog audit event using the authenticated administrator from the current request.
 */
function recordCatalogAudit(PDO $pdo, string $action, string $entityType, int $entityId, array $details = []): void
{
    $principal = currentPrincipal();
    $actorId = (int) ($principal['id'] ?? 0);
    $actorRole = $principal['role'] ?? null;

    if ($actorId < 1 || $actorRole !== 'ADMIN') {
        throw new LogicException('Catalog audit requires an authenticated administrator.');
    }

    (new AuditModel($pdo))->record($actorId, $actorRole, $action, $entityType, $entityId, $details);
}
