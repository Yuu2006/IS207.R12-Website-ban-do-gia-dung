<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

// Load only the worker's required root .env settings as literal values; inherited process settings take precedence.
// Never mix root .env DB_PASSWORD into a caller-supplied DB target (on Windows empty env vars read as false).
$envFile = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env';
$hasExternalDbTarget = getenv('DB_HOST') !== false || getenv('DB_PORT') !== false || getenv('DB_NAME') !== false || getenv('DB_USER') !== false;
$allowedSettings = $hasExternalDbTarget ? ['ORDER_STORAGE_MODE'] : ['ORDER_STORAGE_MODE', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
if (is_file($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES) ?: [] as $line) {
        if (!preg_match('/^\s*([A-Z_]+)\s*=(.*)$/', $line, $matches)) continue;
        $key = $matches[1];
        if (!in_array($key, $allowedSettings, true) || getenv($key) !== false) continue;
        $value = trim($matches[2]);
        if (strlen($value) >= 2 && (($value[0] === '"' && $value[-1] === '"') || ($value[0] === "'" && $value[-1] === "'"))) {
            $value = substr($value, 1, -1);
        }
        putenv($key . '=' . $value);
    }
}

if (getenv('ORDER_STORAGE_MODE') !== 'mysql') { fwrite(STDERR, "ORDER_STORAGE_MODE=mysql required\n"); exit(1); }
require_once __DIR__ . '/../utils/order-api.php';
require_once __DIR__ . '/../config/database.php';
$service = new HomeCare\OrderApi\PaymentService(new HomeCare\OrderApi\OrderModel(db()), $checkout = new HomeCare\OrderApi\MysqlCheckoutDependencies());
echo 'Expired orders: ' . $service->expirePendingVnpay($checkout) . PHP_EOL;
