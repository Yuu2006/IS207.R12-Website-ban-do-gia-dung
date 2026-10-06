<?php
declare(strict_types=1);
require_once __DIR__ . '/utils/response.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

// Router mock opt-in; production không được dùng tài khoản demo.
try {
    $origins = array_map('trim', explode(',', getenv('CLIENT_URL') ?: 'http://localhost:5173'));
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        if (!in_array($origin, $origins, true)) throw new ApiException('Origin không được phép.', 403);
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token');
    header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
    $method = $_SERVER['REQUEST_METHOD'];
    if ($method === 'OPTIONS') { http_response_code(204); exit; }
    $path = rtrim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/', '/') ?: '/';
    if ($path === '/' && $method === 'GET') { respondJson(['version' => '0.1.0'], 'Household E-commerce API'); exit; }
    if (!str_starts_with($path, '/auth/') && !str_starts_with($path, '/users/')) throw new ApiException('Endpoint chưa tồn tại.', 404);
    if (getenv('AUTH_DEMO') !== 'true' || getenv('APP_ENV') === 'production') throw new ApiException('Auth/hồ sơ thật chưa triển khai. Bật AUTH_DEMO=true trong môi trường phát triển để dùng API mock.', 503);

    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('HOMECARE_DEMO');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'samesite' => 'Lax']);
    session_start();
    $_SESSION['csrfToken'] ??= bin2hex(random_bytes(32));
    if (!in_array($method, ['GET', 'HEAD'], true) && !hash_equals($_SESSION['csrfToken'], $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) throw new ApiException('CSRF token chưa hợp lệ. Hãy tải lại phiên đăng nhập.', 403);

    $input = [];
    if (!in_array($method, ['GET', 'HEAD'], true)) {
        $raw = file_get_contents('php://input', false, null, 0, 65537);
        if (strlen($raw) > 65536) throw new ApiException('Request quá lớn.', 413);
        if ($raw !== '') {
            try { $decoded = json_decode($raw, false, 32, JSON_THROW_ON_ERROR); }
            catch (JsonException) { throw new ApiException('JSON chưa hợp lệ.', 400); }
            if (!$decoded instanceof stdClass) throw new ApiException('Request phải là JSON object.', 422);
            $input = get_object_vars($decoded);
        }
    }
    require_once __DIR__ . '/routes/auth-routes.php';
    require_once __DIR__ . '/routes/user-routes.php';
    $_SESSION['demoStore'] ??= [];
    $model = new UserModel($_SESSION['demoStore']);
    $auth = new AuthService($model, $_SESSION);
    $auth->session(); // Vô hiệu principal hết hạn trước khi gọi endpoint được bảo vệ.
    if (!dispatchAuthRoute($method, $path, $input, $auth) && !dispatchUserRoute($method, $path, $input, $_SESSION['principal'] ?? null, new UserService($model))) throw new ApiException('Endpoint chưa tồn tại.', 404);
} catch (ApiException $error) {
    http_response_code($error->status);
    echo json_encode(['success' => false, 'message' => $error->getMessage(), 'errors' => (object) $error->errors], JSON_UNESCAPED_UNICODE);
} catch (Throwable) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Máy chủ không thể xử lý yêu cầu.', 'errors' => (object) []], JSON_UNESCAPED_UNICODE);
}
