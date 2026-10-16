<?php
declare(strict_types=1);

require_once __DIR__ . '/utils/response.php';
require_once __DIR__ . '/utils/order-api.php';
require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/routes/auth-routes.php';
require_once __DIR__ . '/routes/user-routes.php';

use HomeCare\OrderApi\ApiException as OrderApiException;
use function HomeCare\OrderApi\apiFailure;
use function HomeCare\OrderApi\handleOrderApi;
use const HomeCare\OrderApi\MAX_ORDER_BODY_BYTES;

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

// Một router cho mọi module: auth/users (TV1) → catalog/kho /api/* (TV2) → đơn hàng (TV3).
try {
    $origins = array_map('trim', explode(',', getenv('CLIENT_URL') ?: 'http://localhost:5173'));
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        if (!in_array($origin, $origins, true)) {
            http_response_code(403);
            echo json_encode(apiFailure(new OrderApiException(403, 'ORIGIN_NOT_ALLOWED', 'Nguồn truy cập không được phép.'))['body'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Expose-Headers: Allow');
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token, Idempotency-Key');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'OPTIONS') { http_response_code(204); exit; }
    $path = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/', '/') ?: '/';

    startAppSession();
    $readOnly = in_array($method, ['GET', 'HEAD'], true);
    $isAuth = str_starts_with($path, '/auth/') || str_starts_with($path, '/users/');
    $isCatalog = str_starts_with($path, '/api/');
    // Order API tự kiểm tra CSRF sau xác thực (401 trước 403) theo contract riêng.
    if (($isAuth || $isCatalog) && !$readOnly && !hash_equals($_SESSION['csrfToken'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) throw new ApiException('CSRF token chưa hợp lệ. Hãy tải lại phiên đăng nhập.', 403);

    // Chỉ chạm MySQL khi cần; principal được đối chiếu mỗi request để hủy phiên hết hạn/bị khóa/đổi mật khẩu.
    $model = null;
    $auth = null;
    if ($isAuth || currentPrincipal()) {
        $model = new UserModel(db());
        $auth = new AuthService($model, $_SESSION);
        $auth->session();
    }

    if ($isAuth) {
        $raw = $readOnly ? '' : file_get_contents('php://input', false, null, 0, 65537);
        if (strlen($raw) > 65536) throw new ApiException('Request quá lớn.', 413);
        $input = [];
        if ($raw !== '') {
            try { $decoded = json_decode($raw, false, 32, JSON_THROW_ON_ERROR); }
            catch (JsonException) { throw new ApiException('JSON chưa hợp lệ.', 400); }
            if (!$decoded instanceof stdClass) throw new ApiException('Request phải là JSON object.', 422);
            $input = get_object_vars($decoded);
        }
        if (dispatchAuthRoute($method, $path, $input, $auth) || dispatchUserRoute($method, $path, $input, currentPrincipal(), new UserService($model))) exit;
        throw new ApiException('Endpoint chưa tồn tại.', 404);
    }

    // Catalog/kho/upload tự xuất response và gọi requireAdmin()/requireSessionRole().
    if ($isCatalog) {
        $catalogRoutes = ['product' => 'handleProductRoutes', 'category' => 'handleCategoryRoutes', 'brand' => 'handleBrandRoutes', 'product-attribute' => 'handleProductAttributeRoutes', 'inventory-movement' => 'handleInventoryMovementRoutes', 'inventory' => 'handleInventoryRoutes', 'banner' => 'handleBannerRoutes', 'upload' => 'handleUploadRoutes', 'catalog-admin' => 'handleCatalogAdminRoutes'];
        foreach ($catalogRoutes as $file => $handler) {
            require_once __DIR__ . "/routes/{$file}-routes.php";
            if ($handler($method, $path)) exit;
        }
        throw new ApiException('Endpoint chưa tồn tại.', 404);
    }

    // Order API nhận bản sao phiên theo contract của nó; đóng session để request đơn không khóa nhau.
    $principal = currentPrincipal();
    $orderSession = ['csrfToken' => $_SESSION['csrfToken']];
    if ($principal) $orderSession += ['user' => ['id' => $principal['id'], 'role' => $principal['role']], 'expiresAt' => $principal['expiresAt']];
    session_write_close();
    $raw = $readOnly ? '' : file_get_contents('php://input', false, null, 0, MAX_ORDER_BODY_BYTES + 1);
    $response = handleOrderApi($method, $path, $_GET, $raw === false ? '' : $raw, function_exists('getallheaders') ? getallheaders() : [], $orderSession);
    http_response_code($response['status']);
    foreach ($response['headers'] as $name => $value) header($name . ': ' . $value);
    echo json_encode($response['body'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
} catch (ApiException $error) {
    http_response_code($error->status);
    echo json_encode(['success' => false, 'message' => $error->getMessage(), 'errors' => (object) $error->errors], JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    error_log('API failed: ' . get_class($error));
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Máy chủ không thể xử lý yêu cầu.', 'errors' => (object) []], JSON_UNESCAPED_UNICODE);
}
