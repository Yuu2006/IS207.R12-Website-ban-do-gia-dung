<?php

require_once __DIR__ . '/../controllers/inventory-movement-controller.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

function handleInventoryMovementRoutes(string $method, string $path): bool
{
    // GET lich su bien dong kho
    if (
        $method === 'GET'
        && $path === '/api/inventory/movements'
    ) {
        listInventoryMovements();
        return true;
    }

    // POST tao bien dong kho: chi ADMIN
    if (
        $method === 'POST'
        && $path === '/api/inventory/movements'
    ) {
        requireAdmin();
        createInventoryMovement();
        return true;
    }

    return false;
}
