<?php

require_once __DIR__ . '/../controllers/product-controller.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

function handleProductRoutes(string $method, string $path): bool
{
    // GET danh sach san pham: cong khai
    if ($path === '/api/products' && $method === 'GET') {
        listProducts();
        return true;
    }

    // POST tao san pham: chi ADMIN
    if ($path === '/api/products' && $method === 'POST') {
        requireAdmin();
        createProduct();
        return true;
    }

    // GET chi tiet, PUT cap nhat, DELETE xoa san pham
    if (preg_match('#^/api/products/(\d+)$#', $path, $matches)) {
        $id = (int) $matches[1];

        if ($method === 'GET') {
            showProduct($id);
            return true;
        }

        if ($method === 'PUT') {
            requireAdmin();
            updateProductRequest($id);
            return true;
        }

        if ($method === 'DELETE') {
            requireAdmin();
            deleteProductRequest($id);
            return true;
        }
    }

    return false;
}
