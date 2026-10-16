<?php

require_once __DIR__ . '/../controllers/brand-controller.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

function handleBrandRoutes(string $method, string $path): bool
{
    if ($path === '/api/brands') {
        if ($method === 'GET') {
            listBrands();
            return true;
        }

        if ($method === 'POST') {
            requireAdmin();
            createBrand();
            return true;
        }
    }

    if (preg_match('#^/api/brands/(\d+)$#', $path, $matches)) {
        $id = (int) $matches[1];

        if ($method === 'GET') {
            showBrand($id);
            return true;
        }

        if ($method === 'PUT') {
            requireAdmin();
            updateBrand($id);
            return true;
        }

        if ($method === 'DELETE') {
            requireAdmin();
            deleteBrand($id);
            return true;
        }
    }

    return false;
}
