<?php

require_once __DIR__ . '/../controllers/inventory-controller.php';

function handleInventoryRoutes(string $method, string $path): bool
{
    // GET /api/inventory
    if ($method === 'GET' && $path === '/api/inventory') {
        listInventory();
        return true;
    }

    return false;
}
