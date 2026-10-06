<?php
declare(strict_types=1);
require_once __DIR__ . '/../controllers/user-controller.php';

function dispatchUserRoute(string $method, string $path, array $input, ?array $principal, UserService $service): bool
{
    $action = null;
    $id = null;
    if ($path === '/users/me') $action = ['GET' => 'profile', 'PATCH' => 'updateProfile'][$method] ?? null;
    elseif ($path === '/users/me/addresses') $action = ['GET' => 'addresses', 'POST' => 'createAddress'][$method] ?? null;
    elseif (preg_match('#^/users/me/addresses/([a-zA-Z0-9-]{1,80})$#', $path, $matches)) {
        $id = $matches[1];
        $action = ['PATCH' => 'updateAddress', 'DELETE' => 'deleteAddress'][$method] ?? null;
    } else return false;
    if (!$action) throw new ApiException('HTTP method không được hỗ trợ.', 405);
    userController($action, $principal, $input, $id, $service);
    return true;
}
