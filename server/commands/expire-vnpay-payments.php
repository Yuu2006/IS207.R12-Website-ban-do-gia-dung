<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

require_once __DIR__ . '/../utils/order-api.php';
require_once __DIR__ . '/../config/database.php';

use HomeCare\OrderApi\{MysqlCheckoutDependencies, OrderModel, VnpayGateway, VnpayPaymentService};

$limit = 100;
foreach (array_slice($argv, 1) as $argument) {
    if (!preg_match('/^--limit=([0-9]{1,3})$/D', $argument, $matches)) { fwrite(STDERR, "Usage: php expire-vnpay-payments.php [--limit=100]\n"); exit(2); }
    $limit = (int) $matches[1];
}

try {
    $pdo = db();
    $service = new VnpayPaymentService(new OrderModel($pdo), new MysqlCheckoutDependencies(), VnpayGateway::fromEnvironment());
    $count = $service->expirePending($limit);
    fwrite(STDOUT, "Expired VNPay orders: {$count}\n");
} catch (Throwable $error) {
    error_log('VNPay expiry command failed: ' . get_class($error));
    fwrite(STDERR, "VNPay expiry failed. Check database connection and required migrations.\n");
    exit(1);
}
