<?php

require_once __DIR__ . '/../controllers/product-attribute-controller.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

function handleProductAttributeRoutes(string $method, string $path): bool
{
    // GET thuoc tinh theo danh muc: cong khai
    if (
        $method === 'GET'
        && preg_match('#^/api/categories/(\d+)/attributes$#', $path, $matches)
    ) {
        listProductAttributes((int) $matches[1]);
        return true;
    }

    // GET gia tri thuoc tinh cua san pham: cong khai
    if (
        $method === 'GET'
        && preg_match('#^/api/products/(\d+)/attributes$#', $path, $matches)
    ) {
        getProductAttributeValues((int) $matches[1]);
        return true;
    }

    // PUT cap nhat thuoc tinh: chi ADMIN
    if (
        $method === 'PUT'
        && preg_match('#^/api/products/(\d+)/attributes$#', $path, $matches)
    ) {
        requireAdmin();
        updateProductAttributeValues((int) $matches[1]);
        return true;
    }

    return false;
}
