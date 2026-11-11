<?php
declare(strict_types=1);
require_once __DIR__ . '/../controllers/room-fit-controller.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

// HOME-01/FIT-01 chỉ dành cho CUSTOMER; ghi đã qua CSRF ở index.php.
function handleRoomFitRoutes(string $method, string $path): bool
{
    $routes = [
        ['GET', '#^/api/room-profiles$#', 'list'],
        ['POST', '#^/api/room-profiles$#', 'create'],
        ['PATCH', '#^/api/room-profiles/(\d+)$#', 'update'],
        ['DELETE', '#^/api/room-profiles/(\d+)$#', 'delete'],
        ['POST', '#^/api/fit-checks$#', 'check'],
    ];
    foreach ($routes as [$verb, $pattern, $action]) {
        if ($method !== $verb || !preg_match($pattern, $path, $matches)) continue;
        $actor = requireSessionRole(['CUSTOMER']);
        roomFitController($action, isset($matches[1]) ? (int) $matches[1] : 0, $actor);
        return true;
    }
    return false;
}
