<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
if (getenv('ORDER_STORAGE_MODE') !== 'mysql') { fwrite(STDERR, "ORDER_STORAGE_MODE=mysql required\n"); exit(1); }
require_once __DIR__ . '/../utils/order-api.php';
require_once __DIR__ . '/../config/database.php';
$service = new HomeCare\OrderApi\PaymentService(new HomeCare\OrderApi\OrderModel(db()), $checkout = new HomeCare\OrderApi\MysqlCheckoutDependencies());
echo 'Expired orders: ' . $service->expirePendingVnpay($checkout) . PHP_EOL;
