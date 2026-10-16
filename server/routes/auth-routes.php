<?php
declare(strict_types=1);
require_once __DIR__ . '/../controllers/auth-controller.php';

function dispatchAuthRoute(string $method, string $path, array $input, AuthService $service): bool
{
    $routes = [
        '/auth/me' => ['GET', 'session'],
        '/auth/login' => ['POST', 'login'],
        '/auth/register' => ['POST', 'register'],
        '/auth/staff/login' => ['POST', 'loginStaff'],
        '/auth/password/change' => ['POST', 'changePassword'],
        '/auth/password-reset/request' => ['POST', 'resetRequest'],
        '/auth/password-reset/verify' => ['POST', 'resetVerify'],
        '/auth/password-reset/confirm' => ['POST', 'resetConfirm'],
        '/auth/email-change/request' => ['POST', 'emailRequest'],
        '/auth/email-change/confirm' => ['POST', 'emailConfirm'],
        '/auth/logout' => ['POST', 'logout'],
    ];
    if (!isset($routes[$path])) return false;
    [$expected, $action] = $routes[$path];
    if ($method !== $expected) { header("Allow: $expected"); throw new ApiException('HTTP method không được hỗ trợ.', 405); }
    authController($action, $input, $service);
    return true;
}
