<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' || getenv('ORDER_MYSQL_TEST') !== 'isolated') { http_response_code(404); exit; }

require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../utils/order-api.php';
require_once __DIR__ . '/../models/care-model.php';
require_once __DIR__ . '/../services/care-service.php';
require_once __DIR__ . '/../models/chatbot-model.php';
require_once __DIR__ . '/../services/chatbot-service.php';

use HomeCare\OrderApi\ApiException as OrderApiException;
use HomeCare\OrderApi\MysqlDeviceCareCompletion;
use HomeCare\OrderApi\OrderModel;
use HomeCare\OrderApi\OrderService;

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
$care = new CareService(new CareModel($pdo));
$chatbot = new ChatbotService(new ChatbotModel($pdo));
$orders = new OrderService(new OrderModel($pdo), null, new MysqlDeviceCareCompletion());
$mode = $argv[1] ?? 'test';

function careAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function careRejected(int $status, callable $operation): void
{
    try { $operation(); }
    catch (ApiException $error) {
        careAssert($error->status === $status, "Expected HTTP {$status}; got {$error->status}.");
        return;
    }
    throw new RuntimeException("Expected HTTP {$status}.");
}

function careOrderRejected(int $status, callable $operation): void
{
    try { $operation(); }
    catch (OrderApiException $error) {
        careAssert($error->status === $status, "Expected order API HTTP {$status}; got {$error->status}.");
        return;
    }
    throw new RuntimeException("Expected order API HTTP {$status}.");
}

function careActor(int $id, string $role = 'CUSTOMER'): array
{
    return ['id' => (string) $id, 'role' => $role, 'status' => 'ACTIVE', 'expiresAt' => time() + 3600];
}

function careRuleInput(string $scope, string $key, array $overrides = []): array
{
    return array_replace([
        'categoryId' => $scope === 'category' ? '1' : null,
        'productId' => $scope === 'product' ? '20' : null,
        'ruleKey' => $key,
        'title' => 'Care ' . $key,
        'instructions' => 'Clean and inspect according to the product manual.',
        'firstDueDays' => 30,
        'intervalDays' => 180,
        'status' => 'ACTIVE',
        'supplyVariantIds' => ['30'],
    ], $overrides);
}

function createDeliveredCareOrder(PDO $pdo, string $suffix, int $quantity = 2): array
{
    $orderCode = 'CARE-' . strtoupper(bin2hex(random_bytes(5)));
    $paymentCode = 'CARE-PAY-' . strtoupper(bin2hex(random_bytes(5)));
    $insert = $pdo->prepare("INSERT INTO orders
        (order_code, customer_id, recipient_name, recipient_phone, shipping_address, delivery_method,
         subtotal, discount_amount, shipping_fee, total_amount, payment_method, payment_status,
         order_status, inventory_state, customer_note, placed_at)
        VALUES (?, 1, 'Care test customer', '0900000000', 'Care test address', 'STANDARD',
         ?, 0, 0, ?, 'COD', 'PAID', 'DELIVERED', 'CONSUMED', 'isolated care integration', UTC_TIMESTAMP())");
    $total = 900000 * $quantity;
    $insert->execute([$orderCode, $total, $total]);
    $orderId = (string) $pdo->lastInsertId();
    $item = $pdo->prepare('INSERT INTO order_items (order_id, variant_id, product_name, sku, variant_name, unit_price, quantity, line_total, warranty_months) VALUES (?, 30, ?, ?, ?, 900000, ?, ?, 24)');
    $item->execute([$orderId, 'TCO washer one', 'TCO-20-A', 'Silver', $quantity, $total]);
    $itemId = (string) $pdo->lastInsertId();
    $payment = $pdo->prepare("INSERT INTO payments (order_id, payment_code, payment_method, amount, status, paid_at) VALUES (?, ?, 'COD', ?, 'PAID', UTC_TIMESTAMP())");
    $payment->execute([$orderId, $paymentCode, $total]);
    return ['id' => $orderId, 'itemId' => $itemId, 'code' => $orderCode, 'suffix' => $suffix];
}

if ($mode === 'init') {
    $pdo->exec(file_get_contents(__DIR__ . '/../db/migrations/016_care_rule_supplies.sql'));
    echo "Migration 016 applied to the runner's isolated database only.\n";
    exit;
}

if ($mode === 'care-complete-worker') {
    $request = json_decode($argv[2] ?? '', true, 512, JSON_THROW_ON_ERROR);
    try {
        $result = $care->completeCareTask(careActor((int) $request['customerId']), (string) $request['taskId']);
        echo json_encode(['ok' => true, 'result' => $result], JSON_THROW_ON_ERROR);
    } catch (ApiException $error) {
        echo json_encode(['ok' => false, 'status' => $error->status, 'message' => $error->getMessage()], JSON_THROW_ON_ERROR);
    }
    exit;
}

if ($mode === 'prepare-race') {
    $taskId = $pdo->query("SELECT id FROM care_tasks WHERE cycle_number = 2 AND status = 'DUE' ORDER BY id LIMIT 1")->fetchColumn();
    if ($taskId === false) throw new RuntimeException('Care race fixture missing its cycle-2 due task.');
    echo json_encode(['taskId' => (string) $taskId, 'customerId' => '1'], JSON_THROW_ON_ERROR);
    exit;
}

if ($mode === 'verify-race') {
    $request = json_decode($argv[2] ?? '', true, 512, JSON_THROW_ON_ERROR);
    $statement = $pdo->prepare('SELECT owned_device_id, care_rule_id, cycle_number, status FROM care_tasks WHERE id = ?');
    $statement->execute([$request['taskId']]);
    $original = $statement->fetch();
    careAssert($original && $original['status'] === 'COMPLETED', 'Both concurrent requests must complete the one locked cycle.');
    $statement = $pdo->prepare('SELECT COUNT(*) FROM care_tasks WHERE owned_device_id = ? AND care_rule_id = ? AND cycle_number = 3');
    $statement->execute([$original['owned_device_id'], $original['care_rule_id']]);
    careAssert((int) $statement->fetchColumn() === 1, 'Concurrent completion must create one successor cycle only.');
    $statement = $pdo->prepare("SELECT status FROM care_tasks WHERE owned_device_id = ? AND care_rule_id = ? AND cycle_number = 3");
    $statement->execute([$original['owned_device_id'], $original['care_rule_id']]);
    careAssert($statement->fetchColumn() === 'DUE', 'The successor cycle must remain due, not be completed by a duplicate request.');
    echo "PASS: two-process care-task completion race created one successor.\n";
    exit;
}

if ($mode !== 'test') throw new RuntimeException('Unknown care integration test mode.');

$customer = careActor(1);
$admin = careActor(4, 'ADMIN');
$categoryRule = $care->createCareRule($admin, careRuleInput('category', 'clean_filter', ['supplyVariantIds' => ['31']]));
$categoryInspection = $care->createCareRule($admin, careRuleInput('category', 'inspection', ['firstDueDays' => 10, 'intervalDays' => 90]));
$inactiveRule = $care->createCareRule($admin, careRuleInput('category', 'inactive_check', ['status' => 'INACTIVE']));
$productRule = $care->createCareRule($admin, careRuleInput('product', 'clean_filter', ['firstDueDays' => 40, 'intervalDays' => 120, 'supplyVariantIds' => ['30']]));

careRejected(403, fn () => $care->listCareRules(careActor(3, 'SALES')));
careRejected(403, fn () => $care->listOwnedDevices(careActor(3, 'SALES'), []));
careRejected(401, fn () => $care->listOwnedDevices([], []));
careRejected(422, fn () => $care->createCareRule($admin, careRuleInput('category', 'invalid_title', ['title' => '   '])));
careRejected(422, fn () => $care->createCareRule($admin, careRuleInput('category', 'dup_supply', ['supplyVariantIds' => ['30', '30']])));
careRejected(409, fn () => $care->createCareRule($admin, careRuleInput('category', 'inspection')));
careRejected(422, fn () => $care->listSupplyOptions($admin, ['q' => str_repeat('x', 101)]));
careAssert(count($care->listSupplyOptions($admin, ['q' => 'TCO-20-A'])['items']) === 1, 'Admin should search active supplies by exact SKU text.');
careAssert($care->listSupplyOptions($admin, ['q' => '%'])['items'] === [], 'LIKE wildcards must be treated literally in care supply search.');

$pdo->exec("INSERT INTO product_variants (id, product_id, sku, variant_name, price, stock_quantity, is_active, is_deleted) VALUES (33, 20, 'TCO-20-INACTIVE', 'Inactive', 1, 1, 0, 0)");
careRejected(422, fn () => $care->createCareRule($admin, careRuleInput('category', 'inactive_supply', ['supplyVariantIds' => ['33']])));

$firstOrder = createDeliveredCareOrder($pdo, 'main', 2);
$firstInput = ['expectedVersion' => 1, 'toStatus' => 'completed'];
$firstResult = $orders->updateSalesStatus(careActor(3, 'SALES'), $firstOrder['id'], $firstInput, 'care-complete-' . $firstOrder['suffix']);
careAssert((string) ($firstResult['id'] ?? '') === $firstOrder['id'], 'Order completion must return its detail response.');
careAssert($pdo->query("SELECT COUNT(*) FROM owned_devices WHERE order_item_id = " . (int) $firstOrder['itemId'])->fetchColumn() == 2, 'Quantity two must create exactly two owned devices.');
careAssert($pdo->query("SELECT COUNT(*) FROM care_tasks ct JOIN owned_devices od ON od.id = ct.owned_device_id WHERE od.order_item_id = " . (int) $firstOrder['itemId'])->fetchColumn() == 4, 'Each device should receive the two active, de-duplicated rule keys.');
careAssert($pdo->query("SELECT COUNT(*) FROM care_tasks ct JOIN care_rules cr ON cr.id = ct.care_rule_id JOIN owned_devices od ON od.id = ct.owned_device_id WHERE od.order_item_id = " . (int) $firstOrder['itemId'] . " AND cr.id = " . (int) $productRule['id'])->fetchColumn() == 2, 'Product rule should win over the category rule with the same key.');
careAssert($pdo->query("SELECT COUNT(*) FROM care_tasks ct JOIN care_rules cr ON cr.id = ct.care_rule_id JOIN owned_devices od ON od.id = ct.owned_device_id WHERE od.order_item_id = " . (int) $firstOrder['itemId'] . " AND cr.id = " . (int) $inactiveRule['id'])->fetchColumn() == 0, 'Inactive maintenance rules must not create tasks.');
careAssert($pdo->query("SELECT COUNT(*) FROM care_tasks ct JOIN care_rules cr ON cr.id = ct.care_rule_id JOIN owned_devices od ON od.id = ct.owned_device_id WHERE od.order_item_id = " . (int) $firstOrder['itemId'] . " AND cr.id = " . (int) $categoryRule['id'])->fetchColumn() == 0, 'Overridden category rule should not create a duplicate task.');
careAssert($pdo->query("SELECT COUNT(*) FROM order_status_history WHERE order_id = " . (int) $firstOrder['id'] . " AND status = 'COMPLETED'")->fetchColumn() == 1, 'Completion must write one order status history entry.');

$deviceRows = $pdo->prepare('SELECT id, order_item_id, product_name_snapshot, sku_snapshot, warranty_months_snapshot FROM owned_devices WHERE order_item_id = ? ORDER BY unit_number');
$deviceRows->execute([$firstOrder['itemId']]);
$devices = $deviceRows->fetchAll();
$firstDeviceId = (string) $devices[0]['id'];
$taskQuery = $pdo->prepare("SELECT ct.id, ct.original_due_date, cr.rule_key FROM care_tasks ct JOIN care_rules cr ON cr.id = ct.care_rule_id WHERE ct.owned_device_id = ? ORDER BY cr.rule_key");
$taskQuery->execute([$firstDeviceId]);
$deviceTasks = $taskQuery->fetchAll();
$inspectionTaskId = (string) array_values(array_filter($deviceTasks, fn ($task) => $task['rule_key'] === 'inspection'))[0]['id'];
$cleanTaskId = (string) array_values(array_filter($deviceTasks, fn ($task) => $task['rule_key'] === 'clean_filter'))[0]['id'];

careAssert($devices[0]['product_name_snapshot'] === 'TCO washer one' && $devices[0]['sku_snapshot'] === 'TCO-20-A' && (int) $devices[0]['warranty_months_snapshot'] === 24, 'Device records must preserve purchased name, SKU and warranty snapshots.');
careAssert($care->getOwnedDevice($customer, $firstDeviceId)['status'] === 'ACTIVE', 'Owner can read an active device.');
careRejected(404, fn () => $care->getOwnedDevice(careActor(2), $firstDeviceId));
careRejected(404, fn () => $care->listOwnedCareTasks(careActor(2), $firstDeviceId));
careRejected(404, fn () => $care->updateOwnedDevice(careActor(2), $firstDeviceId, ['status' => 'ARCHIVED']));
careRejected(422, fn () => $care->listOwnedDevices($customer, ['pageSize' => 51]));
careRejected(422, fn () => $care->listOwnedDevices($customer, ['status' => 'DELETED']));
careRejected(422, fn () => $care->updateOwnedDevice($customer, $firstDeviceId, ['serialNumber' => str_repeat('S', 101)]));
careAssert($care->updateOwnedDevice($customer, $firstDeviceId, ['serialNumber' => '  HC-CARE-001  '])['serialNumber'] === 'HC-CARE-001', 'Serial numbers should be trimmed and optional.');
$care->updateOwnedDevice($customer, $firstDeviceId, ['serialNumber' => '   ']);
careAssert($care->getOwnedDevice($customer, $firstDeviceId)['serialNumber'] === null, 'Blank serial should normalize to null.');

$invalidFuture = fn (string $date): array => ['newDueDate' => $date, 'reason' => 'Customer schedule change'];
careRejected(422, fn () => $care->postponeCareTask($customer, $inspectionTaskId, $invalidFuture('2025-02-31')));
careRejected(422, fn () => $care->postponeCareTask($customer, $inspectionTaskId, $invalidFuture('2020-01-01')));
careRejected(422, fn () => $care->postponeCareTask($customer, $inspectionTaskId, ['newDueDate' => '2030-01-01', 'reason' => '']));
$futureDate = (new DateTimeImmutable('today', new DateTimeZone('Asia/Ho_Chi_Minh')))->modify('+20 days')->format('Y-m-d');
$postponed = $care->postponeCareTask($customer, $inspectionTaskId, ['newDueDate' => $futureDate, 'reason' => '  Customer schedule change  ']);
careAssert($postponed['status'] === 'POSTPONED' && $postponed['dueDate'] === $futureDate && $postponed['originalDueDate'] !== $futureDate && $postponed['postponeReason'] === 'Customer schedule change', 'Postponement should retain original date and trim the required reason.');
$postponeReplay = $care->postponeCareTask($customer, $inspectionTaskId, ['newDueDate' => $futureDate, 'reason' => 'Customer schedule change']);
careAssert($postponeReplay['dueDate'] === $futureDate && $postponeReplay['originalDueDate'] === $postponed['originalDueDate'], 'Repeating the same postponement must be a no-op.');
$completedTask = $care->completeCareTask($customer, $inspectionTaskId);
careAssert($completedTask['status'] === 'COMPLETED', 'A postponed maintenance cycle can be completed.');
$taskReplay = $care->completeCareTask($customer, $inspectionTaskId);
careAssert($taskReplay['status'] === 'COMPLETED', 'Retry of an already completed care task should be stable.');
careRejected(409, fn () => $care->postponeCareTask($customer, $inspectionTaskId, ['newDueDate' => $futureDate, 'reason' => 'After completion']));
$successorCount = $pdo->prepare('SELECT COUNT(*) FROM care_tasks WHERE owned_device_id = ? AND care_rule_id = ? AND cycle_number = 2');
$successorCount->execute([$firstDeviceId, $categoryInspection['id']]);
careAssert((int) $successorCount->fetchColumn() === 1, 'Completing a maintenance cycle should create exactly one successor.');

$archived = $care->updateOwnedDevice($customer, $firstDeviceId, ['status' => 'ARCHIVED']);
careAssert($archived['status'] === 'ARCHIVED', 'Owner can archive a device.');
careRejected(409, fn () => $care->completeCareTask($customer, $cleanTaskId));
careRejected(409, fn () => $care->postponeCareTask($customer, $cleanTaskId, ['newDueDate' => $futureDate, 'reason' => 'Archived device']));
$care->updateOwnedDevice($customer, $firstDeviceId, ['status' => 'ACTIVE']);
careAssert($care->getOwnedDevice($customer, $firstDeviceId)['status'] === 'ACTIVE', 'Owner can restore an archived device.');

$pdo->exec('UPDATE product_variants SET stock_quantity = 0 WHERE id = 30');
$taskSupply = $care->listOwnedCareTasks($customer, $firstDeviceId)['items'];
$cleanDto = array_values(array_filter($taskSupply, fn ($task) => $task['ruleKey'] === 'clean_filter'))[0];
careAssert($cleanDto['supplies'][0]['available'] === false && $cleanDto['supplies'][0]['stockQuantity'] === 0, 'Maintenance supply must show live out-of-stock state.');
$pdo->exec('UPDATE product_variants SET stock_quantity = 5 WHERE id = 30');

$beforeNewRule = (int) $pdo->query("SELECT COUNT(*) FROM care_tasks ct JOIN owned_devices od ON od.id = ct.owned_device_id WHERE od.order_item_id = " . (int) $firstOrder['itemId'])->fetchColumn();
$newRule = $care->createCareRule($admin, careRuleInput('category', 'new_future_rule'));
$afterNewRule = (int) $pdo->query("SELECT COUNT(*) FROM care_tasks ct JOIN owned_devices od ON od.id = ct.owned_device_id WHERE od.order_item_id = " . (int) $firstOrder['itemId'])->fetchColumn();
careAssert($afterNewRule === $beforeNewRule, 'A new rule must not backfill tasks onto existing device records.');
$cycleTwoDate = $pdo->prepare('SELECT due_date FROM care_tasks WHERE owned_device_id = ? AND care_rule_id = ? AND cycle_number = 2');
$cycleTwoDate->execute([$firstDeviceId, $categoryInspection['id']]);
$cycleTwoDueDate = $cycleTwoDate->fetchColumn();
$care->updateCareRule($admin, $categoryInspection['id'], careRuleInput('category', 'inspection', ['firstDueDays' => 10, 'intervalDays' => 91]));
$cycleTwoDate->execute([$firstDeviceId, $categoryInspection['id']]);
careAssert($cycleTwoDate->fetchColumn() === $cycleTwoDueDate, 'Editing a care rule must not rewrite already generated cycle dates.');
$updatedProductRule = $care->updateCareRule($admin, $productRule['id'], careRuleInput('product', 'clean_filter', ['firstDueDays' => 40, 'intervalDays' => 121]));
careAssert($updatedProductRule['version'] === 2, 'Rule updates should advance the configuration version.');
careRejected(404, fn () => $care->updateCareRule($admin, '999999', careRuleInput('product', 'missing_rule')));

$chatResult = $chatbot->searchCatalog(['q' => 'TCO-20-A', 'limit' => '4']);
careAssert(count($chatResult['items']) === 1 && $chatResult['items'][0]['sku'] === 'TCO-20-A', 'Chatbot lookup should return the current active SKU.');
careAssert($chatResult['items'][0]['currentPrice'] === '900000.00' && $chatResult['items'][0]['stockQuantity'] === 5 && $chatResult['items'][0]['availability'] === 'IN_STOCK', 'Chatbot must return current server price and stock.');
careAssert($chatbot->searchCatalog(['q' => '%'])['items'] === [], 'Chatbot wildcards must be literal, not expose the whole catalog.');
careRejected(422, fn () => $chatbot->searchCatalog([]));
careRejected(422, fn () => $chatbot->searchCatalog(['q' => str_repeat('x', 101)]));
careRejected(422, fn () => $chatbot->searchCatalog(['q' => 'TCO', 'limit' => '0']));
careRejected(422, fn () => $chatbot->searchCatalog(['q' => 'TCO', 'unexpected' => '1']));
careRejected(422, fn () => $chatbot->searchCatalog(['q' => 'TCO', 'categoryId' => 'not-an-id']));
careRejected(422, fn () => $chatbot->searchCatalog(['q' => 'TCO', 'categoryId' => '999999']));
$pdo->exec('UPDATE categories SET is_active = 0 WHERE id = 1');
careRejected(422, fn () => $chatbot->searchCatalog(['q' => 'TCO-20-A', 'categoryId' => '1']));
careAssert($chatbot->searchCatalog(['q' => 'TCO-20-A'])['items'] === [], 'Inactive categories must hide their catalog SKUs.');
$pdo->exec('UPDATE categories SET is_active = 1 WHERE id = 1');
$pdo->exec('UPDATE brands SET is_active = 0 WHERE id = 1');
careAssert($chatbot->searchCatalog(['q' => 'TCO-20-A'])['items'] === [], 'Inactive brands must hide their catalog SKUs.');
$pdo->exec('UPDATE brands SET is_active = 1 WHERE id = 1');
$pdo->exec('UPDATE product_variants SET is_active = 0 WHERE id = 30');
careAssert($chatbot->searchCatalog(['q' => 'TCO-20-A'])['items'] === [], 'Inactive SKUs must not be suggested.');
$pdo->exec('UPDATE product_variants SET is_active = 1 WHERE id = 30');
$pdo->exec('UPDATE products SET is_active = 0 WHERE id = 20');
careAssert($chatbot->searchCatalog(['q' => 'TCO-20-A'])['items'] === [], 'Inactive products must not be suggested.');
$pdo->exec('UPDATE products SET is_active = 1 WHERE id = 20');

$replay = $orders->updateSalesStatus(careActor(3, 'SALES'), $firstOrder['id'], $firstInput, 'care-complete-' . $firstOrder['suffix']);
careAssert($replay == $firstResult, 'Retry with the same order idempotency key must replay the same completion response.');
careOrderRejected(409, fn () => $orders->updateSalesStatus(careActor(3, 'SALES'), $firstOrder['id'], $firstInput, 'care-stale-version-' . $firstOrder['suffix']));

$badOrder = createDeliveredCareOrder($pdo, 'invalid', 0);
$devicesBeforeFailure = (int) $pdo->query("SELECT COUNT(*) FROM owned_devices WHERE order_item_id = " . (int) $badOrder['itemId'])->fetchColumn();
careOrderRejected(503, fn () => $orders->updateSalesStatus(careActor(3, 'SALES'), $badOrder['id'], $firstInput, 'care-invalid-order-' . $badOrder['suffix']));
careAssert($pdo->query('SELECT order_status FROM orders WHERE id = ' . (int) $badOrder['id'])->fetchColumn() === 'DELIVERED', 'Failed device/care creation must roll back order completion.');
careAssert((int) $pdo->query("SELECT COUNT(*) FROM owned_devices WHERE order_item_id = " . (int) $badOrder['itemId'])->fetchColumn() === $devicesBeforeFailure, 'Failed completion must not leave partial device rows.');

echo "PASS: isolated STT24 device ownership, completion bridge, care cycles, active catalog and chatbot search.\n";
