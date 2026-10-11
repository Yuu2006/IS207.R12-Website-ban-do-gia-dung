<?php

header('Content-Type: application/json; charset=utf-8');
$clientOrigin = getenv('CLIENT_URL') ?: 'http://localhost:5173';
$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';

if ($requestOrigin === $clientOrigin) {
    header('Access-Control-Allow-Origin: ' . $clientOrigin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}

header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

require_once __DIR__ . '/routes/product-routes.php';
require_once __DIR__ . '/routes/category-routes.php';
require_once __DIR__ . '/routes/brand-routes.php';
require_once __DIR__ . '/routes/product-attribute-routes.php';
require_once __DIR__ . '/routes/inventory-routes.php';
require_once __DIR__ . '/routes/inventory-movement-routes.php';
require_once __DIR__ . '/routes/auth-routes.php';
require_once __DIR__ . '/routes/banner-routes.php';
require_once __DIR__ . '/routes/upload-routes.php';
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

try {
    if (handleProductRoutes($method, $path)) {
    exit;
}

if (handleCategoryRoutes($method, $path)) {
    exit;
}
if (handleBrandRoutes($method, $path)) {
    exit;
}
if (handleProductAttributeRoutes($method, $path)) {
    exit;
}
if (handleInventoryRoutes($method, $path)) {
    exit;
}
if (handleInventoryMovementRoutes($method, $path)) {
    exit;
}
if (handleAuthRoutes($method, $path)) {
    exit;
}
if (handleBannerRoutes($method, $path)) {
    exit;
}
if (handleUploadRoutes($method, $path)) {
    exit;
}
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'message' => 'API endpoint không tồn tại.',
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    error_log($e->getMessage());
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Lỗi máy chủ.',
    ], JSON_UNESCAPED_UNICODE);
}
