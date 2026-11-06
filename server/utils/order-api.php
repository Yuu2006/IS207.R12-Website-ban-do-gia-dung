<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

require_once __DIR__ . '/api-response.php';
require_once __DIR__ . '/../middleware/auth-middleware.php';
require_once __DIR__ . '/../middleware/role-middleware.php';
require_once __DIR__ . '/../middleware/validation-middleware.php';
require_once __DIR__ . '/order-domain.php';
require_once __DIR__ . '/../models/order-model.php';
require_once __DIR__ . '/../models/payment-model.php';
require_once __DIR__ . '/../models/order-idempotency-model.php';
require_once __DIR__ . '/../models/checkout-model.php';
require_once __DIR__ . '/../services/vnpay-gateway.php';
require_once __DIR__ . '/../services/vnpay-payment-service.php';
require_once __DIR__ . '/../models/checkout-runtime-model.php';
require_once __DIR__ . '/../services/checkout-dependencies.php';
require_once __DIR__ . '/../services/mysql-checkout-dependencies.php';
require_once __DIR__ . '/../services/order-service.php';
require_once __DIR__ . '/../services/mysql-device-care-completion.php';
require_once __DIR__ . '/../services/checkout-service.php';
require_once __DIR__ . '/../services/cart-service.php';
require_once __DIR__ . '/../controllers/order-controller.php';
require_once __DIR__ . '/../controllers/checkout-controller.php';
require_once __DIR__ . '/../controllers/cart-controller.php';
require_once __DIR__ . '/../controllers/vnpay-payment-controller.php';
require_once __DIR__ . '/../models/return-refund-model.php';
require_once __DIR__ . '/../services/return-refund-service.php';
require_once __DIR__ . '/../controllers/return-refund-controller.php';
require_once __DIR__ . '/../models/report-model.php';
require_once __DIR__ . '/../services/report-service.php';
require_once __DIR__ . '/../controllers/report-controller.php';
require_once __DIR__ . '/../routes/order-routes.php';
require_once __DIR__ . '/../routes/checkout-routes.php';
require_once __DIR__ . '/../routes/cart-routes.php';
require_once __DIR__ . '/../routes/payment-routes.php';
require_once __DIR__ . '/../routes/return-refund-routes.php';
require_once __DIR__ . '/../routes/report-routes.php';

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

// Opt-in MySQL runtime; neither test credentials nor principal fixtures are exposed via HTTP.
function runtimeOrderService(): OrderServiceInterface
{
    if (getenv('ORDER_STORAGE_MODE') !== 'mysql') return new OrderService();
    try {
        require_once __DIR__ . '/../config/database.php';
        $pdo = \db();
        return new OrderService(new OrderModel($pdo), new MysqlCheckoutDependencies(), new MysqlDeviceCareCompletion());
    } catch (\PDOException $error) {
        error_log('Order database unavailable: ' . $error->getCode());
        throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Chưa thể kết nối dữ liệu đơn hàng.');
    }
}

// Only production SQL adapter is loaded here; test fixtures are never exposed by HTTP.
function runtimeCheckoutService(): CheckoutServiceInterface
{
    if (getenv('ORDER_STORAGE_MODE') !== 'mysql') return new CheckoutService();
    try {
        require_once __DIR__ . '/../config/database.php';
        $pdo = \db();
        return new CheckoutService(new OrderModel($pdo), new MysqlCheckoutDependencies(), VnpayGateway::fromEnvironment());
    } catch (\PDOException $error) {
        error_log('Checkout database unavailable: ' . $error->getCode());
        throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Chưa thể kết nối dữ liệu checkout.');
    }
}

function runtimeVnpayPaymentService(): VnpayPaymentServiceInterface
{
    if (getenv('ORDER_STORAGE_MODE') !== 'mysql') throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Dịch vụ thanh toán chưa sẵn sàng.');
    try {
        require_once __DIR__ . '/../config/database.php';
        $pdo = \db();
        return new VnpayPaymentService(new OrderModel($pdo), new MysqlCheckoutDependencies(), VnpayGateway::fromEnvironment());
    } catch (\PDOException $error) {
        error_log('VNPay database unavailable: ' . $error->getCode());
        throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Chưa thể kết nối dữ liệu thanh toán.');
    }
}

// Customer cart reads share the current MySQL checkout contract and role validation.
function runtimeCartService(): CartServiceInterface
{
    if (getenv('ORDER_STORAGE_MODE') !== 'mysql') return new CartService();
    try {
        require_once __DIR__ . '/../config/database.php';
        $pdo = \db();
        return new CartService(new OrderModel($pdo), new MysqlCheckoutDependencies());
    } catch (\PDOException $error) {
        error_log('Cart database unavailable: ' . $error->getCode());
        throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Chưa thể kết nối dữ liệu giỏ hàng.');
    }
}

// Hàm thuần điều phối dùng chung HTTP/tests; principal test chỉ truyền trực tiếp trong process.
// Return workflow and revenue export require the reviewed MySQL schema; never claim fake success.
function runtimeReturnRefundService(): ReturnRefundService
{
    if (getenv('ORDER_STORAGE_MODE') !== 'mysql') throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Dịch vụ trả hàng chưa được cấu hình.');
    try {
        require_once __DIR__ . '/../config/database.php';
        $pdo = \db();
        return new ReturnRefundService($pdo, new ReturnRefundModel($pdo));
    } catch (\PDOException $error) {
        error_log('Return workflow database unavailable: ' . $error->getCode());
        throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Chưa thể kết nối dữ liệu trả hàng.');
    }
}

function runtimeReportService(): ReportService
{
    if (getenv('ORDER_STORAGE_MODE') !== 'mysql') throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Dịch vụ báo cáo chưa được cấu hình.');
    try {
        require_once __DIR__ . '/../config/database.php';
        $pdo = \db();
        return new ReportService($pdo, new ReportModel($pdo));
    } catch (\PDOException $error) {
        error_log('Report database unavailable: ' . $error->getCode());
        throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Chưa thể kết nối dữ liệu báo cáo.');
    }
}

function handleOrderApi(
    string $method,
    string $path,
    array $query = [],
    string $rawBody = '',
    array $headers = [],
    array $serverSession = [],
    ?OrderServiceInterface $orderService = null,
    ?CheckoutServiceInterface $checkoutService = null,
    ?CartServiceInterface $cartService = null,
    ?VnpayPaymentServiceInterface $vnpayPaymentService = null,
    ?ReturnRefundService $returnRefundService = null,
    ?ReportService $reportService = null,
): array {
    try {
        $method = strtoupper($method);
        $path = rtrim($path, '/') ?: '/';
        $headers = array_change_key_case($headers, CASE_LOWER);
        if ($path === '/' && $method === 'GET') {
            return apiSuccess(['version' => '0.1.0', 'orderApi' => getenv('ORDER_STORAGE_MODE') === 'mysql' ? 'mysql-configured' : 'skeleton', 'storageReady' => false], 'Household E-commerce API');
        }
        if ($path === '/payments/vnpay/ipn') {
            if (!in_array($method, ['GET', 'POST'], true)) return ['status' => 405, 'headers' => ['Allow' => 'GET, POST'], 'body' => ['RspCode' => '99', 'Message' => 'System error']];
            $parameters = $query;
            if ($method === 'POST') {
                $contentType = strtolower(trim(explode(';', $headers['content-type'] ?? '')[0]));
                if ($contentType === 'application/x-www-form-urlencoded' && strlen($rawBody) <= MAX_ORDER_BODY_BYTES) parse_str($rawBody, $parameters);
                else $parameters = [];
            }
            try {
                $response = ($vnpayPaymentService ?? runtimeVnpayPaymentService())->handleIpn($parameters);
            } catch (\Throwable $error) {
                error_log('VNPay IPN endpoint unavailable: ' . get_class($error));
                $response = ['RspCode' => '99', 'Message' => 'System error'];
            }
            return ['status' => 200, 'headers' => [], 'body' => $response];
        }
        $allowedMethods = [];
        $matched = null;
        $orderId = null;
        $variantId = null;
        $returnId = null;
        $paymentCode = null;
        foreach (array_merge(orderRoutes(), checkoutRoutes(), cartRoutes(), paymentRoutes(), returnRefundRoutes(), reportRoutes()) as $route) {
            if (preg_match($route['pattern'], $path, $captures) !== 1) {
                continue;
            }
            $allowedMethods[] = $route['method'];
            if ($method === $route['method']) {
                $matched = $route;
                if (isset($captures[1])) {
                    $pathValue = rawurldecode($captures[1]);
                    if ($route['schema'] === 'payment-attempt') $paymentCode = $pathValue;
                    elseif (str_starts_with($route['schema'], 'return-')) $returnId = $pathValue;
                    elseif ($route['schema'] === 'cart-update') $variantId = $pathValue;
                    else $orderId = $pathValue;
                }
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
        if ($returnId !== null) $returnId = orderDatabaseId($returnId, 'returnId');
        $key = null;
        if ($method === 'GET') {
            $input = match ($matched['schema']) {
                'list' => validateOrderList($query),
                'sales-list' => validateOrderList($query, true),
                'return-list' => validateReturnList($query),
                'report-range' => validateRevenueRange($query),
                default => [],
            };
            if (in_array($matched['schema'], ['detail', 'return-detail'], true)) {
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
                'cart-add' => validateCartAdd($body),
                'cart-update' => validateCartUpdate($body),
                'return-triage', 'return-decision', 'return-receive' => validateReturnMutation($body, $matched['schema']),
                default => validateOrderMutation($body, $matched['schema']),
            };
        }
        $request = ['principal' => $principal, 'orderId' => $orderId, 'variantId' => $variantId, 'returnId' => $returnId, 'paymentCode' => $paymentCode, 'input' => $input, 'idempotencyKey' => $key];
        $controller = match ($matched['controller']) {
            'order' => new OrderController($orderService ?? runtimeOrderService()),
            'cart' => new CartController($cartService ?? runtimeCartService()),
            'payment' => new VnpayPaymentController($vnpayPaymentService ?? runtimeVnpayPaymentService()),
            'return-refund' => new ReturnRefundController($returnRefundService ?? runtimeReturnRefundService()),
            'report' => new ReportController($reportService ?? runtimeReportService()),
            default => new CheckoutController($checkoutService ?? runtimeCheckoutService()),
        };
        return $controller->{$matched['action']}($request);
    } catch (ApiException $error) {
        return apiFailure($error);
    } catch (\PDOException $error) {
        error_log('Order database query failed: ' . $error->getCode());
        if (in_array((int) ($error->errorInfo[1] ?? 0), [1054, 1146], true)) return apiFailure(new ApiException(503, 'ORDER_SCHEMA_NOT_READY', 'Schema đơn hàng chưa sẵn sàng. Cần kiểm tra migration.'));
        if (in_array((int) ($error->errorInfo[1] ?? 0), [1205, 1213], true)) return apiFailure(new ApiException(503, 'REQUEST_RETRYABLE', 'Dữ liệu đang được xử lý. Vui lòng thử lại.'));
        return apiFailure(new ApiException(500, 'INTERNAL_ERROR', 'Máy chủ không thể xử lý yêu cầu.'));
    } catch (\Throwable $error) {
        error_log('Order API failed: ' . get_class($error));
        return apiFailure(new ApiException(500, 'INTERNAL_ERROR', 'Máy chủ không thể xử lý yêu cầu.'));
    }
}
