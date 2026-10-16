<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' || getenv('ORDER_MYSQL_TEST') !== 'isolated') { http_response_code(404); exit; }
require_once __DIR__ . '/../utils/order-api.php';
require_once __DIR__ . '/order-test-dependencies.php';

use HomeCare\OrderApi\{ApiException, OrderModel, OrderService, CheckoutService, SqlTestCheckoutDependencies};
use function HomeCare\OrderApi\{orderMoney, orderTransition, validateOrderList};

// Guard all modes, including schema creation/shutdown, to the runner's private loopback DB.
$name = getenv('DB_NAME');
$port = getenv('DB_PORT');
if (getenv('DB_HOST') !== '127.0.0.1' || !preg_match('/^homecare_order_test_[0-9]+$/D', $name ?: '') || !ctype_digit($port ?: '') || (int) $port === 3306) throw new RuntimeException('Unsafe test database target.');
$mode = $argv[1] ?? 'test';
$pdo = new PDO("mysql:host=127.0.0.1;port={$port};charset=utf8mb4", 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec("SET time_zone = '+00:00'");
if ($mode === 'ping') exit;
if ($mode === 'shutdown') { $pdo->exec('SHUTDOWN'); exit; }
if ($mode === 'init') {
    $pdo->exec("CREATE DATABASE `{$name}` CHARACTER SET utf8mb4");
    $pdo->exec("USE `{$name}`");
    // Existing baseline and module migration only; never DROP/TRUNCATE/reset shared data.
    $pdo->exec(file_get_contents(__DIR__ . '/../../database/schema_database.sql'));
    $pdo->exec(file_get_contents(__DIR__ . '/../db/migrations/008_order_runtime.sql'));
    $pdo->exec('CREATE TABLE test_cart_versions (cart_id BIGINT UNSIGNED PRIMARY KEY, version BIGINT UNSIGNED NOT NULL DEFAULT 1) ENGINE=InnoDB');
    foreach (['CUSTOMER', 'CUSTOMER', 'SALES', 'ADMIN', 'WAREHOUSE'] as $index => $role) {
        $statement = $pdo->prepare('INSERT INTO users (id, full_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)');
        $statement->execute([$index + 1, 'Test ' . ($index + 1), 'test' . ($index + 1) . '@example.invalid', 'not-a-login-credential', $role]);
    }
    $pdo->exec("INSERT INTO categories (id, name, slug) VALUES (1, 'Test appliance', 'test-appliance')");
    $pdo->exec("INSERT INTO brands (id, name) VALUES (1, 'Test brand')");
    $pdo->exec("INSERT INTO products (id, category_id, brand_id, product_code, name, slug, warranty_months) VALUES (1, 1, 1, 'TEST-P', 'Snapshot product', 'test-product', 24)");
    $pdo->exec("INSERT INTO product_variants (id, product_id, sku, variant_name, price, stock_quantity) VALUES (1, 1, 'TEST-1', 'White', 600000, 100), (2, 1, 'TEST-LAST', 'Black', 800000, 1)");
    echo "Schema + 008 migration applied to fresh isolated DB; fixture cart version NOT a production schema.\n";
    exit;
}
$pdo->exec("USE `{$name}`");
$model = new OrderModel($pdo);
$deps = new SqlTestCheckoutDependencies();
$orders = new OrderService($model, $deps);
$checkout = new CheckoutService($model, $deps);
function actor(int $id = 1, string $role = 'CUSTOMER'): array { return ['id' => (string) $id, 'role' => $role, 'fullName' => 'Test']; }
function sql(string $query, array $values = []): mixed {
    global $pdo;
    $statement = $pdo->prepare($query);
    $statement->execute($values);
    return $statement->fetchColumn();
}
function ensure(bool $value, string $message = 'Assertion failed'): void { if (!$value) throw new RuntimeException($message); }
function errorCode(callable $operation, string $code): void {
    try { $operation(); } catch (ApiException $error) { ensure($error->errorCode === $code, 'Expected ' . $code . ', got ' . $error->errorCode); return; }
    throw new RuntimeException('Expected error ' . $code);
}
// Seed/refill only the runner's private fixture rows; no destructive shared DB operation.
function cart(int $user = 1, int $sku = 1, int $quantity = 1): array {
    global $pdo;
    $id = sql('SELECT id FROM carts WHERE user_id = ?', [$user]);
    if (!$id) {
        sql('INSERT INTO carts (user_id) VALUES (?)', [$user]);
        $id = $pdo->lastInsertId();
        sql('INSERT INTO test_cart_versions (cart_id) VALUES (?)', [$id]);
    }
    sql('DELETE FROM cart_items WHERE cart_id = ?', [$id]);
    sql('INSERT INTO cart_items (cart_id, variant_id, quantity) VALUES (?, ?, ?)', [$id, $sku, $quantity]);
    $address = sql('SELECT id FROM addresses WHERE user_id = ? LIMIT 1', [$user]);
    if (!$address) { sql("INSERT INTO addresses (user_id, recipient_name, phone, address_line, province) VALUES (?, 'Test receiver', '0900000000', '12 Test street', 'Test city')", [$user]); $address = $pdo->lastInsertId(); }
    return ['cartVersion' => (int) sql('SELECT version FROM test_cart_versions WHERE cart_id = ?', [$id]), 'addressId' => (string) $address, 'paymentMethod' => 'COD', 'voucherCode' => null];
}
function create(array $input, string $key): array {
    global $checkout;
    $quote = $checkout->quoteCheckout(actor(), $input);
    return $checkout->createOrder(actor(), $input + ['quoteFingerprint' => $quote['quoteFingerprint'], 'note' => 'Test note'], $key)['order'];
}
if ($mode === 'prepare-race') {
    $result = [];
    foreach ([1, 2] as $id) {
        $input = cart($id, 2);
        $quote = $checkout->quoteCheckout(actor($id), $input);
        $result[] = ['actor' => actor($id), 'input' => $input + ['quoteFingerprint' => $quote['quoteFingerprint'], 'note' => 'Race'], 'key' => 'checkout-race-' . $id . '-unique'];
    }
    echo json_encode($result, JSON_THROW_ON_ERROR); exit;
}
if ($mode === 'checkout-worker' || $mode === 'status-worker') {
    $request = json_decode($argv[2], true, 512, JSON_THROW_ON_ERROR);
    try {
        $result = $mode === 'checkout-worker' ? $checkout->createOrder($request['actor'], $request['input'], $request['key']) : $orders->updateSalesStatus(actor(3, 'SALES'), $request['id'], ['expectedVersion' => $request['expectedVersion'] ?? 1, 'toStatus' => $request['toStatus'] ?? 'confirmed'], 'status-race-key-' . $request['key']);
        echo json_encode(['ok' => true, 'result' => $result], JSON_THROW_ON_ERROR);
    } catch (ApiException $error) { echo json_encode(['ok' => false, 'code' => $error->errorCode], JSON_THROW_ON_ERROR); }
    exit;
}
if ($mode === 'verify-race') {
    ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 2') === 0);
    ensure((int) sql('SELECT COUNT(*) FROM order_items WHERE variant_id = 2') === 1);
    ensure((int) sql("SELECT COUNT(*) FROM inventory_movements WHERE variant_id = 2 AND movement_type = 'RESERVE'") === 1);
    echo "ok - two customers buying last SKU: one order, one reservation, no oversell\n"; exit;
}
if ($mode === 'prepare-status-race') { echo json_encode(['id' => (string) sql("SELECT id FROM orders WHERE order_status = 'PENDING' ORDER BY id DESC LIMIT 1")]); exit; }
if ($mode === 'prepare-cancel-race') {
    $stockBefore = (int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1');
    $order = create(cart(), 'checkout-cancel-race-key');
    $orders->updateSalesStatus(actor(3, 'SALES'), $order['id'], ['expectedVersion' => 1, 'toStatus' => 'confirmed'], 'cancel-race-confirm-key');
    $orders->updateSalesStatus(actor(3, 'SALES'), $order['id'], ['expectedVersion' => 2, 'toStatus' => 'preparing'], 'cancel-race-prepare-key');
    echo json_encode(['id' => $order['id'], 'stockBefore' => $stockBefore]); exit;
}
if ($mode === 'cancel-worker') {
    $input = json_decode($argv[2], true, 512, JSON_THROW_ON_ERROR);
    try {
        $result = $input['action'] === 'cancel' ? $orders->cancelOrder(actor(), $input['id'], ['expectedVersion' => 3, 'reason' => 'Cancel race'], 'concurrent-cancel-key') : $orders->updateSalesStatus(actor(3, 'SALES'), $input['id'], ['expectedVersion' => 3, 'toStatus' => 'shipping'], 'concurrent-shipping-key');
        echo json_encode(['ok' => true, 'result' => $result], JSON_THROW_ON_ERROR);
    } catch (ApiException $error) { echo json_encode(['ok' => false, 'code' => $error->errorCode], JSON_THROW_ON_ERROR); }
    exit;
}
if ($mode === 'verify-cancel-race') {
    $input = json_decode($argv[2], true, 512, JSON_THROW_ON_ERROR);
    $state = sql('SELECT order_status FROM orders WHERE id = ?', [$input['id']]);
    ensure(in_array($state, ['CANCELLED', 'SHIPPING'], true));
    ensure((int) sql('SELECT version FROM orders WHERE id = ?', [$input['id']]) === 4);
    ensure((int) sql('SELECT COUNT(*) FROM order_status_history WHERE order_id = ?', [$input['id']]) === 4);
    ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === $input['stockBefore'] - ($state === 'SHIPPING' ? 1 : 0));
    ensure(sql('SELECT inventory_state FROM orders WHERE id = ?', [$input['id']]) === ($state === 'SHIPPING' ? 'CONSUMED' : 'RELEASED'));
    echo "ok - cancel versus shipping: one winner, consistent stock/history/state\n"; exit;
}
if ($mode === 'verify-status-race' || $mode === 'verify-replay-race') {
    $id = (string) sql('SELECT id FROM orders ORDER BY id DESC LIMIT 1');
    $version = $mode === 'verify-status-race' ? 2 : 3;
    ensure((int) sql('SELECT version FROM orders WHERE id = ?', [$id]) === $version);
    ensure((int) sql('SELECT COUNT(*) FROM order_status_history WHERE order_id = ?', [$id]) === $version);
    echo $version === 2 ? "ok - concurrent same-version transition: exactly one winner\n" : "ok - concurrent identical key: exact replay, no extra version/history\n"; exit;
}
$checks = 0;
$failures = 0;
function check(string $name, callable $operation): void {
    global $checks, $failures;
    $checks++;
    try { $operation(); echo "ok {$checks} - {$name}\n"; } catch (Throwable $error) { $failures++; echo "not ok {$checks} - {$name}: {$error->getMessage()}\n"; }
}
check('native PDO and UTC connection', function () use ($pdo) { ensure(!$pdo->getAttribute(PDO::ATTR_EMULATE_PREPARES)); ensure(sql('SELECT @@session.time_zone') === '+00:00'); });
check('bounded deadlock retry rolls back each attempt and commits once with same key', function () use ($pdo) {
    cart();
    $before = (int) sql('SELECT version FROM test_cart_versions WHERE cart_id = 1');
    $attempts = 0;
    $idempotency = new HomeCare\OrderApi\OrderIdempotencyModel($pdo);
    $result = $idempotency->run(actor(), 'retry-test', 'bounded-retry-test-key', [], function () use (&$attempts) {
        $attempts++;
        sql('UPDATE test_cart_versions SET version = version + 1 WHERE cart_id = 1');
        if ($attempts < 3) { $error = new PDOException('Injected deadlock'); $error->errorInfo = ['40001', 1213, 'test']; throw $error; }
        return ['committed' => true];
    });
    ensure($attempts === 3 && $result === ['committed' => true]);
    ensure((int) sql('SELECT version FROM test_cart_versions WHERE cart_id = 1') === $before + 1);
});
check('deadlock exhaustion returns retryable 503 and persists no key or partial writes', function () use ($pdo) {
    $before = (int) sql('SELECT version FROM test_cart_versions WHERE cart_id = 1');
    errorCode(fn () => (new HomeCare\OrderApi\OrderIdempotencyModel($pdo))->run(actor(), 'retry-test', 'exhausted-retry-test-key', [], function () {
        sql('UPDATE test_cart_versions SET version = version + 1 WHERE cart_id = 1');
        $error = new PDOException('Injected lock timeout'); $error->errorInfo = ['HY000', 1205, 'test']; throw $error;
    }), 'REQUEST_RETRYABLE');
    ensure((int) sql('SELECT version FROM test_cart_versions WHERE cart_id = 1') === $before);
    ensure((int) sql("SELECT COUNT(*) FROM order_idempotency WHERE request_key = 'exhausted-retry-test-key'") === 0);
});
check('integer VND rejects decimals and overflow', function () { ensure(orderMoney('123.00') === 123); errorCode(fn () => orderMoney('123.01'), 'ORDER_DATA_INCOMPATIBLE'); errorCode(fn () => orderMoney('9007199254740992'), 'ORDER_DATA_INCOMPATIBLE'); });
$input = cart();
$quote = $checkout->quoteCheckout(actor(), $input);
$createInput = $input + ['quoteFingerprint' => $quote['quoteFingerprint'], 'note' => 'Original note'];
$result = $checkout->createOrder(actor(), $createInput, 'checkout-create-first-key');
$id = $result['order']['id'];
check('checkout persists snapshot, unpaid COD, initial audit and reservation together', function () use ($result, $id) {
    ensure($result['order']['paymentStatus'] === 'unpaid' && $result['payment'] === null);
    ensure($result['order']['totals']['total'] === 600000 && $result['order']['version'] === 1);
    ensure(sql('SELECT status FROM payments WHERE order_id = ?', [$id]) === 'UNPAID');
    ensure(sql('SELECT inventory_state FROM orders WHERE id = ?', [$id]) === 'RESERVED');
    ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === 99);
    ensure($result['order']['history'][0]['actorRole'] === 'CUSTOMER');
});
check('create replay works after cart was cleared', function () use ($checkout, $createInput, $result) { ensure($checkout->createOrder(actor(), $createInput, 'checkout-create-first-key') == $result); });
check('same key with changed note conflicts without second order', function () use ($checkout, $createInput) { errorCode(fn () => $checkout->createOrder(actor(), array_replace($createInput, ['note' => 'Changed']), 'checkout-create-first-key'), 'IDEMPOTENCY_CONFLICT'); ensure((int) sql('SELECT COUNT(*) FROM orders') === 1); });
check('owner scope precedes pagination and detail; foreign id is 404', function () use ($orders, $id) { ensure($orders->listCustomerOrders(actor(2), validateOrderList([]))['pagination']['totalItems'] === 0); errorCode(fn () => $orders->getCustomerOrder(actor(2), $id), 'ORDER_NOT_FOUND'); });
check('CUSTOMER cannot use staff API, WAREHOUSE cannot update orders', function () use ($orders, $id) { errorCode(fn () => $orders->listSalesOrders(actor(), validateOrderList([], true)), 'FORBIDDEN'); errorCode(fn () => $orders->updateSalesStatus(actor(5, 'WAREHOUSE'), $id, ['expectedVersion' => 1, 'toStatus' => 'confirmed'], 'wrong-role-unique-key'), 'FORBIDDEN'); });
check('disabled account and stale session role fail closed', function () use ($orders) { sql("UPDATE users SET status = 'DISABLED' WHERE id = 2"); errorCode(fn () => $orders->listCustomerOrders(actor(2), validateOrderList([])), 'AUTH_REQUIRED'); sql("UPDATE users SET status = 'ACTIVE' WHERE id = 2"); errorCode(fn () => $orders->listCustomerOrders(actor(3), validateOrderList([])), 'FORBIDDEN'); });
check('catalog edits cannot change purchased snapshots', function () use ($orders, $id) { sql("UPDATE products SET name = 'Changed name' WHERE id = 1"); sql('UPDATE product_variants SET price = 700000 WHERE id = 1'); $detail = $orders->getCustomerOrder(actor(), $id); ensure($detail['items'][0]['productName'] === 'Snapshot product' && $detail['items'][0]['unitPrice'] === 600000); });
check('sales wildcard search is literal and pagination bounded', function () use ($orders) { $page = $orders->listSalesOrders(actor(3, 'SALES'), validateOrderList(['search' => '%_'], true)); ensure($page['pagination']['totalItems'] === 0); $page = $orders->listSalesOrders(actor(3, 'SALES'), validateOrderList(['pageSize' => '1'], true)); ensure(count($page['items']) === 1 && $page['pagination']['totalPages'] === 1); });
check('all 49 status pairs match forward/cancel-only state graph', function () {
    $next = ['pending' => 'confirmed', 'confirmed' => 'preparing', 'preparing' => 'shipping', 'shipping' => 'delivered', 'delivered' => 'completed'];
    foreach (['pending', 'confirmed', 'preparing', 'shipping', 'delivered', 'completed', 'cancelled'] as $from) foreach (['pending', 'confirmed', 'preparing', 'shipping', 'delivered', 'completed', 'cancelled'] as $to) {
        $order = ['order_status' => strtoupper($from), 'payment_status' => 'PAID', 'payment_method' => 'VNPAY', 'customer_id' => '1', 'version' => 1, 'inventory_state' => 'RESERVED', 'refund_required' => 0];
        $valid = ($next[$from] ?? null) === $to || $to === 'cancelled' && in_array($from, ['pending', 'confirmed', 'preparing'], true);
        $run = fn () => orderTransition($order, actor(3, 'SALES'), ['expectedVersion' => 1, 'toStatus' => $to, 'reason' => 'Test']);
        if ($valid) ensure($run()['to'] === $to); else errorCode($run, 'INVALID_ORDER_TRANSITION');
    }
});
check('skip/backward/stale-version transitions have no audit side effect', function () use ($orders, $id) { errorCode(fn () => $orders->updateSalesStatus(actor(3, 'SALES'), $id, ['expectedVersion' => 1, 'toStatus' => 'shipping'], 'skip-status-unique-key'), 'INVALID_ORDER_TRANSITION'); errorCode(fn () => $orders->updateSalesStatus(actor(3, 'SALES'), $id, ['expectedVersion' => 2, 'toStatus' => 'confirmed'], 'stale-status-unique-key'), 'ORDER_VERSION_CONFLICT'); ensure((int) sql('SELECT COUNT(*) FROM order_status_history WHERE order_id = ?', [$id]) === 1); });
foreach (['confirmed', 'preparing', 'shipping'] as $index => $status) $orders->updateSalesStatus(actor(3, 'SALES'), $id, ['expectedVersion' => $index + 1, 'toStatus' => $status], 'forward-status-key-' . $status);
check('forward handling consumes reservation without decrementing again', function () use ($id) { ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === 99); ensure(sql('SELECT inventory_state FROM orders WHERE id = ?', [$id]) === 'CONSUMED'); });
check('cancel is forbidden after shipping', function () use ($orders, $id) { errorCode(fn () => $orders->cancelOrder(actor(), $id, ['expectedVersion' => 4, 'reason' => 'Late'], 'late-cancel-unique-key'), 'INVALID_ORDER_TRANSITION'); });
check('delivered COD requires explicit collected true', function () use ($orders, $id) { errorCode(fn () => $orders->updateSalesStatus(actor(3, 'SALES'), $id, ['expectedVersion' => 4, 'toStatus' => 'delivered'], 'cod-missing-unique-key'), 'COD_COLLECTION_REQUIRED'); ensure(sql('SELECT status FROM payments WHERE order_id = ?', [$id]) === 'UNPAID'); });
check('bad payment amount rolls back delivered state/history', function () use ($orders, $id) { sql('UPDATE payments SET amount = 1 WHERE order_id = ?', [$id]); errorCode(fn () => $orders->updateSalesStatus(actor(3, 'SALES'), $id, ['expectedVersion' => 4, 'toStatus' => 'delivered', 'codCollected' => true], 'cod-bad-amount-key'), 'PAYMENT_CONFLICT'); ensure((int) sql('SELECT version FROM orders WHERE id = ?', [$id]) === 4); sql('UPDATE payments SET amount = 600000 WHERE order_id = ?', [$id]); });
$delivered = $orders->updateSalesStatus(actor(3, 'SALES'), $id, ['expectedVersion' => 4, 'toStatus' => 'delivered', 'codCollected' => true], 'cod-delivered-unique-key');
check('delivered and paid commit atomically with immutable SALES role', function () use ($delivered, $id) { ensure($delivered['paymentStatus'] === 'paid' && $delivered['orderStatus'] === 'delivered'); ensure(sql('SELECT status FROM payments WHERE order_id = ?', [$id]) === 'PAID'); ensure($delivered['history'][4]['actorRole'] === 'SALES'); });
check('completion without device/care owner adapter cannot silently finish an order', function () use ($orders, $id) {
    errorCode(fn () => $orders->updateSalesStatus(actor(3, 'SALES'), $id, ['expectedVersion' => 5, 'toStatus' => 'completed'], 'complete-unmapped-key'), 'DEPENDENCY_NOT_READY');
    ensure(sql('SELECT order_status FROM orders WHERE id = ?', [$id]) === 'DELIVERED');
    ensure((int) sql('SELECT version FROM orders WHERE id = ?', [$id]) === 5);
});
check('return request rejects foreign owner and pending state', function () use ($orders, $id) { errorCode(fn () => $orders->createReturnRequest(actor(2), $id, ['expectedVersion' => 5, 'reason' => 'Test'], 'return-foreign-key'), 'ORDER_NOT_FOUND'); });
$returned = $orders->createReturnRequest(actor(), $id, ['expectedVersion' => 5, 'reason' => 'Damaged package'], 'return-first-unique-key');
check('return replay is stable, separate lifecycle, no stock/payment/order mutation', function () use ($orders, $id, $returned) { ensure($orders->createReturnRequest(actor(), $id, ['expectedVersion' => 5, 'reason' => 'Damaged package'], 'return-first-unique-key') == $returned); ensure((int) sql('SELECT version FROM orders WHERE id = ?', [$id]) === 5); ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === 99); ensure(sql('SELECT status FROM payments WHERE order_id = ?', [$id]) === 'PAID'); });
check('duplicate return with a new key is rejected', function () use ($orders, $id) { errorCode(fn () => $orders->createReturnRequest(actor(), $id, ['expectedVersion' => 5, 'reason' => 'Again'], 'return-second-unique-key'), 'RETURN_REQUEST_EXISTS'); });
$cancelId = create(cart(), 'checkout-to-cancel-key')['id'];
check('return unavailable before delivery', function () use ($orders, $cancelId) { errorCode(fn () => $orders->createReturnRequest(actor(), $cancelId, ['expectedVersion' => 1, 'reason' => 'Early'], 'return-early-unique-key'), 'RETURN_UNAVAILABLE'); });
check('cancel and replay restore exactly once; new stale key cannot restore twice', function () use ($orders, $cancelId) { $input = ['expectedVersion' => 1, 'reason' => 'No longer needed']; $result = $orders->cancelOrder(actor(), $cancelId, $input, 'cancel-first-unique-key'); ensure($orders->cancelOrder(actor(), $cancelId, $input, 'cancel-first-unique-key') == $result); errorCode(fn () => $orders->cancelOrder(actor(), $cancelId, $input, 'cancel-second-unique-key'), 'ORDER_VERSION_CONFLICT'); ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === 99); ensure((int) sql("SELECT COUNT(*) FROM inventory_movements WHERE movement_type = 'RELEASE' AND order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)", [$cancelId]) === 1); });
$legacyId = create(cart(), 'checkout-legacy-unique-key')['id'];
check('legacy UNTRACKED reservation never invents stock restoration', function () use ($orders, $legacyId) { sql("UPDATE orders SET inventory_state = 'UNTRACKED' WHERE id = ?", [$legacyId]); errorCode(fn () => $orders->cancelOrder(actor(), $legacyId, ['expectedVersion' => 1, 'reason' => 'Test'], 'cancel-untracked-key'), 'INVENTORY_UNTRACKED'); });
check('unknown historical role is not backfilled from current account', function () use ($orders, $legacyId) { sql('UPDATE order_status_history SET actor_role = NULL WHERE order_id = ?', [$legacyId]); errorCode(fn () => $orders->getCustomerOrder(actor(), $legacyId), 'ORDER_DATA_INCOMPATIBLE'); sql("UPDATE order_status_history SET actor_role = 'CUSTOMER' WHERE order_id = ?", [$legacyId]); });
check('corrupt line snapshot is rejected rather than silently recalculated', function () use ($orders, $legacyId) {
    sql('UPDATE order_items SET line_total = 1 WHERE order_id = ?', [$legacyId]);
    errorCode(fn () => $orders->getCustomerOrder(actor(), $legacyId), 'ORDER_DATA_INCOMPATIBLE');
    sql('UPDATE order_items SET line_total = unit_price * quantity WHERE order_id = ?', [$legacyId]);
});
check('changed price after quote rejects create without mutation', function () use ($checkout) { $input = cart(); $quote = $checkout->quoteCheckout(actor(), $input); $before = (int) sql('SELECT COUNT(*) FROM orders'); sql('UPDATE product_variants SET price = 710000 WHERE id = 1'); errorCode(fn () => $checkout->createOrder(actor(), $input + ['quoteFingerprint' => $quote['quoteFingerprint'], 'note' => ''], 'checkout-changed-price-key'), 'CHECKOUT_CHANGED'); ensure((int) sql('SELECT COUNT(*) FROM orders') === $before); });
check('foreign address, unsupported voucher and VNPay fail before writes', function () use ($checkout) { $input = cart(); errorCode(fn () => $checkout->quoteCheckout(actor(2), $input), 'CART_VERSION_CONFLICT'); errorCode(fn () => $checkout->quoteCheckout(actor(), array_replace($input, ['addressId' => '99999'])), 'ADDRESS_NOT_FOUND'); errorCode(fn () => $checkout->quoteCheckout(actor(), array_replace($input, ['voucherCode' => 'TEST'])), 'VOUCHER_INVALID'); errorCode(fn () => $checkout->quoteCheckout(actor(), array_replace($input, ['paymentMethod' => 'VNPAY'])), 'PAYMENT_NOT_AVAILABLE'); });
check('failure after stock movement rolls back order/items/payment/history/key/cart/stock', function () use ($checkout, $deps) {
    $input = cart(); $quote = $checkout->quoteCheckout(actor(), $input);
    $tables = ['orders', 'order_items', 'payments', 'order_status_history', 'order_idempotency', 'inventory_movements', 'cart_items'];
    $before = array_map(fn ($table) => (int) sql('SELECT COUNT(*) FROM ' . $table), $tables);
    $stock = (int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1');
    $deps->failAfterReserve = true;
    try { $checkout->createOrder(actor(), $input + ['quoteFingerprint' => $quote['quoteFingerprint'], 'note' => ''], 'checkout-rollback-unique-key'); throw new LogicException('Failure not injected.'); } catch (RuntimeException $error) { ensure($error->getMessage() === 'Injected failure after reservation.'); } finally { $deps->failAfterReserve = false; }
    ensure(array_map(fn ($table) => (int) sql('SELECT COUNT(*) FROM ' . $table), $tables) === $before);
    ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === $stock);
    ensure((int) sql('SELECT version FROM test_cart_versions WHERE cart_id = (SELECT id FROM carts WHERE user_id = 1)') === $input['cartVersion']);
});
check('missing production owner adapter returns 503, not fake success', function () use ($model, $id) { errorCode(fn () => (new CheckoutService($model))->quoteCheckout(actor(), cart()), 'DEPENDENCY_NOT_READY'); errorCode(fn () => (new OrderService($model))->reorder(actor(), $id, ['expectedCartVersion' => 1], 'reorder-unmapped-key'), 'DEPENDENCY_NOT_READY'); });
check('runtime MySQL opt-in reaches real storage; owner and dependency errors keep correct envelopes', function () use ($id) {
    putenv('ORDER_STORAGE_MODE=mysql');
    try {
        $session = ['user' => actor(), 'expiresAt' => time() + 3600, 'csrfToken' => 'test-runtime-csrf'];
        $response = HomeCare\OrderApi\handleOrderApi('GET', '/orders/' . $id, [], '', [], $session);
        ensure($response['status'] === 200 && $response['body']['data']['id'] === $id);
        $foreign = HomeCare\OrderApi\handleOrderApi('GET', '/orders/' . $id, [], '', [], array_replace($session, ['user' => actor(2)]));
        ensure($foreign['status'] === 404 && $foreign['body']['errors']['code'] === 'ORDER_NOT_FOUND');
        $quote = HomeCare\OrderApi\handleOrderApi('POST', '/checkout/quote', [], json_encode(cart(), JSON_THROW_ON_ERROR), ['Content-Type' => 'application/json', 'X-CSRF-Token' => 'test-runtime-csrf'], $session);
        ensure($quote['status'] === 503 && $quote['body']['errors']['code'] === 'DEPENDENCY_NOT_READY');
    } finally { putenv('ORDER_STORAGE_MODE=disabled'); }
});
echo "MySQL checks: {$checks}; failures: {$failures}\n";
exit($failures === 0 ? 0 : 1);
