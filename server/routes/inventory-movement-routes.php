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
        requireSessionRole(['ADMIN', 'WAREHOUSE']);
        listInventoryMovements();
        return true;
    }

    // POST tao bien dong kho: ADMIN hoac WAREHOUSE (WH-03), ghi nguoi thuc hien
    if (
        $method === 'POST'
        && $path === '/api/inventory/movements'
    ) {
        $actor = requireSessionRole(['ADMIN', 'WAREHOUSE']);
        createInventoryMovement((int) $actor['id']);
        return true;
    }

    return false;
}
