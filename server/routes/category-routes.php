<?php

require_once __DIR__ . '/../controllers/category-controller.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

function handleCategoryRoutes(string $method, string $path): bool
{
    if ($path === '/api/categories') {
        if ($method === 'GET') {
            listCategories();
            return true;
        }

        if ($method === 'POST') {
            requireAdmin();
            createCategory();
            return true;
        }
    }

    if (preg_match('#^/api/categories/(\d+)$#', $path, $matches)) {
        $id = (int) $matches[1];

        if ($method === 'GET') {
            showCategory($id);
            return true;
        }

        if ($method === 'PUT') {
            requireAdmin();
            updateCategory($id);
            return true;
        }

        if ($method === 'DELETE') {
            requireAdmin();
            deleteCategory($id);
            return true;
        }
    }

    return false;
}
