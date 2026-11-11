<?php
declare(strict_types=1);
namespace HomeCare\OrderApi;

require_once __DIR__ . '/../services/payment-service.php';
require_once __DIR__ . '/../controllers/payment-controller.php';

function runtimePaymentService(): PaymentService
{
    if (getenv('ORDER_STORAGE_MODE') !== 'mysql') throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Thanh toán thật chưa được bật.');
    require_once __DIR__ . '/../config/database.php';
    return new PaymentService(new OrderModel(\db()), new MysqlCheckoutDependencies());
}

// Separate route dispatcher preserves existing order service interfaces; the signed IPN is dispatched in handleOrderApi.
function handlePaymentApi(string $method, string $path, array $query, string $raw, array $headers, array $session): ?array
{
    $matched = preg_match('~^/(orders|sales/orders)/([1-9][0-9]*)/(payment|document)(?:/(confirm-transfer|simulate-refund|customer|internal))?$~D', $path, $parts);
    $byReference = preg_match('~^/payments/reference/([A-Za-z0-9-]{1,80})$~D', $path, $reference);
    if (!$matched && !$byReference && !in_array($path, ['/payments/methods', '/addresses'], true) && !($path === '/cart' && $method === 'PUT')) return null;
    $actor = requireOrderPrincipal($session);
    $staff = $matched && $parts[1] === 'sales/orders';
    requireOrderRole($actor, $staff ? ['SALES', 'ADMIN'] : ['CUSTOMER']);
    if ($method === 'GET') {
        if ($query) throw new ApiException(422, 'INVALID_INPUT', 'Endpoint không nhận query.');
        $controller = new PaymentController(runtimePaymentService());
        if ($path === '/payments/methods') return $controller->methods();
        if ($path === '/addresses') {
            require_once __DIR__ . '/../models/catalog-checkout-model.php';
            $orders = new OrderModel(\db()); $orders->requireActor($actor, ['CUSTOMER']);
            $adapter = new CatalogCheckoutDependencies();
            return apiSuccess($adapter->addresses($orders->pdo, $actor));
        }
        if ($byReference) return $controller->reference($actor, $reference[1]);
        if (in_array($parts[4] ?? '', ['confirm-transfer', 'simulate-refund'], true)) throw new ApiException(405, 'METHOD_NOT_ALLOWED', 'Cần dùng POST.');
        return $parts[3] === 'payment' ? $controller->status($actor, $parts[2], $staff) : $controller->document($actor, $parts[2], $staff, strtoupper($parts[4] ?? 'customer'));
    }
    if ($method === 'POST' && $matched && $staff && $parts[3] === 'payment' && in_array($parts[4] ?? '', ['confirm-transfer', 'simulate-refund'], true)) {
        if ($parts[4] === 'simulate-refund') requireOrderRole($actor, ['ADMIN']);
        requireOrderCsrf($session, $headers);
        if ($query) throw new ApiException(422, 'INVALID_INPUT', 'Endpoint không nhận query.');
        $controller = new PaymentController(runtimePaymentService());
        $input = parseOrderJson($raw, $headers); $key = orderIdempotencyKey($headers);
        return $parts[4] === 'simulate-refund' ? $controller->refund($actor, $parts[2], $input, $key) : $controller->confirm($actor, $parts[2], $input, $key);
    }
    if ($method === 'PUT' && $path === '/cart') {
        requireOrderCsrf($session, $headers);
        if ($query) throw new ApiException(422, 'INVALID_INPUT', 'Endpoint không nhận query.');
        runtimePaymentService();
        require_once __DIR__ . '/../models/catalog-checkout-model.php';
        $orders = new OrderModel(\db()); $orders->requireActor($actor, ['CUSTOMER']);
        return apiSuccess((new CatalogCheckoutDependencies())->replaceCart($orders->pdo, $actor, parseOrderJson($raw, $headers), orderIdempotencyKey($headers)));
    }
    throw new ApiException(405, 'METHOD_NOT_ALLOWED', 'HTTP method không hỗ trợ.');
}

// Customer-owned VNPay attempt lookup used by the browser return page; it never settles a payment.
function paymentRoutes(): array
{
    return [
        ['method' => 'GET', 'path' => '/payments/vnpay/attempts/{paymentCode}', 'pattern' => '~^/payments/vnpay/attempts/([^/]+)$~D', 'roles' => ['CUSTOMER'], 'controller' => 'payment', 'action' => 'getAttempt', 'schema' => 'payment-attempt'],
    ];
}
