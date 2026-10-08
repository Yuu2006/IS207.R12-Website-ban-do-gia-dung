<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../utils/order-api.php';

use HomeCare\OrderApi\ApiException;
use HomeCare\OrderApi\OrderServiceInterface;
use HomeCare\OrderApi\CheckoutServiceInterface;
use function HomeCare\OrderApi\handleOrderApi;
use function HomeCare\OrderApi\orderCorsHeaders;
use function HomeCare\OrderApi\orderRoutes;
use function HomeCare\OrderApi\checkoutRoutes;

$spec = json_decode(file_get_contents(__DIR__ . '/../../docs/api/order-checkout.openapi.json'), true, 512, JSON_THROW_ON_ERROR);
$checks = 0;
$failures = 0;
$session = ['user' => ['id' => '1', 'role' => 'CUSTOMER', 'fullName' => 'Khách hàng'], 'expiresAt' => time() + 3600, 'csrfToken' => 'test-csrf-token'];
$headers = ['Content-Type' => 'application/json', 'X-CSRF-Token' => 'test-csrf-token', 'Idempotency-Key' => 'b5576303-2f2f-469a-b90c-5a7a99fb37d3'];

// Test doubles chỉ trong process CLI; index/router thật không import file này.
class FixtureOrderService implements OrderServiceInterface
{
    public array $calls = [];

    public function __construct(protected array $spec)
    {
    }

    protected function result(string $method, string $path, array $arguments): array
    {
        $this->calls[] = [$method, $arguments];
        return $this->spec['paths'][$path][strtolower($method)]['responses']['200']['content']['application/json']['example']['data'];
    }

    public function listCustomerOrders(array $principal, array $filters): array
    {
        return $this->result('GET', '/orders', func_get_args());
    }

    public function getCustomerOrder(array $principal, string $orderId): array
    {
        if ($principal['id'] !== '1' || $orderId !== '101') {
            throw new ApiException(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
        }
        return $this->result('GET', '/orders/{orderId}', func_get_args());
    }

    public function cancelOrder(array $principal, string $orderId, array $input, string $key): array
    {
        return $this->result('POST', '/orders/{orderId}/cancel', func_get_args());
    }

    public function reorder(array $principal, string $orderId, array $input, string $key): array
    {
        return $this->result('POST', '/orders/{orderId}/reorder', func_get_args());
    }

    public function createReturnRequest(array $principal, string $orderId, array $input, string $key): array
    {
        $this->calls[] = ['POST', func_get_args()];
        return $this->spec['paths']['/orders/{orderId}/returns']['post']['responses']['201']['content']['application/json']['example']['data'];
    }

    public function listSalesOrders(array $principal, array $filters): array
    {
        return $this->result('GET', '/sales/orders', func_get_args());
    }

    public function getSalesOrder(array $principal, string $orderId): array
    {
        return $this->result('GET', '/sales/orders/{orderId}', func_get_args());
    }

    public function updateSalesStatus(array $principal, string $orderId, array $input, string $key): array
    {
        return $this->result('PATCH', '/sales/orders/{orderId}/status', func_get_args());
    }
}

class FixtureCheckoutService implements CheckoutServiceInterface
{
    public array $calls = [];

    public function __construct(private readonly array $spec)
    {
    }

    public function quoteCheckout(array $principal, array $input): array
    {
        $this->calls[] = func_get_args();
        return $this->spec['paths']['/checkout/quote']['post']['responses']['200']['content']['application/json']['example']['data'];
    }

    public function createOrder(array $principal, array $input, string $key): array
    {
        $this->calls[] = func_get_args();
        return $this->spec['paths']['/checkout/orders']['post']['responses']['201']['content']['application/json']['example']['data'];
    }
}

function ensure(bool $condition, string $message = 'Assertion failed'): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function check(string $name, callable $test): void
{
    global $checks, $failures;
    $checks++;
    try {
        $test();
        echo "ok {$checks} - {$name}\n";
    } catch (Throwable $error) {
        $failures++;
        echo "not ok {$checks} - {$name}: {$error->getMessage()}\n";
    }
}

function request(string $method, string $path, array $body = [], array $query = [], ?array $principalSession = null, ?array $requestHeaders = null, ?OrderServiceInterface $orders = null, ?CheckoutServiceInterface $checkout = null): array
{
    global $session, $headers;
    return handleOrderApi($method, $path, $query, json_encode((object) $body, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), $requestHeaders ?? $headers, $principalSession ?? $session, $orders, $checkout);
}

function expectError(array $response, int $status, string $code): void
{
    ensure($response['status'] === $status, "Expected {$status}, got {$response['status']}");
    ensure($response['body']['success'] === false);
    ensure($response['body']['errors']['code'] === $code, "Expected {$code}");
    ensure(!array_key_exists('data', $response['body']));
}

function roleSession(string $role): array
{
    global $session;
    return array_replace($session, ['user' => array_replace($session['user'], ['role' => $role])]);
}

check('ten PHP routes match OpenAPI methods, operation IDs and role matrix', function () use ($spec): void {
    $routes = array_merge(orderRoutes(), checkoutRoutes());
    ensure(count($routes) === 10);
    foreach ($routes as $route) {
        $operation = $spec['paths'][$route['path']][strtolower($route['method'])];
        ensure($operation['operationId'] === $route['action']);
        ensure($operation['x-roles'] === $route['roles']);
    }
});

check('only explicit health is 200; unknown path is 404 and wrong method is 405', function (): void {
    $health = request('GET', '/');
    ensure($health['status'] === 200 && $health['body']['data']['storageReady'] === false);
    expectError(request('GET', '/unknown'), 404, 'NOT_FOUND');
    $method = request('POST', '/orders');
    expectError($method, 405, 'METHOD_NOT_ALLOWED');
    ensure($method['headers']['Allow'] === 'GET');
});

check('all protected routes reject anonymous before validation/service', function (): void {
    foreach (array_merge(orderRoutes(), checkoutRoutes()) as $route) {
        expectError(request($route['method'], str_replace('{orderId}', '101', $route['path']), [], [], []), 401, 'AUTH_REQUIRED');
    }
});

check('client userId/role/Authorization/sessionEstablished cannot become principal', function (): void {
    expectError(request('GET', '/orders', [], ['customerId' => '1', 'role' => 'ADMIN'], [], ['Authorization' => 'Bearer fake', 'X-Role' => 'ADMIN']), 401, 'AUTH_REQUIRED');
    expectError(request('POST', '/checkout/orders', ['userId' => '1', 'role' => 'CUSTOMER', 'sessionEstablished' => true], [], []), 401, 'AUTH_REQUIRED');
});

check('expired/malformed server session is 401 and non-MVP role is 403', function () use ($session): void {
    foreach ([[], array_replace($session, ['expiresAt' => time()]), array_replace($session, ['expiresAt' => '9999999999']), array_replace($session, ['user' => ['id' => 'preview:user', 'role' => 'CUSTOMER']])] as $invalid) {
        expectError(request('GET', '/orders', [], [], $invalid), 401, 'AUTH_REQUIRED');
    }
    expectError(request('GET', '/orders', [], [], roleSession('TECHNICIAN')), 403, 'FORBIDDEN');
});

check('all four roles obey endpoint role matrix; allowed valid request reaches 503 service', function () use ($spec): void {
    foreach (array_merge(orderRoutes(), checkoutRoutes()) as $route) {
        $operation = $spec['paths'][$route['path']][strtolower($route['method'])];
        $body = $operation['requestBody']['content']['application/json']['example'] ?? [];
        foreach (['CUSTOMER', 'ADMIN', 'SALES', 'WAREHOUSE'] as $role) {
            $response = request($route['method'], str_replace('{orderId}', '101', $route['path']), $body, [], roleSession($role));
            $allowed = in_array($role, $route['roles'], true);
            expectError($response, $allowed ? 503 : 403, $allowed ? 'SERVICE_UNAVAILABLE' : 'FORBIDDEN');
        }
    }
});

check('write endpoints require matching server CSRF token; quote does not need idempotency key', function () use ($headers, $spec): void {
    $body = $spec['paths']['/checkout/quote']['post']['requestBody']['content']['application/json']['example'];
    foreach ([['Content-Type' => 'application/json'], array_replace($headers, ['X-CSRF-Token' => 'wrong'])] as $invalid) {
        expectError(request('POST', '/checkout/quote', $body, [], null, $invalid), 403, 'CSRF_INVALID');
    }
    expectError(request('POST', '/checkout/quote', $body, [], null, ['Content-Type' => 'application/json', 'X-CSRF-Token' => 'test-csrf-token']), 503, 'SERVICE_UNAVAILABLE');
});

check('malformed JSON, non-object, unsupported media and oversized payload use correct status', function () use ($headers, $session): void {
    expectError(handleOrderApi('POST', '/orders/101/cancel', [], '{bad', $headers, $session), 400, 'MALFORMED_JSON');
    foreach (['[]', 'null', 'true', '"text"'] as $body) {
        expectError(handleOrderApi('POST', '/orders/101/cancel', [], $body, $headers, $session), 422, 'INVALID_INPUT');
    }
    expectError(handleOrderApi('POST', '/orders/101/cancel', [], '{}', array_replace($headers, ['Content-Type' => 'text/plain']), $session), 415, 'UNSUPPORTED_MEDIA_TYPE');
    expectError(handleOrderApi('POST', '/orders/101/cancel', [], str_repeat('x', 16385), $headers, $session), 413, 'REQUEST_BODY_TOO_LARGE');
});

check('mutations reject absent/short/unsafe idempotency key before service', function () use ($headers): void {
    foreach (['', 'short', str_repeat('x', 129), 'space not allowed'] as $key) {
        expectError(request('POST', '/orders/101/cancel', ['expectedVersion' => 1, 'reason' => 'Đổi nhu cầu'], [], null, array_replace($headers, ['Idempotency-Key' => $key])), 422, 'IDEMPOTENCY_KEY_REQUIRED');
    }
});

check('body/query privileged and price fields are rejected, not silently ignored', function (): void {
    foreach (['role', 'actorId', 'customerId', 'paymentStatus', 'price', 'total', 'stock'] as $field) {
        $body = ['expectedVersion' => 1, 'reason' => 'Đổi nhu cầu', $field => 'forged'];
        expectError(request('POST', '/orders/101/cancel', $body), 422, 'INVALID_INPUT');
    }
    expectError(request('GET', '/orders', [], ['customerId' => '2']), 422, 'INVALID_INPUT');
    expectError(request('GET', '/orders/101', [], ['role' => 'ADMIN']), 422, 'INVALID_INPUT');
});

check('list filters normalize before controller/service; pagination and search are bounded', function () use ($spec): void {
    $service = new FixtureOrderService($spec);
    $response = request('GET', '/orders', [], ['status' => 'confirmed,preparing,confirmed', 'page' => '2', 'pageSize' => '5'], null, null, $service);
    ensure($response['status'] === 200);
    ensure($service->calls[0][1][0]['id'] === '1');
    ensure($service->calls[0][1][1] === ['page' => 2, 'pageSize' => 5, 'statuses' => ['confirmed', 'preparing']]);
    foreach ([['page' => '0'], ['page' => '1.5'], ['page' => ['1']], ['pageSize' => '51'], ['status' => 'processing'], ['status' => ['pending']]] as $invalid) {
        expectError(request('GET', '/orders', [], $invalid), 422, 'INVALID_INPUT');
    }
    expectError(request('GET', '/sales/orders', [], ['search' => str_repeat('x', 101)], roleSession('SALES')), 422, 'INVALID_INPUT');
});

check('database IDs are positive strings; encoded slash/code/zero fail validation', function (): void {
    foreach (['0', 'HC2026100001', '101%2Fforeign', '-1', '18446744073709551616', str_repeat('9', 21)] as $id) {
        expectError(request('GET', '/orders/' . $id), 422, 'INVALID_INPUT');
    }
});

check('detail/timeline response and service ownership error propagate without leak', function () use ($spec, $session): void {
    $service = new FixtureOrderService($spec);
    $response = request('GET', '/orders/101', [], [], null, null, $service);
    ensure($response['status'] === 200 && count($response['body']['data']['history']) === 1);
    $foreign = array_replace($session, ['user' => ['id' => '2', 'role' => 'CUSTOMER']]);
    expectError(request('GET', '/orders/101', [], [], $foreign, null, $service), 404, 'ORDER_NOT_FOUND');
    expectError(request('GET', '/orders/999', [], [], null, null, $service), 404, 'ORDER_NOT_FOUND');
});

check('cancel controller passes server actor/id/version/reason/key and returns envelope', function () use ($spec, $headers): void {
    $service = new FixtureOrderService($spec);
    $response = request('POST', '/orders/101/cancel', ['expectedVersion' => 1, 'reason' => '  Đổi nhu cầu  '], [], null, null, $service);
    ensure($response['status'] === 200 && $response['body']['data']['orderStatus'] === 'cancelled');
    $arguments = $service->calls[0][1];
    ensure($arguments[0]['role'] === 'CUSTOMER' && $arguments[1] === '101');
    ensure($arguments[2] === ['expectedVersion' => 1, 'reason' => 'Đổi nhu cầu']);
    ensure($arguments[3] === $headers['Idempotency-Key']);
    expectError(request('POST', '/orders/101/cancel', ['expectedVersion' => 1, 'reason' => '   ']), 422, 'REASON_REQUIRED');
    expectError(request('POST', '/orders/101/cancel', ['expectedVersion' => '1', 'reason' => 'Đổi nhu cầu']), 422, 'INVALID_INPUT');
});

check('return controller validates reason/version and returns 201 without claiming refund', function () use ($spec): void {
    $service = new FixtureOrderService($spec);
    $response = request('POST', '/orders/101/returns', ['expectedVersion' => 5, 'reason' => '  Hỏng khi nhận  '], [], null, null, $service);
    ensure($response['status'] === 201 && $response['body']['data']['status'] === 'requested');
    ensure($service->calls[0][1][2] === ['expectedVersion' => 5, 'reason' => 'Hỏng khi nhận']);
    expectError(request('POST', '/orders/101/returns', ['expectedVersion' => 5, 'reason' => '']), 422, 'REASON_REQUIRED');
    expectError(request('POST', '/orders/101/returns', ['expectedVersion' => 5, 'reason' => 'Test', 'refundAmount' => 1]), 422, 'INVALID_INPUT');
});

check('reorder controller delegates current-cart version instead of snapshot pricing', function () use ($spec): void {
    $service = new FixtureOrderService($spec);
    $response = request('POST', '/orders/101/reorder', ['expectedCartVersion' => 3], [], null, null, $service);
    ensure($response['status'] === 200 && $response['body']['data']['cartVersion'] === 4);
    ensure($service->calls[0][1][2] === ['expectedCartVersion' => 3]);
});

check('sales search/detail/status delegate through dedicated SALES/ADMIN controller', function () use ($spec): void {
    $service = new FixtureOrderService($spec);
    ensure(request('GET', '/sales/orders', [], ['search' => ' HC202610 '], roleSession('SALES'), null, $service)['status'] === 200);
    ensure($service->calls[0][1][1]['search'] === 'HC202610');
    ensure(request('GET', '/sales/orders/101', [], [], roleSession('ADMIN'), null, $service)['status'] === 200);
    ensure(request('PATCH', '/sales/orders/101/status', ['expectedVersion' => 4, 'toStatus' => 'delivered', 'codCollected' => true], [], roleSession('SALES'), null, $service)['status'] === 200);
    ensure($service->calls[2][1][2]['codCollected'] === true);
    expectError(request('PATCH', '/sales/orders/101/status', ['expectedVersion' => 4, 'toStatus' => 'confirmed', 'codCollected' => true], [], roleSession('SALES')), 422, 'INVALID_INPUT');
    expectError(request('PATCH', '/sales/orders/101/status', ['expectedVersion' => 4, 'toStatus' => 'delivered', 'codCollected' => 'true'], [], roleSession('SALES')), 422, 'INVALID_INPUT');
});

check('checkout quote and create have validated DTO input and 200/201 envelopes', function () use ($spec): void {
    $service = new FixtureCheckoutService($spec);
    $quote = $spec['paths']['/checkout/quote']['post']['requestBody']['content']['application/json']['example'];
    $create = $spec['paths']['/checkout/orders']['post']['requestBody']['content']['application/json']['example'];
    ensure(request('POST', '/checkout/quote', $quote, [], null, null, null, $service)['status'] === 200);
    $result = request('POST', '/checkout/orders', $create, [], null, null, null, $service);
    ensure($result['status'] === 201 && $result['body']['success'] === true);
    ensure($service->calls[1][0]['id'] === '1' && $service->calls[1][1] === $create);
    expectError(request('POST', '/checkout/quote', array_replace($quote, ['addressId' => 12])), 422, 'INVALID_INPUT');
    expectError(request('POST', '/checkout/quote', array_replace($quote, ['paymentMethod' => 'BANK'])), 422, 'INVALID_INPUT');
    expectError(request('POST', '/checkout/orders', array_replace($create, ['note' => str_repeat('à', 501)])), 422, 'INVALID_INPUT');
});

check('all default services fail closed without database connection or fixture success', function () use ($spec): void {
    foreach (array_merge(orderRoutes(), checkoutRoutes()) as $route) {
        $operation = $spec['paths'][$route['path']][strtolower($route['method'])];
        $body = $operation['requestBody']['content']['application/json']['example'] ?? [];
        expectError(request($route['method'], str_replace('{orderId}', '101', $route['path']), $body, [], roleSession($route['roles'][0])), 503, 'SERVICE_UNAVAILABLE');
    }
    ensure(!function_exists('db'));
});

check('unexpected service exception becomes generic 500; no SQL/stack in public body', function () use ($spec): void {
    $service = new class($spec) extends FixtureOrderService {
        public function listCustomerOrders(array $principal, array $filters): array
        {
            throw new RuntimeException('Private SQL connection detail');
        }
    };
    $response = request('GET', '/orders', [], [], null, null, $service);
    expectError($response, 500, 'INTERNAL_ERROR');
    ensure(!str_contains(json_encode($response), 'Private SQL'));
    ensure(str_contains(json_encode($response['body']['errors']), '"fields":{}'));
});

check('credential CORS is exact configured origin; wildcard/untrusted origin rejected', function (): void {
    $cors = orderCorsHeaders('http://localhost:5173', 'http://localhost:5173');
    ensure($cors['Access-Control-Allow-Origin'] === 'http://localhost:5173');
    ensure($cors['Access-Control-Allow-Credentials'] === 'true');
    ensure(orderCorsHeaders('', 'http://localhost:5173') === []);
    foreach ([['https://attacker.test', 'http://localhost:5173'], ['http://localhost:5173', '*']] as [$origin, $configured]) {
        try {
            orderCorsHeaders($origin, $configured);
            throw new RuntimeException('Expected CORS rejection');
        } catch (ApiException $error) {
            ensure($error->status === 403 && $error->errorCode === 'ORIGIN_NOT_ALLOWED');
        }
    }
});

echo "{$checks} tests, " . ($checks - $failures) . " passed, {$failures} failed\n";
exit($failures === 0 ? 0 : 1);
