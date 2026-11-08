<?php
declare(strict_types=1);
require_once __DIR__ . '/../controllers/fit-rule-controller.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

// Mọi endpoint ở đây yêu cầu phiên ADMIN; DELETE chỉ vô hiệu hóa và tạo revision mới.
function handleFitRuleRoutes(string $method, string $path): bool
{
    $routes = [
        ['GET', '#^/api/admin/fit-rules/options$#', 'options'],
        ['GET', '#^/api/admin/fit-rules$#', 'list'],
        ['POST', '#^/api/admin/fit-rules$#', 'create'],
        ['GET', '#^/api/admin/fit-rules/(\d+)/versions$#', 'versions'],
        ['GET', '#^/api/admin/fit-rules/(\d+)$#', 'get'],
        ['PATCH', '#^/api/admin/fit-rules/(\d+)$#', 'update'],
        ['DELETE', '#^/api/admin/fit-rules/(\d+)$#', 'deactivate'],
    ];
    foreach ($routes as [$verb, $pattern, $action]) {
        if ($method !== $verb || !preg_match($pattern, $path, $matches)) continue;
        $actor = requireAdmin();
        fitRuleController($action, isset($matches[1]) ? (int) $matches[1] : 0, $actor);
        return true;
    }
    return false;
}
