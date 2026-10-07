<?php
declare(strict_types=1);

require_once __DIR__ . '/utils/order-api.php';

use HomeCare\OrderApi\ApiException;
use function HomeCare\OrderApi\apiFailure;
use function HomeCare\OrderApi\handleOrderApi;
use function HomeCare\OrderApi\orderCorsHeaders;
use const HomeCare\OrderApi\MAX_ORDER_BODY_BYTES;

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

try {
    foreach (orderCorsHeaders($_SERVER['HTTP_ORIGIN'] ?? '', getenv('CLIENT_URL') ?: 'http://localhost:5173') as $name => $value) {
        header($name . ': ' . $value);
    }
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
    // Auth owner sẽ cấp session thật; skeleton không tự tạo user/role/fixture từ request.
    $serverSession = [];
    if (isset($_COOKIE[session_name()])) {
        $started = session_start([
            'read_and_close' => true, 'use_strict_mode' => true, 'use_only_cookies' => true,
            'cookie_httponly' => true, 'cookie_samesite' => 'Lax',
            'cookie_secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
        ]);
        if (!$started) {
            throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Chưa thể kiểm tra phiên đăng nhập.');
        }
        $serverSession = $_SESSION;
    }
    $rawBody = file_get_contents('php://input', false, null, 0, MAX_ORDER_BODY_BYTES + 1);
    $response = handleOrderApi(
        $_SERVER['REQUEST_METHOD'] ?? 'GET',
        parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/',
        $_GET,
        $rawBody === false ? '' : $rawBody,
        function_exists('getallheaders') ? getallheaders() : [],
        $serverSession,
    );
} catch (ApiException $error) {
    $response = apiFailure($error);
} catch (Throwable $error) {
    error_log('Order API bootstrap failed: ' . get_class($error));
    $response = apiFailure(new ApiException(500, 'INTERNAL_ERROR', 'Máy chủ không thể xử lý yêu cầu.'));
}

http_response_code($response['status']);
foreach ($response['headers'] as $name => $value) {
    header($name . ': ' . $value);
}
echo json_encode($response['body'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
