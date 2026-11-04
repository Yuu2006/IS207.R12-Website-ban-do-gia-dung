<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' || getenv('ORDER_MYSQL_TEST') !== 'isolated') {
    http_response_code(404);
    exit;
}

require_once __DIR__ . '/../services/tco-service.php';

$name = getenv('DB_NAME');
$port = getenv('DB_PORT');
if (getenv('DB_HOST') !== '127.0.0.1' || !preg_match('/^homecare_order_test_[0-9]+$/D', $name ?: '') || !ctype_digit($port ?: '') || (int) $port === 3306) {
    throw new RuntimeException('Unsafe test database target.');
}

$pdo = new PDO("mysql:host=127.0.0.1;port={$port};dbname={$name};charset=utf8mb4", 'root', '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_EMULATE_PREPARES => false,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec("SET time_zone = '+00:00'");
$mode = $argv[1] ?? 'test';

function tcoDbEnsure(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function tcoDbRequest(array $overrides = []): array
{
    return array_replace([
        'productIds' => [20, 21],
        'variantIds' => [30, 31],
        'years' => 3,
        'usesPerWeek' => 5,
        'hoursPerUse' => '1.50',
        'electricityVndPerKwh' => '3000',
        'waterVndPerM3' => '25000',
        'annualCosts' => [
            ['productId' => 20, 'consumablesVndPerYear' => '100000', 'maintenanceVndPerYear' => '50000'],
            ['productId' => 21, 'consumablesVndPerYear' => '200000', 'maintenanceVndPerYear' => '0'],
        ],
        'requestKey' => '53f5c196-26f0-43ef-86e4-94f5af3c2144',
    ], $overrides);
}

function tcoDbRejected(callable $operation, int $status): void
{
    try {
        $operation();
    } catch (ApiException $error) {
        tcoDbEnsure($error->status === $status, "Expected HTTP {$status}; got {$error->status}.");
        return;
    }
    throw new RuntimeException("Expected HTTP {$status}.");
}

if ($mode === 'init') {
    $pdo->exec(file_get_contents(__DIR__ . '/../db/migrations/008_product_attributes.sql'));
    $pdo->exec(file_get_contents(__DIR__ . '/../db/migrations/009_product_attribute_values.sql'));
    $pdo->exec(file_get_contents(__DIR__ . '/../db/migrations/012_decision_tools.sql'));
    $pdo->exec("INSERT INTO categories (id, name, slug) VALUES (2, 'Other test category', 'other-test-category')");
    $pdo->exec("INSERT INTO product_attributes (id, category_id, name, attribute_key, data_type, unit) VALUES
        (100, 1, 'Power', 'power_watts', 'number', 'W'),
        (101, 1, 'Water per cycle', 'water_liters_cycle', 'number', 'L')");
    $pdo->exec("INSERT INTO products (id, category_id, brand_id, product_code, name, slug, warranty_months) VALUES
        (20, 1, 1, 'TCO-20', 'TCO washer one', 'tco-washer-one', 24),
        (21, 1, 1, 'TCO-21', 'TCO washer two', 'tco-washer-two', 24),
        (22, 2, 1, 'TCO-22', 'TCO other category', 'tco-other-category', 12)");
    $pdo->exec("INSERT INTO product_variants (id, product_id, sku, variant_name, price, sale_price, sale_starts_at, sale_ends_at, stock_quantity) VALUES
        (30, 20, 'TCO-20-A', 'Silver', 1000000, 900000, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 DAY), 5),
        (31, 21, 'TCO-21-A', 'White', 1200000, NULL, NULL, NULL, 5),
        (32, 22, 'TCO-22-A', 'Black', 700000, NULL, NULL, NULL, 5)");
    $pdo->exec("INSERT INTO product_attribute_values (product_id, attribute_id, value_number) VALUES
        (20, 100, 2250), (20, 101, 81), (21, 100, 1500), (21, 101, 65)");
    echo "TCO migrations and fixtures applied to the runner's isolated database only.\n";
    exit;
}

if ($mode !== 'test') {
    throw new RuntimeException('Unknown TCO integration test mode.');
}

$service = new TcoService(new TcoModel($pdo));
$request = tcoDbRequest();
$result = $service->calculate($request, ['id' => '1', 'role' => 'CUSTOMER']);
tcoDbEnsure($result['products'][0]['purchase'] === '900000.00', 'An active sale price must be read from the selected SKU.');
tcoDbEnsure($result['products'][0]['electricity'] === '7897500.00', 'The first product electricity calculation is incorrect.');
tcoDbEnsure($result['products'][0]['water'] === '1579500.00', 'The first product water calculation is incorrect.');
tcoDbEnsure($result['products'][0]['total'] === '10827000.00', 'The first product total is incorrect.');
tcoDbEnsure((int) $pdo->query("SELECT COUNT(*) FROM decision_events WHERE request_key = '53f5c196-26f0-43ef-86e4-94f5af3c2144' AND event_type = 'TCO'")->fetchColumn() === 1, 'A successful calculation must record one event.');
$replay = $service->calculate($request, ['id' => '1', 'role' => 'CUSTOMER']);
tcoDbEnsure($replay === $result, 'A same-user retry must return the same calculation.');
tcoDbEnsure((int) $pdo->query("SELECT COUNT(*) FROM decision_events WHERE request_key = '53f5c196-26f0-43ef-86e4-94f5af3c2144'")->fetchColumn() === 1, 'A repeated request key must not duplicate the event.');

$otherCategory = $request;
$otherCategory['productIds'] = [20, 22];
$otherCategory['variantIds'] = [30, 32];
$otherCategory['annualCosts'][1]['productId'] = 22;
$otherCategory['requestKey'] = '2879f657-fbab-4ce8-8b34-3dc909596d12';
tcoDbRejected(fn () => $service->calculate($otherCategory, ['id' => '1', 'role' => 'CUSTOMER']), 422);
tcoDbEnsure((int) $pdo->query("SELECT COUNT(*) FROM decision_events WHERE request_key = '2879f657-fbab-4ce8-8b34-3dc909596d12'")->fetchColumn() === 0, 'Invalid comparison must not record a successful event.');

$foreignReplay = $request;
$foreignReplay['requestKey'] = $request['requestKey'];
tcoDbRejected(fn () => $service->calculate($foreignReplay, ['id' => '2', 'role' => 'CUSTOMER']), 409);
$inactive = $request;
$inactive['productIds'] = [22, 20];
$inactive['variantIds'] = [32, 30];
$inactive['annualCosts'][0]['productId'] = 22;
$inactive['annualCosts'][1]['productId'] = 20;
$inactive['requestKey'] = '420a8a21-0d94-45c2-95f7-2395ad87a212';
$pdo->exec('UPDATE products SET is_active = 0 WHERE id = 22');
tcoDbRejected(fn () => $service->calculate($inactive, ['id' => '1', 'role' => 'CUSTOMER']), 404);

echo "PASS: isolated MySQL TCO catalog pricing, same-category guard, and idempotent decision event.\n";
