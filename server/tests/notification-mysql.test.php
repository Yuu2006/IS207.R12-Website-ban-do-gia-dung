<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' || getenv('ORDER_MYSQL_TEST') !== 'isolated') { http_response_code(404); exit; }

require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../utils/order-api.php';
require_once __DIR__ . '/../models/notification-model.php';
require_once __DIR__ . '/../services/notification-service.php';
require_once __DIR__ . '/../models/audit-model.php';
require_once __DIR__ . '/../services/audit-service.php';
require_once __DIR__ . '/../models/care-model.php';
require_once __DIR__ . '/../services/care-service.php';
require_once __DIR__ . '/order-test-dependencies.php';

$name = getenv('DB_NAME');
$port = getenv('DB_PORT');
if (getenv('DB_HOST') !== '127.0.0.1' || !preg_match('/^homecare_order_test_[0-9]+$/D', $name ?: '') || !ctype_digit($port ?: '') || (int) $port === 3306) {
    throw new RuntimeException('Unsafe notification test database target.');
}

$pdo = new PDO("mysql:host=127.0.0.1;port={$port};dbname={$name};charset=utf8mb4", 'root', '', [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_EMULATE_PREPARES => false,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
]);
$pdo->exec("SET time_zone = '+00:00'");
$notifications = new NotificationModel($pdo);
$notificationService = new NotificationService($notifications);
$auditModel = new AuditModel($pdo);
$auditService = new AuditService($auditModel);
$testPrefix = 'notify-test:' . bin2hex(random_bytes(6));

function notificationEnsure(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function notificationExpectStatus(int $status, callable $operation): void
{
    try { $operation(); }
    catch (ApiException $error) {
        notificationEnsure($error->status === $status, "Expected HTTP {$status}; received {$error->status}.");
        return;
    }
    throw new RuntimeException("Expected HTTP {$status}.");
}

function notificationActor(int $id, string $role = 'CUSTOMER'): array
{
    return ['id' => (string) $id, 'role' => $role, 'status' => 'ACTIVE', 'expiresAt' => time() + 3600];
}

function notificationScalar(PDO $pdo, string $sql, array $parameters = []): mixed
{
    $statement = $pdo->prepare($sql);
    $statement->execute($parameters);
    return $statement->fetchColumn();
}

// Build an eligible order/device/care record in the disposable integration database only.
function createReminderFixtures(PDO $pdo, string $prefix): array
{
    $orderCode = 'NTF-' . strtoupper(bin2hex(random_bytes(7)));
    $pdo->prepare("INSERT INTO orders
        (order_code, customer_id, recipient_name, recipient_phone, shipping_address, delivery_method,
         subtotal, discount_amount, shipping_fee, total_amount, payment_method, payment_status,
         order_status, inventory_state, customer_note, placed_at)
        VALUES (?, 10, 'Reminder test customer', '0900000000', 'Reminder test address', 'STANDARD',
         100000, 0, 0, 100000, 'COD', 'PAID', 'DELIVERED', 'CONSUMED', 'isolated reminder test', UTC_TIMESTAMP())")
        ->execute([$orderCode]);
    $orderId = (int) $pdo->lastInsertId();
    $pdo->prepare("INSERT INTO order_items (order_id, variant_id, product_name, sku, variant_name, unit_price, quantity, line_total, warranty_months)
        VALUES (?, 1, 'Reminder test appliance', ?, 'Standard', 100000, 1, 100000, 24)")
        ->execute([$orderId, 'NTF-' . strtoupper(bin2hex(random_bytes(5)))]);
    $orderItemId = (int) $pdo->lastInsertId();

    $ruleKey = 'ntf-' . bin2hex(random_bytes(5));
    $pdo->prepare("INSERT INTO care_rules (product_id, rule_key, title, instructions, first_due_days, interval_days, status, updated_by)
        VALUES (1, ?, 'Notification test maintenance', 'Inspect according to the product manual.', 30, 180, 'ACTIVE', 4)")
        ->execute([$ruleKey]);
    $ruleId = (int) $pdo->lastInsertId();

    $pdo->prepare("INSERT INTO owned_devices
        (customer_id, order_item_id, unit_number, product_id, variant_id, product_name_snapshot, sku_snapshot,
         purchased_at, completed_at, warranty_months_snapshot, warranty_start_date, status)
        VALUES (10, ?, 1, 1, 1, 'Reminder test appliance', 'NTF-DEVICE', UTC_TIMESTAMP(), UTC_TIMESTAMP(), 24,
         DATE_SUB(DATE_ADD(UTC_DATE(), INTERVAL 10 DAY), INTERVAL 24 MONTH), 'ACTIVE')")
        ->execute([$orderItemId]);
    $deviceId = (int) $pdo->lastInsertId();
    $pdo->prepare("INSERT INTO care_tasks (owned_device_id, care_rule_id, cycle_number, original_due_date, due_date, status)
        VALUES (?, ?, 1, DATE_ADD(UTC_DATE(), INTERVAL 3 DAY), DATE_ADD(UTC_DATE(), INTERVAL 3 DAY), 'DUE')")
        ->execute([$deviceId, $ruleId]);
    $taskId = (int) $pdo->lastInsertId();

    return [
        'recipientId' => 10,
        'careEventKey' => 'care:' . $taskId . ':due:' . (new DateTimeImmutable('today', new DateTimeZone('UTC')))->modify('+3 days')->format('Y-m-d'),
        'warrantyEventKey' => 'warranty:' . $deviceId . ':expires:' . (new DateTimeImmutable('today', new DateTimeZone('UTC')))->modify('+10 days')->format('Y-m-d'),
    ];
}

$mode = $argv[1] ?? 'test';
if ($mode === 'verify-reminders') {
    $fixtures = json_decode($argv[2] ?? '', true, 32, JSON_THROW_ON_ERROR);
    foreach (['careEventKey', 'warrantyEventKey'] as $key) {
        $count = (int) notificationScalar($pdo, 'SELECT COUNT(*) FROM notifications WHERE recipient_id = ? AND event_key = ?', [$fixtures['recipientId'], $fixtures[$key]]);
        notificationEnsure($count === 1, "Expected one persisted reminder for {$key}.");
    }
    foreach ($notifications->pendingCareReminders(1000) as $item) notificationEnsure($item['event_key'] !== $fixtures['careEventKey'], 'Sent care reminder remained pending.');
    foreach ($notifications->pendingWarrantyReminders(1000) as $item) notificationEnsure($item['event_key'] !== $fixtures['warrantyEventKey'], 'Sent warranty reminder remained pending.');
    echo "PASS: care and warranty reminders persisted once and left no pending duplicate.\n";
    exit;
}

if ($mode !== 'test') throw new InvalidArgumentException('Unsupported notification test mode.');

// Exercise recipient isolation, idempotent creation, pagination validation and read transitions.
$customerA = notificationActor(9);
$customerB = notificationActor(10);
$eventA = $testPrefix . ':order';
$eventB = $testPrefix . ':system';
notificationEnsure($notifications->create(9, $eventA, 'ORDER', 'Order received', 'Order is waiting for confirmation.', '/orders'), 'First notification insert failed.');
notificationEnsure(!$notifications->create(9, $eventA, 'ORDER', 'Order received', 'Duplicate retry.', '/orders'), 'Duplicate event was not idempotent.');
notificationEnsure($notifications->create(10, $eventA, 'ORDER', 'Order received', 'A separate recipient event.', '/orders'), 'Recipient-scoped event key rejected a different recipient.');
notificationEnsure($notifications->create(9, $eventB, 'SYSTEM', 'Account update', 'Settings were updated.', '/notifications'), 'Second notification insert failed.');

$idsA = $pdo->prepare('SELECT id FROM notifications WHERE recipient_id = 9 AND event_key IN (?, ?) ORDER BY id');
$idsA->execute([$eventA, $eventB]);
$ownedIds = array_map('strval', $idsA->fetchAll(PDO::FETCH_COLUMN));
$idsB = $pdo->prepare('SELECT id FROM notifications WHERE recipient_id = 10 AND event_key = ?');
$idsB->execute([$eventA]);
$foreignId = (string) $idsB->fetchColumn();
notificationEnsure(count($ownedIds) === 2 && $foreignId !== '', 'Fixture notification rows were not isolated as expected.');

$pageA = $notificationService->list($customerA, ['page' => '1', 'pageSize' => '50']);
$listedIds = array_column($pageA['items'], 'id');
notificationEnsure(count(array_intersect($ownedIds, $listedIds)) === 2, 'Recipient inbox omitted its own notifications.');
notificationEnsure(!in_array($foreignId, $listedIds, true), 'Recipient inbox exposed another account notification.');
notificationEnsure($pageA['unreadCount'] >= 2, 'Unread count did not include newly created events.');
$unreadA = $notificationService->list($customerA, ['unreadOnly' => 'true', 'pageSize' => '50']);
notificationEnsure(count(array_intersect($ownedIds, array_column($unreadA['items'], 'id'))) === 2, 'Unread-only filter omitted unread events.');
$pageB = $notificationService->list($customerB, ['pageSize' => '50']);
notificationEnsure(in_array($foreignId, array_column($pageB['items'], 'id'), true), 'Second recipient cannot read its own notification.');

$firstId = $ownedIds[0];
$marked = $notificationService->markRead($customerA, $firstId);
$markedAgain = $notificationService->markRead($customerA, $firstId);
notificationEnsure($marked['readAt'] !== null && $marked['readAt'] === $markedAgain['readAt'], 'Mark-read retry changed the original read timestamp.');
notificationExpectStatus(404, fn () => $notificationService->markRead($customerA, $foreignId));
notificationExpectStatus(404, fn () => $notificationService->markRead($customerA, '999999999999'));
notificationExpectStatus(401, fn () => $notificationService->list(null, []));
notificationExpectStatus(422, fn () => $notificationService->list($customerA, ['pageSize' => '51']));
notificationExpectStatus(422, fn () => $notificationService->list($customerA, ['userId' => '10']));

$markAll = $notificationService->markAllRead($customerA);
$markAllAgain = $notificationService->markAllRead($customerA);
notificationEnsure($markAll['updatedCount'] >= 1 && $markAllAgain['updatedCount'] === 0, 'Mark-all-read was not idempotent.');
notificationEnsure($notificationService->list($customerB, ['unreadOnly' => 'true'])['unreadCount'] >= 1, 'Mark-all-read changed a different recipient inbox.');
$pdo->prepare('UPDATE notifications SET is_deleted = 1 WHERE recipient_id = 9 AND event_key = ?')->execute([$eventB]);
notificationEnsure(!in_array($ownedIds[1], array_column($notificationService->list($customerA, ['pageSize' => '50'])['items'], 'id'), true), 'Soft-deleted notification remained visible.');

// Audit history is append-only through this module, filters are bounded, and access is ADMIN-only.
$auditAction = 'NOTIFY_TEST_' . strtoupper(bin2hex(random_bytes(4)));
$auditModel->record(4, 'ADMIN', $auditAction, 'NOTIFICATION_TEST', 1, ['case' => $testPrefix]);
$auditPage = $auditService->list(notificationActor(4, 'ADMIN'), ['action' => $auditAction, 'entityType' => 'NOTIFICATION_TEST', 'actorId' => '4', 'page' => '1', 'pageSize' => '10']);
notificationEnsure($auditPage['pagination']['totalItems'] === 1, 'Audit filters returned an unexpected result count.');
notificationEnsure($auditPage['items'][0]['actorRole'] === 'ADMIN' && $auditPage['items'][0]['details']['case'] === $testPrefix, 'Audit actor role or metadata was not persisted.');
notificationExpectStatus(401, fn () => $auditService->list(null, []));
notificationExpectStatus(403, fn () => $auditService->list(notificationActor(3, 'SALES'), []));
notificationExpectStatus(422, fn () => $auditService->list(notificationActor(4, 'ADMIN'), ['from' => '2026-02-02', 'to' => '2026-02-01']));
notificationExpectStatus(422, fn () => $auditService->list(notificationActor(4, 'ADMIN'), ['unbounded' => 'true']));

// Verify customer self-cancellation notifies both customer (/orders/{id}) and active SALES (/sales/orders).
$orderModel = new HomeCare\OrderApi\OrderModel($pdo);
$orderService = new HomeCare\OrderApi\OrderService($orderModel, new HomeCare\OrderApi\SqlTestCheckoutDependencies());
$cancelCode = 'CNL-' . strtoupper(bin2hex(random_bytes(6)));
$pdo->prepare("INSERT INTO orders
    (order_code, customer_id, recipient_name, recipient_phone, shipping_address, delivery_method,
     subtotal, discount_amount, shipping_fee, total_amount, payment_method, payment_status,
     order_status, inventory_state, customer_note, placed_at)
    VALUES (?, 9, 'Cancel notify customer', '0900000001', 'Cancel address', 'STANDARD',
     600000, 0, 0, 600000, 'COD', 'UNPAID', 'PENDING', 'RESERVED', 'cancel notification test', UTC_TIMESTAMP())")
    ->execute([$cancelCode]);
$cancelOrderId = (string) $pdo->lastInsertId();
$pdo->prepare("INSERT INTO order_items (order_id, variant_id, product_name, sku, variant_name, unit_price, quantity, line_total, warranty_months)
    VALUES (?, 1, 'Snapshot product', 'TEST-1', 'White', 600000, 1, 600000, 24)")
    ->execute([$cancelOrderId]);
$pdo->prepare("INSERT INTO payments (order_id, payment_code, payment_method, amount, status) VALUES (?, ?, 'COD', 600000, 'UNPAID')")
    ->execute([$cancelOrderId, 'PAY-' . $cancelCode]);
$orderService->cancelOrder(notificationActor(9), $cancelOrderId, ['expectedVersion' => 1, 'reason' => 'Đổi ý trước khi giao'], 'notify-cancel-' . $cancelCode);
$cancelCustomerTarget = notificationScalar($pdo, 'SELECT target_url FROM notifications WHERE recipient_id = 9 AND event_key = ?', ['order:' . $cancelOrderId . ':status:2']);
notificationEnsure($cancelCustomerTarget === '/orders/' . $cancelOrderId, 'Customer self-cancellation must create an order-detail notification.');
$cancelSalesTarget = notificationScalar($pdo, 'SELECT target_url FROM notifications WHERE recipient_id = 3 AND event_key = ?', ['order:' . $cancelOrderId . ':cancelled-by-customer']);
notificationEnsure($cancelSalesTarget === '/sales/orders', 'Customer self-cancellation must notify active SALES with /sales/orders.');

// Verify ADMIN return approval notifies active WAREHOUSE with /warehouse/returns.
$returnCode = 'RET-' . strtoupper(bin2hex(random_bytes(6)));
$pdo->prepare("INSERT INTO orders
    (order_code, customer_id, recipient_name, recipient_phone, shipping_address, delivery_method,
     subtotal, discount_amount, shipping_fee, total_amount, payment_method, payment_status,
     order_status, inventory_state, customer_note, placed_at)
    VALUES (?, 9, 'Return notify customer', '0900000002', 'Return address', 'STANDARD',
     600000, 0, 0, 600000, 'COD', 'PAID', 'DELIVERED', 'CONSUMED', 'return warehouse notification test', UTC_TIMESTAMP())")
    ->execute([$returnCode]);
$returnOrderId = (string) $pdo->lastInsertId();
$pdo->prepare("INSERT INTO order_items (order_id, variant_id, product_name, sku, variant_name, unit_price, quantity, line_total, warranty_months)
    VALUES (?, 1, 'Snapshot product', 'TEST-1', 'White', 600000, 1, 600000, 24)")
    ->execute([$returnOrderId]);
$pdo->prepare("INSERT INTO payments (order_id, payment_code, payment_method, amount, status, paid_at) VALUES (?, ?, 'COD', 600000, 'PAID', UTC_TIMESTAMP())")
    ->execute([$returnOrderId, 'PAY-' . $returnCode]);
$returnReq = $orderService->createReturnRequest(notificationActor(9), $returnOrderId, ['expectedVersion' => 1, 'issueCategory' => 'TRANSIT_DAMAGE', 'reason' => 'Vỏ máy bị móp khi vận chuyển'], 'notify-ret-req-' . $returnCode);
$returnService = new HomeCare\OrderApi\ReturnRefundService($pdo, new HomeCare\OrderApi\ReturnRefundModel($pdo));
$returnService->triage(notificationActor(3, 'SALES'), $returnReq['id'], ['severity' => 'MAJOR', 'note' => 'Đủ điều kiện chuyển quản lý duyệt'], 'notify-ret-triage-' . $returnCode);
$returnService->decide(notificationActor(4, 'ADMIN'), $returnReq['id'], ['decision' => 'APPROVE', 'reason' => 'Duyệt nhận hàng trả về kho'], 'notify-ret-decide-' . $returnCode);
$warehouseTarget = notificationScalar($pdo, 'SELECT target_url FROM notifications WHERE recipient_id = 5 AND event_key = ?', ['return:' . $returnReq['id'] . ':warehouse-receive']);
notificationEnsure($warehouseTarget === '/warehouse/returns', 'Approved return must notify active WAREHOUSE with /warehouse/returns.');

// Verify care-rule mutations persist ADMIN audit logs.
$careService = new CareService(new CareModel($pdo));
$careRuleKey = 'audit-rule-' . bin2hex(random_bytes(4));
$createdRule = $careService->createCareRule(notificationActor(4, 'ADMIN'), [
    'categoryId' => '1', 'productId' => null, 'ruleKey' => $careRuleKey, 'title' => 'Kiểm tra định kỳ',
    'instructions' => 'Vệ sinh màng lọc theo hướng dẫn.', 'firstDueDays' => 30, 'intervalDays' => 90, 'status' => 'ACTIVE', 'supplyVariantIds' => [],
]);
$careService->updateCareRule(notificationActor(4, 'ADMIN'), $createdRule['id'], [
    'categoryId' => '1', 'productId' => null, 'ruleKey' => $careRuleKey, 'title' => 'Kiểm tra định kỳ v2',
    'instructions' => 'Vệ sinh màng lọc theo hướng dẫn mới.', 'firstDueDays' => 30, 'intervalDays' => 120, 'status' => 'ACTIVE', 'supplyVariantIds' => [],
]);
$careCreatedAudit = $auditService->list(notificationActor(4, 'ADMIN'), ['action' => 'CARE_RULE_CREATED', 'entityType' => 'care_rule', 'actorId' => '4']);
$careUpdatedAudit = $auditService->list(notificationActor(4, 'ADMIN'), ['action' => 'CARE_RULE_UPDATED', 'entityType' => 'care_rule', 'actorId' => '4']);
notificationEnsure($careCreatedAudit['pagination']['totalItems'] >= 1 && $careUpdatedAudit['pagination']['totalItems'] >= 1, 'Care rule create/update must append ADMIN audit logs.');

$fixtures = createReminderFixtures($pdo, $testPrefix);
echo "PASS: notification ownership, duplicate protection, self-cancel/warehouse alerts, read state, pagination validation, care-rule audit, and admin-only audit filters.\n";
echo 'REMINDER_FIXTURES=' . json_encode($fixtures, JSON_THROW_ON_ERROR) . PHP_EOL;
