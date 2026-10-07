<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

require_once __DIR__ . '/api-response.php';
require_once __DIR__ . '/../middleware/auth-middleware.php';
require_once __DIR__ . '/../middleware/role-middleware.php';
require_once __DIR__ . '/../middleware/validation-middleware.php';
require_once __DIR__ . '/../services/order-service.php';
require_once __DIR__ . '/../services/checkout-service.php';
require_once __DIR__ . '/../controllers/order-controller.php';
require_once __DIR__ . '/../controllers/checkout-controller.php';
require_once __DIR__ . '/../routes/order-routes.php';
require_once __DIR__ . '/../routes/checkout-routes.php';

// CORS credential chỉ cho origin cấu hình; không phản chiếu Origin tùy ý.
function orderCorsHeaders(string $origin, string $allowedOrigin): array
{
    if ($origin === '') {
        return [];
    }
    if ($origin !== $allowedOrigin || $allowedOrigin === '*' || $allowedOrigin === '') {
        throw new ApiException(403, 'ORIGIN_NOT_ALLOWED', 'Nguồn truy cập không được phép.');
    }
    return [
        'Access-Control-Allow-Origin' => $allowedOrigin,
        'Access-Control-Allow-Credentials' => 'true',
        'Access-Control-Allow-Headers' => 'Content-Type, Authorization, X-CSRF-Token, Idempotency-Key',
        'Access-Control-Allow-Methods' => 'GET, POST, PATCH, OPTIONS',
        'Access-Control-Expose-Headers' => 'Allow',
        'Vary' => 'Origin',
    ];
}

// Hàm thuần điều phối dùng chung HTTP/tests; principal test chỉ truyền trực tiếp trong process.
function handleOrderApi(
    string $method,
    string $path,
    array $query = [],
    string $rawBody = '',
    array $headers = [],
    array $serverSession = [],
    ?OrderServiceInterface $orderService = null,
    ?CheckoutServiceInterface $checkoutService = null,
): array {
    try {
        $method = strtoupper($method);
        $path = rtrim($path, '/') ?: '/';
        $headers = array_change_key_case($headers, CASE_LOWER);
        if ($path === '/' && $method === 'GET') {
            return apiSuccess(['version' => '0.1.0', 'orderApi' => 'skeleton', 'storageReady' => false], 'Household E-commerce API');
        }
        $allowedMethods = [];
        $matched = null;
        $orderId = null;
        foreach (array_merge(orderRoutes(), checkoutRoutes()) as $route) {
            if (preg_match($route['pattern'], $path, $captures) !== 1) {
                continue;
            }
            $allowedMethods[] = $route['method'];
            if ($method === $route['method']) {
                $matched = $route;
                $orderId = isset($captures[1]) ? rawurldecode($captures[1]) : null;
                break;
            }
        }
        if ($matched === null) {
            if ($allowedMethods !== []) {
                $response = apiFailure(new ApiException(405, 'METHOD_NOT_ALLOWED', 'HTTP method không được hỗ trợ.'));
                $response['headers']['Allow'] = implode(', ', array_unique($allowedMethods));
                return $response;
            }
            throw new ApiException(404, 'NOT_FOUND', 'Không tìm thấy endpoint.');
        }
        $principal = requireOrderPrincipal($serverSession);
        requireOrderRole($principal, $matched['roles']);
        if ($orderId !== null) {
            $orderId = orderDatabaseId($orderId, 'orderId');
        }
        $key = null;
        if ($method === 'GET') {
            $input = match ($matched['schema']) {
                'list' => validateOrderList($query),
                'sales-list' => validateOrderList($query, true),
                default => [],
            };
            if ($matched['schema'] === 'detail') {
                allowOrderFields($query, []);
            }
        } else {
            requireOrderCsrf($serverSession, $headers);
            allowOrderFields($query, []);
            $body = parseOrderJson($rawBody, $headers);
            if ($matched['schema'] !== 'quote') {
                $key = orderIdempotencyKey($headers);
            }
            $input = match ($matched['schema']) {
                'quote' => validateCheckoutInput($body),
                'create' => validateCheckoutInput($body, true),
                default => validateOrderMutation($body, $matched['schema']),
            };
        }
        $request = ['principal' => $principal, 'orderId' => $orderId, 'input' => $input, 'idempotencyKey' => $key];
        $controller = $matched['controller'] === 'order'
            ? new OrderController($orderService ?? new OrderService())
            : new CheckoutController($checkoutService ?? new CheckoutService());
        return $controller->{$matched['action']}($request);
    } catch (ApiException $error) {
        return apiFailure($error);
    } catch (\Throwable $error) {
        error_log('Order API failed: ' . get_class($error));
        return apiFailure(new ApiException(500, 'INTERNAL_ERROR', 'Máy chủ không thể xử lý yêu cầu.'));
    }
}
