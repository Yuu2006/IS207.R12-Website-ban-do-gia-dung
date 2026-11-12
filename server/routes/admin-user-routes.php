<?php
declare(strict_types=1);
require_once __DIR__ . '/../controllers/admin-user-controller.php';

// Match account-list/create/update/status routes; the service owns authorization and policy.
function dispatchAdminUserRoute(string $method, string $path, array $input, ?array $principal, AdminUserService $service): bool
{
    $action = null;
    $id = '';
    if ($path === '/admin/users') $action = ['GET' => 'list', 'POST' => 'create'][$method] ?? null;
    elseif (preg_match('#^/admin/users/([1-9][0-9]{0,19})$#', $path, $matches)) {
        $id = $matches[1];
        $action = ['PATCH' => 'update'][$method] ?? null;
    } elseif (preg_match('#^/admin/users/([1-9][0-9]{0,19})/status$#', $path, $matches)) {
        $id = $matches[1];
        $action = ['PATCH' => 'changeStatus'][$method] ?? null;
    } else return false;

    if (!$action) throw new ApiException('HTTP method không được hỗ trợ.', 405);
    adminUserController($action, $principal, $input, $id, $service);
    return true;
}
