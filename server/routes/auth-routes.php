<?php
declare(strict_types=1);
require_once __DIR__ . '/../controllers/auth-controller.php';

function dispatchAuthRoute(string $method, string $path, array $input, AuthService $service): bool
{
    $routes = [
        '/auth/me' => ['GET', 'session'],
        '/auth/staff/login' => ['POST', 'loginStaff'],
        '/auth/customer/otp/request' => ['POST', 'requestOtp'],
        '/auth/customer/otp/verify' => ['POST', 'verifyOtp'],
        '/auth/logout' => ['POST', 'logout'],
    ];
    if (!isset($routes[$path])) return false;
    [$expected, $action] = $routes[$path];
    if ($method !== $expected) { header("Allow: $expected"); throw new ApiException('HTTP method không được hỗ trợ.', 405); }
    authController($action, $input, $service);
    return true;
}
