<?php
declare(strict_types=1);
require_once __DIR__ . '/../controllers/installation-checklist-controller.php';
require_once __DIR__ . '/../middleware/role-middleware.php';
require_once __DIR__ . '/care-routes.php';

// Shared router enforces CSRF on writes; this route additionally requires a customer session.
function handleInstallationChecklistRoutes(string $method, string $path): bool
{
    if ($path !== '/api/installation-checklists') return false;
    if (!in_array($method, ['GET', 'POST'], true)) throw new ApiException('HTTP method không hỗ trợ.', 405);
    $actor = requireSessionRole(['CUSTOMER']);
    installationChecklistController($method, $actor, $method === 'GET' ? $_GET : careRequestBody());
    return true;
}
