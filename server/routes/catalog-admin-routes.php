<?php
declare(strict_types=1);
require_once __DIR__ . '/../controllers/catalog-admin-controller.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

// Endpoint quản trị bổ sung cho catalog của Lan Chi; tất cả chỉ ADMIN.
function handleCatalogAdminRoutes(string $method, string $path): bool
{
    $routes = [
        ['GET', '#^/api/products/(\d+)/variants$#', 'variants'],
        ['POST', '#^/api/products/(\d+)/variants$#', 'createVariant'],
        ['PUT', '#^/api/variants/(\d+)$#', 'updateVariant'],
        ['GET', '#^/api/products/(\d+)/images$#', 'images'],
        ['POST', '#^/api/products/(\d+)/images$#', 'addImage'],
        ['PUT', '#^/api/product-images/(\d+)$#', 'updateImage'],
        ['DELETE', '#^/api/product-images/(\d+)$#', 'deleteImage'],
        ['POST', '#^/api/categories/(\d+)/attributes$#', 'createAttribute'],
        ['GET', '#^/api/admin/banners$#', 'banners'],
    ];
    foreach ($routes as [$verb, $pattern, $action]) {
        if ($method !== $verb || !preg_match($pattern, $path, $matches)) continue;
        requireAdmin();
        catalogAdminController($action, (int) ($matches[1] ?? 0));
        return true;
    }
    return false;
}
