<?php

require_once __DIR__ . '/../controllers/inventory-controller.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

function handleInventoryRoutes(string $method, string $path): bool
{
    // GET /api/inventory
    // WH-01/02: tồn và cảnh báo là dữ liệu nội bộ, chỉ ADMIN/WAREHOUSE.
    if ($method === 'GET' && $path === '/api/inventory') {
        requireSessionRole(['ADMIN', 'WAREHOUSE']);
        listInventory();
        return true;
    }

    return false;
}
