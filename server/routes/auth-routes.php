<?php

require_once __DIR__ . '/../controllers/auth-controller.php';

function handleAuthRoutes(string $method, string $path): bool
{
    if ($method === 'POST' && $path === '/auth/staff/login') {
        staffLogin();
        return true;
    }

    if ($method === 'POST' && $path === '/auth/staff/logout') {
        staffLogout();
        return true;
    }
if ($method === 'GET' && $path === '/auth/staff/me') {
    staffMe();
    return true;
}

    return false;
}
