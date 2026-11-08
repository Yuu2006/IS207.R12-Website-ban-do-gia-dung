<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' || getenv('ORDER_MYSQL_TEST') !== 'isolated') { http_response_code(404); exit; }
require_once __DIR__ . '/../utils/order-api.php';
require_once __DIR__ . '/order-test-dependencies.php';

use HomeCare\OrderApi\{ApiException, OrderModel, OrderService, CheckoutService, CartService, MysqlCheckoutDependencies, SqlTestCheckoutDependencies, VnpayGateway, VnpayPaymentService, ReturnRefundModel, ReturnRefundService, ReportModel, ReportService};
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
    $schema = file_get_contents(__DIR__ . '/../../database/schema_database.sql');
    // Ignore the local scratch query appended to this worktree's baseline; leave the source file untouched.
    $scratchQuery = strpos($schema, "-- TEST");
    if ($scratchQuery !== false) $schema = substr($schema, 0, $scratchQuery);
    $schema = str_replace('homecare_local', $name, $schema);
    if (!is_string($schema)) throw new RuntimeException('Could not prepare isolated baseline schema.');
    $pdo->exec($schema);
    $pdo->exec(file_get_contents(__DIR__ . '/../db/migrations/008_order_runtime.sql'));
    $pdo->exec(file_get_contents(__DIR__ . '/../db/migrations/013_checkout_runtime.sql'));
    $pdo->exec(file_get_contents(__DIR__ . '/../db/migrations/014_vnpay_runtime.sql'));
    $pdo->exec(file_get_contents(__DIR__ . '/../db/migrations/015_return_refund_reporting.sql'));
    $pdo->exec('CREATE TABLE test_cart_versions (cart_id BIGINT UNSIGNED PRIMARY KEY, version BIGINT UNSIGNED NOT NULL DEFAULT 1) ENGINE=InnoDB');
    foreach (['CUSTOMER', 'CUSTOMER', 'SALES', 'ADMIN', 'WAREHOUSE', 'CUSTOMER', 'CUSTOMER', 'CUSTOMER', 'CUSTOMER', 'CUSTOMER'] as $index => $role) {
        $statement = $pdo->prepare('INSERT INTO users (id, full_name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)');
        $statement->execute([$index + 1, 'Test ' . ($index + 1), 'test' . ($index + 1) . '@example.invalid', 'not-a-login-credential', $role]);
    }
    $pdo->exec("INSERT INTO categories (id, name, slug) VALUES (1, 'Test appliance', 'test-appliance')");
    $pdo->exec("INSERT INTO brands (id, name) VALUES (1, 'Test brand')");
    $pdo->exec("INSERT INTO products (id, category_id, brand_id, product_code, name, slug, warranty_months) VALUES (1, 1, 1, 'TEST-P', 'Snapshot product', 'test-product', 24)");
    $pdo->exec("INSERT INTO product_variants (id, product_id, sku, variant_name, price, stock_quantity) VALUES (1, 1, 'TEST-1', 'White', 600000, 100), (2, 1, 'TEST-LAST', 'Black', 800000, 1)");
    echo "Baseline + 008/013/014/015 migrations applied to a fresh isolated DB; fixture cart version is test-only.\n";
    exit;
}
$pdo->exec("USE `{$name}`");
$model = new OrderModel($pdo);
$deps = new SqlTestCheckoutDependencies();
$orders = new OrderService($model, $deps);
$checkout = new CheckoutService($model, $deps);
$runtimeDependencies = new MysqlCheckoutDependencies();
$cartService = new CartService($model, $runtimeDependencies);
$gateway = new VnpayGateway(['tmnCode' => 'TEST1234', 'hashSecret' => 'isolated-test-secret', 'returnUrl' => 'http://localhost:5173/orders/payment-return', 'ipnUrl' => 'https://merchant.example.test/api/payments/vnpay/ipn']);
$runtimeCheckout = new CheckoutService($model, $runtimeDependencies, $gateway);
$vnpayPayments = new VnpayPaymentService($model, $runtimeDependencies, $gateway);
function actor(int $id = 1, string $role = 'CUSTOMER'): array { return ['id' => (string) $id, 'role' => $role, 'fullName' => 'Test']; }
function sql(string $query, array $values = []): mixed {
    global $pdo;
    $statement = $pdo->prepare($query);
    $statement->execute($values);
    return $statement->fetchColumn();
}
function ensure(bool $value, string $message = 'Assertion failed'): void
{
    if ($value) return;
    $caller = debug_backtrace(DEBUG_BACKTRACE_IGNORE_ARGS, 1)[0] ?? [];
    $line = isset($caller['line']) ? ' at line ' . $caller['line'] : '';
    throw new RuntimeException($message . $line);
}
function errorCode(callable $operation, string $code): void {
    try { $operation(); } catch (ApiException $error) { ensure($error->errorCode === $code, 'Expected ' . $code . ', got ' . $error->errorCode); return; }
    throw new RuntimeException('Expected error ' . $code);
}
function returnApiMutation(string $path, array $body, array $principal, string $key, ReturnRefundService $service): array {
    $session = ['user' => $principal, 'expiresAt' => time() + 3600, 'csrfToken' => 'return-api-csrf'];
    $headers = ['Content-Type' => 'application/json', 'X-CSRF-Token' => 'return-api-csrf', 'Idempotency-Key' => $key];
    return HomeCare\OrderApi\handleOrderApi('POST', $path, [], json_encode($body, JSON_THROW_ON_ERROR), $headers, $session, returnRefundService: $service);
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
// Build a real post-013 customer cart for checkout-runtime integration tests.
function runtimeCart(int $user, int $sku = 1, int $quantity = 1, ?string $voucher = null): array {
    global $pdo;
    $cartId = sql('SELECT id FROM carts WHERE user_id = ?', [$user]);
    if (!$cartId) { sql('INSERT INTO carts (user_id, cart_version) VALUES (?, 1)', [$user]); $cartId = $pdo->lastInsertId(); }
    sql('UPDATE cart_items SET is_deleted = 1 WHERE cart_id = ?', [$cartId]);
    sql('INSERT INTO cart_items (cart_id, variant_id, quantity, is_deleted) VALUES (?, ?, ?, 0) ON DUPLICATE KEY UPDATE quantity = VALUES(quantity), is_deleted = 0', [$cartId, $sku, $quantity]);
    $addressId = sql('SELECT id FROM addresses WHERE user_id = ? LIMIT 1', [$user]);
    if (!$addressId) { sql("INSERT INTO addresses (user_id, recipient_name, phone, address_line, province) VALUES (?, 'Runtime Test', '0900000000', '99 Runtime street', 'Test city')", [$user]); $addressId = $pdo->lastInsertId(); }
    return ['cartVersion' => (int) sql('SELECT cart_version FROM carts WHERE id = ?', [$cartId]), 'addressId' => (string) $addressId, 'paymentMethod' => 'COD', 'voucherCode' => $voucher];
}
// Independently sign callback fixtures using the documented VNPAY 2.1 sorted-field format.
function signedVnpay(array $parameters): array {
    $parameters['vnp_SecureHash'] = '';
    ksort($parameters, SORT_STRING);
    $pairs = [];
    foreach ($parameters as $key => $value) if ($key !== 'vnp_SecureHash' && $value !== '' && $value !== null) $pairs[] = urlencode((string) $key) . '=' . urlencode((string) $value);
    $parameters['vnp_SecureHash'] = hash_hmac('sha512', implode('&', $pairs), 'isolated-test-secret');
    return $parameters;
}
function createAs(array $principal, array $input, string $key): array {
    global $checkout;
    $quote = $checkout->quoteCheckout($principal, $input);
    return $checkout->createOrder($principal, $input + ['quoteFingerprint' => $quote['quoteFingerprint'], 'note' => 'Test note'], $key)['order'];
}
function create(array $input, string $key): array { return createAs(actor(), $input, $key); }
if ($mode === 'prepare-race') {
    $result = [];
    foreach ([8, 9] as $id) {
        $input = array_replace(runtimeCart($id, 2), ['paymentMethod' => 'COD']);
        $quote = $runtimeCheckout->quoteCheckout(actor($id), $input);
        $result[] = ['actor' => actor($id), 'input' => $input + ['quoteFingerprint' => $quote['quoteFingerprint'], 'note' => 'Race'], 'key' => 'checkout-race-' . $id . '-unique'];
    }
    echo json_encode($result, JSON_THROW_ON_ERROR); exit;
}
if ($mode === 'prepare-idempotency-race') {
    $input = array_replace(runtimeCart(10, 1), ['paymentMethod' => 'COD']);
    $quote = $runtimeCheckout->quoteCheckout(actor(10), $input);
    echo json_encode(['actor' => actor(10), 'input' => $input + ['quoteFingerprint' => $quote['quoteFingerprint'], 'note' => 'Double submit'], 'key' => 'checkout-double-submit-runtime-key', 'stockBefore' => (int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1')], JSON_THROW_ON_ERROR); exit;
}
if ($mode === 'checkout-worker' || $mode === 'runtime-checkout-worker' || $mode === 'status-worker') {
    $request = json_decode($argv[2], true, 512, JSON_THROW_ON_ERROR);
    try {
        $service = $mode === 'runtime-checkout-worker' ? $runtimeCheckout : $checkout;
        $result = in_array($mode, ['checkout-worker', 'runtime-checkout-worker'], true) ? $service->createOrder($request['actor'], $request['input'], $request['key']) : $orders->updateSalesStatus(actor(3, 'SALES'), $request['id'], ['expectedVersion' => $request['expectedVersion'] ?? 1, 'toStatus' => $request['toStatus'] ?? 'confirmed'], 'status-race-key-' . $request['key']);
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
if ($mode === 'verify-idempotency-race') {
    $input = json_decode($argv[2], true, 512, JSON_THROW_ON_ERROR);
    ensure((int) sql('SELECT COUNT(*) FROM orders WHERE customer_id = 10') === 1);
    ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === $input['stockBefore'] - 1);
    ensure((int) sql("SELECT COUNT(*) FROM inventory_movements m JOIN order_items i ON i.id = m.order_item_id JOIN orders o ON o.id = i.order_id WHERE o.customer_id = 10 AND m.movement_type = 'RESERVE'") === 1);
    ensure((int) sql("SELECT COUNT(*) FROM payments p JOIN orders o ON o.id = p.order_id WHERE o.customer_id = 10") === 1);
    echo "ok - concurrent duplicate checkout: one order, one payment and one stock decrement\n"; exit;
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
check('cart add merges SKU once, replays idempotently, rejects stale version and does not reserve stock', function () use ($cartService) {
    $principal = actor(9);
    $initial = $cartService->getCart($principal);
    $stockBefore = (int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1');
    $input = ['variantId' => '1', 'quantity' => 1, 'expectedCartVersion' => $initial['cartVersion']];
    $added = $cartService->addItem($principal, $input, 'cart-add-runtime-key-0001');
    $replay = $cartService->addItem($principal, $input, 'cart-add-runtime-key-0001');
    ensure($added == $replay, 'Add replay must preserve the same JSON values.');
    ensure($added['cartVersion'] === $initial['cartVersion'] + 1, 'Add must increment the cart version once.');
    ensure(count($added['items']) === 1 && $added['items'][0]['quantity'] === 1);

    $merged = $cartService->addItem($principal, ['variantId' => '1', 'quantity' => 2, 'expectedCartVersion' => $added['cartVersion']], 'cart-add-runtime-key-0002');
    ensure($merged['cartVersion'] === $added['cartVersion'] + 1 && $merged['items'][0]['quantity'] === 3);
    errorCode(fn () => $cartService->addItem($principal, $input, 'cart-add-runtime-key-stale'), 'CART_VERSION_CONFLICT');
    errorCode(fn () => $cartService->addItem($principal, ['variantId' => '2', 'quantity' => 2, 'expectedCartVersion' => $merged['cartVersion']], 'cart-add-runtime-key-stock'), 'OUT_OF_STOCK');
    ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === $stockBefore, 'Adding cart items must not decrement stock.');
    ensure($cartService->getCart($principal) === $merged, 'Rejected mutations changed the cart.');
});
check('cart removal is idempotent, versioned, soft-deleted, and does not change stock', function () use ($cartService) {
    $principal = actor(9);
    $before = $cartService->getCart($principal);
    $stockBefore = (int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1');
    $input = ['expectedCartVersion' => $before['cartVersion']];
    $removed = $cartService->removeItem($principal, '1', $input, 'cart-remove-runtime-key-01');
    $replay = $cartService->removeItem($principal, '1', $input, 'cart-remove-runtime-key-01');
    ensure($removed == $replay, 'Remove replay must preserve the same JSON values.');
    ensure($removed['items'] === [], 'Removed item must be absent from the active cart snapshot.');
    ensure($removed['cartVersion'] === $before['cartVersion'] + 1);
    ensure((int) sql('SELECT is_deleted FROM cart_items WHERE cart_id = (SELECT id FROM carts WHERE user_id = 9) AND variant_id = 1') === 1);
    ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === $stockBefore);
    errorCode(fn () => $cartService->removeItem($principal, '1', $input, 'cart-remove-stale-version-key'), 'CART_VERSION_CONFLICT');
});
check('cart snapshot exposes inactive SKU as removable without a purchase price', function () use ($cartService) {
    $principal = actor(9);
    $cart = $cartService->getCart($principal);
    $added = $cartService->addItem($principal, ['variantId' => '1', 'quantity' => 1, 'expectedCartVersion' => $cart['cartVersion']], 'cart-inactive-add-runtime-key');
    sql('UPDATE product_variants SET is_active = 0 WHERE id = 1');
    $unavailable = $cartService->getCart($principal);
    ensure(count($unavailable['items']) === 1 && $unavailable['items'][0]['available'] === false);
    ensure($unavailable['items'][0]['unitPrice'] === 0 && $unavailable['items'][0]['availableQuantity'] === 0);
    sql('UPDATE product_variants SET is_active = 1 WHERE id = 1');
    $cartService->removeItem($principal, '1', ['expectedCartVersion' => $unavailable['cartVersion']], 'cart-inactive-remove-runtime-key');
});
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
check('delivered order cannot be cancelled and leaves payment, history and inventory unchanged', function () use ($orders, $id) {
    errorCode(fn () => $orders->cancelOrder(actor(), $id, ['expectedVersion' => 5, 'reason' => 'Too late'], 'cancel-after-delivery-key'), 'INVALID_ORDER_TRANSITION');
    ensure(sql('SELECT order_status FROM orders WHERE id = ?', [$id]) === 'DELIVERED');
    ensure(sql('SELECT payment_status FROM orders WHERE id = ?', [$id]) === 'PAID');
    ensure((int) sql('SELECT COUNT(*) FROM order_status_history WHERE order_id = ?', [$id]) === 5);
    ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === 99);
});
check('completion without device/care owner adapter cannot silently finish an order', function () use ($orders, $id) {
    errorCode(fn () => $orders->updateSalesStatus(actor(3, 'SALES'), $id, ['expectedVersion' => 5, 'toStatus' => 'completed'], 'complete-unmapped-key'), 'DEPENDENCY_NOT_READY');
    ensure(sql('SELECT order_status FROM orders WHERE id = ?', [$id]) === 'DELIVERED');
    ensure((int) sql('SELECT version FROM orders WHERE id = ?', [$id]) === 5);
});
check('return request rejects foreign owner and pending state', function () use ($orders, $id) { errorCode(fn () => $orders->createReturnRequest(actor(2), $id, ['expectedVersion' => 5, 'issueCategory' => 'OTHER', 'reason' => 'Test'], 'return-foreign-key'), 'ORDER_NOT_FOUND'); });
$returned = $orders->createReturnRequest(actor(), $id, ['expectedVersion' => 5, 'issueCategory' => 'TRANSIT_DAMAGE', 'reason' => 'Damaged package'], 'return-first-unique-key');
check('return replay is stable, separate lifecycle, no stock/payment/order mutation', function () use ($orders, $id, $returned) { ensure($orders->createReturnRequest(actor(), $id, ['expectedVersion' => 5, 'issueCategory' => 'TRANSIT_DAMAGE', 'reason' => 'Damaged package'], 'return-first-unique-key') == $returned); ensure((int) sql('SELECT version FROM orders WHERE id = ?', [$id]) === 5); ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === 99); ensure(sql('SELECT status FROM payments WHERE order_id = ?', [$id]) === 'PAID'); ensure(sql('SELECT COUNT(*) FROM order_return_status_history WHERE return_request_id = ?', [$returned['id']]) === 1); });
check('duplicate return with a new key is rejected', function () use ($orders, $id) { errorCode(fn () => $orders->createReturnRequest(actor(), $id, ['expectedVersion' => 5, 'issueCategory' => 'OTHER', 'reason' => 'Again'], 'return-second-unique-key'), 'RETURN_REQUEST_EXISTS'); });
$cancelId = create(cart(), 'checkout-to-cancel-key')['id'];
check('return unavailable before delivery', function () use ($orders, $cancelId) { errorCode(fn () => $orders->createReturnRequest(actor(), $cancelId, ['expectedVersion' => 1, 'issueCategory' => 'OTHER', 'reason' => 'Early'], 'return-early-unique-key'), 'RETURN_UNAVAILABLE'); });
check('cancel and replay restore exactly once; new stale key cannot restore twice', function () use ($orders, $cancelId) { $input = ['expectedVersion' => 1, 'reason' => 'No longer needed']; $result = $orders->cancelOrder(actor(), $cancelId, $input, 'cancel-first-unique-key'); ensure($orders->cancelOrder(actor(), $cancelId, $input, 'cancel-first-unique-key') == $result); errorCode(fn () => $orders->cancelOrder(actor(), $cancelId, $input, 'cancel-second-unique-key'), 'ORDER_VERSION_CONFLICT'); ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === 99); ensure((int) sql("SELECT COUNT(*) FROM inventory_movements WHERE movement_type = 'RELEASE' AND order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)", [$cancelId]) === 1); });
check('return unavailable for cancelled order', function () use ($orders, $cancelId) { errorCode(fn () => $orders->createReturnRequest(actor(), $cancelId, ['expectedVersion' => 2, 'issueCategory' => 'OTHER', 'reason' => 'After cancellation'], 'return-cancelled-key'), 'RETURN_UNAVAILABLE'); ensure((int) sql('SELECT COUNT(*) FROM order_return_requests WHERE order_id = ?', [$cancelId]) === 0); });
$returnDesk = new ReturnRefundService($pdo, new ReturnRefundModel($pdo));
check('return API queue is staff-only and mutating actions enforce CSRF', function () use ($returnDesk): void {
    $salesSession = ['user' => actor(3, 'SALES'), 'expiresAt' => time() + 3600, 'csrfToken' => 'return-api-csrf'];
    $list = HomeCare\OrderApi\handleOrderApi('GET', '/returns', ['page' => '1', 'pageSize' => '10'], '', [], $salesSession, returnRefundService: $returnDesk);
    ensure($list['status'] === 200 && isset($list['body']['data']['pagination']));
    $customerSession = array_replace($salesSession, ['user' => actor(1, 'CUSTOMER')]);
    $forbidden = HomeCare\OrderApi\handleOrderApi('GET', '/returns', [], '', [], $customerSession, returnRefundService: $returnDesk);
    ensure($forbidden['status'] === 403 && $forbidden['body']['errors']['code'] === 'FORBIDDEN');
    $csrfFailure = HomeCare\OrderApi\handleOrderApi('POST', '/sales/returns/1/triage', [], json_encode(['severity' => 'MINOR', 'note' => 'Test'], JSON_THROW_ON_ERROR), ['Content-Type' => 'application/json', 'Idempotency-Key' => 'return-api-missing-csrf-key'], $salesSession, returnRefundService: $returnDesk);
    ensure($csrfFailure['status'] === 403 && $csrfFailure['body']['errors']['code'] === 'CSRF_INVALID');
});
$minorOrderId = createAs(actor(8), cart(8), 'return-minor-order-key')['id'];
sql("UPDATE orders SET order_status = 'DELIVERED', payment_status = 'PAID' WHERE id = ?", [$minorOrderId]);
sql("UPDATE payments SET status = 'PAID', paid_at = UTC_TIMESTAMP() WHERE order_id = ?", [$minorOrderId]);
$minorRequest = $orders->createReturnRequest(actor(8), $minorOrderId, ['expectedVersion' => 1, 'issueCategory' => 'COSMETIC_DAMAGE', 'reason' => 'Small cosmetic scratch'], 'return-minor-request-key');
$minorDetailSession = ['user' => actor(3, 'SALES'), 'expiresAt' => time() + 3600, 'csrfToken' => 'return-api-csrf'];
$minorDetailResponse = HomeCare\OrderApi\handleOrderApi('GET', '/returns/' . $minorRequest['id'], [], '', [], $minorDetailSession, returnRefundService: $returnDesk);
check('return detail API exposes customer category, order and initial audit to staff', function () use ($minorDetailResponse) { ensure($minorDetailResponse['status'] === 200 && $minorDetailResponse['body']['data']['issueCategory'] === 'COSMETIC_DAMAGE' && count($minorDetailResponse['body']['data']['history']) === 1); });
$minorResponse = returnApiMutation('/sales/returns/' . $minorRequest['id'] . '/triage', ['severity' => 'MINOR', 'note' => 'Ảnh xác nhận vết xước nhỏ, không ảnh hưởng an toàn hoặc chức năng.'], actor(3, 'SALES'), 'return-minor-triage-key', $returnDesk);
$minorTriage = $minorResponse['body']['data'];
ensure($minorResponse['status'] === 200);
check('minor issue is rejected and cannot reach manager refund approval', function () use ($returnDesk, $minorRequest, $minorTriage, $minorOrderId) { ensure($minorTriage['status'] === 'rejected'); errorCode(fn () => $returnDesk->decide(actor(4, 'ADMIN'), $minorRequest['id'], ['decision' => 'APPROVE', 'reason' => 'Test'], 'return-minor-decision-key'), 'RETURN_NOT_PENDING_MANAGER'); ensure((int) sql('SELECT COUNT(*) FROM order_simulated_refunds WHERE order_id = ?', [$minorOrderId]) === 0); });
sql("UPDATE orders SET order_status = 'COMPLETED' WHERE id = ?", [$id]);
sql("INSERT INTO order_status_history (order_id, changed_by, status, note, changed_at, from_status, actor_role) VALUES (?, 3, 'COMPLETED', 'Test report completion', UTC_TIMESTAMP(), 'DELIVERED', 'SALES')", [$id]);
$majorResponse = returnApiMutation('/sales/returns/' . $returned['id'] . '/triage', ['severity' => 'MAJOR', 'note' => 'Sản phẩm hư hỏng ảnh hưởng chức năng; đã đối chiếu ảnh.'], actor(3, 'SALES'), 'return-major-triage-key', $returnDesk);
$majorTriage = $majorResponse['body']['data'];
ensure($majorResponse['status'] === 200);
check('major return routes to ADMIN and SALES cannot approve it', function () use ($returnDesk, $returned, $majorTriage) { ensure($majorTriage['status'] === 'pending_manager'); errorCode(fn () => $returnDesk->decide(actor(3, 'SALES'), $returned['id'], ['decision' => 'APPROVE', 'reason' => 'No'], 'return-sales-decision-key'), 'FORBIDDEN'); });
$approvedResponse = returnApiMutation('/admin/returns/' . $returned['id'] . '/decision', ['decision' => 'APPROVE', 'reason' => 'Bằng chứng xác nhận lỗi chức năng thuộc mức nặng.'], actor(4, 'ADMIN'), 'return-admin-approval-key', $returnDesk);
$approvedReturn = $approvedResponse['body']['data'];
ensure($approvedResponse['status'] === 200 && $approvedReturn['status'] === 'approved');
$stockBeforeReceipt = (int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1');
$receipt = ['packageReceived' => true, 'orderMatched' => true, 'allItemsPresent' => true, 'conditionAssessed' => true, 'notes' => 'Đã đối chiếu sản phẩm, phụ kiện và tình trạng thực tế.'];
$incompleteReceipt = array_replace($receipt, ['allItemsPresent' => false]);
$incompleteResponse = returnApiMutation('/warehouse/returns/' . $returned['id'] . '/receive', ['checklist' => $incompleteReceipt], actor(5, 'WAREHOUSE'), 'return-incomplete-receipt-key', $returnDesk);
check('warehouse cannot refund when any receipt checklist item is incomplete', function () use ($incompleteResponse, $returned, $id, $stockBeforeReceipt) {
    ensure($incompleteResponse['status'] === 409 && $incompleteResponse['body']['errors']['code'] === 'RETURN_INSPECTION_INCOMPLETE');
    ensure(sql('SELECT status FROM order_return_requests WHERE id = ?', [$returned['id']]) === 'APPROVED');
    ensure(sql('SELECT payment_status FROM orders WHERE id = ?', [$id]) === 'PAID' && (int) sql('SELECT COUNT(*) FROM order_simulated_refunds WHERE order_id = ?', [$id]) === 0);
    ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === $stockBeforeReceipt);
});
$receivedResponse = returnApiMutation('/warehouse/returns/' . $returned['id'] . '/receive', ['checklist' => $receipt], actor(5, 'WAREHOUSE'), 'return-warehouse-receipt-key', $returnDesk);
$receivedReturn = $receivedResponse['body']['data'];
ensure($receivedResponse['status'] === 200);
check('approved return records one simulated full refund after warehouse checklist with no restock', function () use ($returnDesk, $returned, $receivedReturn, $receipt, $id, $stockBeforeReceipt) {
    ensure($receivedReturn['status'] === 'refunded' && $receivedReturn['refundStatus'] === 'simulated' && $receivedReturn['refundAmount'] === 600000, 'Refund DTO mismatch: ' . json_encode($receivedReturn));
    ensure(count($receivedReturn['history']) === 4 && $receivedReturn['inspectionChecklist'] == $receipt, 'History or inspection checklist mismatch.');
    ensure(sql('SELECT payment_status FROM orders WHERE id = ?', [$id]) === 'REFUNDED' && sql('SELECT status FROM payments WHERE order_id = ?', [$id]) === 'REFUNDED', 'Payment/order status mismatch.');
    ensure((int) sql('SELECT COUNT(*) FROM order_simulated_refunds WHERE order_id = ?', [$id]) === 1, 'Refund ledger count mismatch.');
    ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === $stockBeforeReceipt, 'Return receipt changed sellable stock.');
    $replay = $returnDesk->receive(actor(5, 'WAREHOUSE'), $returned['id'], ['checklist' => $receipt], 'return-warehouse-receipt-key');
    ensure($replay == $receivedReturn, 'Idempotent replay response changed: ' . json_encode([$receivedReturn, $replay], JSON_UNESCAPED_UNICODE));
    errorCode(fn () => $returnDesk->receive(actor(5, 'WAREHOUSE'), $returned['id'], ['checklist' => $receipt], 'return-warehouse-new-key'), 'RETURN_NOT_APPROVED');
});
$reportService = new ReportService($pdo, new ReportModel($pdo));
$reportRange = ['from' => (new DateTimeImmutable('now', new DateTimeZone('Asia/Ho_Chi_Minh')))->format('Y-m-d'), 'to' => (new DateTimeImmutable('now', new DateTimeZone('Asia/Ho_Chi_Minh')))->format('Y-m-d')];
$revenueCsv = $reportService->revenueCsv(actor(4, 'ADMIN'), $reportRange);
check('revenue CSV includes completed sale and negative simulated refund events', function () use ($revenueCsv) { ensure(str_contains($revenueCsv, 'SALE') && str_contains($revenueCsv, 'REFUND') && str_contains($revenueCsv, '-600000') && str_contains($revenueCsv, 'NET_TOTAL')); });
check('revenue CSV API returns a raw attachment to ADMIN and rejects SALES', function () use ($reportService, $reportRange): void {
    $adminSession = ['user' => actor(4, 'ADMIN'), 'expiresAt' => time() + 3600, 'csrfToken' => 'report-api-csrf'];
    $response = HomeCare\OrderApi\handleOrderApi('GET', '/admin/reports/revenue.csv', $reportRange, '', [], $adminSession, reportService: $reportService);
    ensure($response['status'] === 200 && str_starts_with($response['headers']['Content-Type'], 'text/csv') && str_contains($response['rawBody'], 'NET_TOTAL'));
    $salesSession = array_replace($adminSession, ['user' => actor(3, 'SALES')]);
    $forbidden = HomeCare\OrderApi\handleOrderApi('GET', '/admin/reports/revenue.csv', $reportRange, '', [], $salesSession, reportService: $reportService);
    ensure($forbidden['status'] === 403 && $forbidden['body']['errors']['code'] === 'FORBIDDEN');
});
$legacyId = create(cart(), 'checkout-legacy-unique-key')['id'];
check('legacy UNTRACKED reservation never invents stock restoration', function () use ($orders, $legacyId) { sql("UPDATE orders SET inventory_state = 'UNTRACKED' WHERE id = ?", [$legacyId]); errorCode(fn () => $orders->cancelOrder(actor(), $legacyId, ['expectedVersion' => 1, 'reason' => 'Test'], 'cancel-untracked-key'), 'INVENTORY_UNTRACKED'); });
check('unknown historical role is not backfilled from current account', function () use ($orders, $legacyId) { sql('UPDATE order_status_history SET actor_role = NULL WHERE order_id = ?', [$legacyId]); errorCode(fn () => $orders->getCustomerOrder(actor(), $legacyId), 'ORDER_DATA_INCOMPATIBLE'); sql("UPDATE order_status_history SET actor_role = 'CUSTOMER' WHERE order_id = ?", [$legacyId]); });
check('corrupt line snapshot is rejected rather than silently recalculated', function () use ($orders, $legacyId) {
    sql('UPDATE order_items SET line_total = 1 WHERE order_id = ?', [$legacyId]);
    errorCode(fn () => $orders->getCustomerOrder(actor(), $legacyId), 'ORDER_DATA_INCOMPATIBLE');
    sql('UPDATE order_items SET line_total = unit_price * quantity WHERE order_id = ?', [$legacyId]);
});
check('changed price after quote rejects create without mutation', function () use ($checkout) { $input = cart(); $quote = $checkout->quoteCheckout(actor(), $input); $before = (int) sql('SELECT COUNT(*) FROM orders'); sql('UPDATE product_variants SET price = 710000 WHERE id = 1'); errorCode(fn () => $checkout->createOrder(actor(), $input + ['quoteFingerprint' => $quote['quoteFingerprint'], 'note' => ''], 'checkout-changed-price-key'), 'CHECKOUT_CHANGED'); ensure((int) sql('SELECT COUNT(*) FROM orders') === $before); });
check('foreign address, unsupported voucher and unconfigured VNPay fail before writes', function () use ($checkout) { $input = cart(); errorCode(fn () => $checkout->quoteCheckout(actor(2), $input), 'CART_VERSION_CONFLICT'); errorCode(fn () => $checkout->quoteCheckout(actor(), array_replace($input, ['addressId' => '99999'])), 'ADDRESS_NOT_FOUND'); errorCode(fn () => $checkout->quoteCheckout(actor(), array_replace($input, ['voucherCode' => 'TEST'])), 'VOUCHER_INVALID'); errorCode(fn () => $checkout->quoteCheckout(actor(), array_replace($input, ['paymentMethod' => 'VNPAY'])), 'VNPAY_NOT_CONFIGURED'); });
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
check('runtime MySQL opt-in reaches real storage; owner and checkout API contracts stay scoped', function () use ($id) {
    putenv('ORDER_STORAGE_MODE=mysql');
    try {
        $session = ['user' => actor(6), 'expiresAt' => time() + 3600, 'csrfToken' => 'test-runtime-csrf'];
        $response = HomeCare\OrderApi\handleOrderApi('GET', '/orders/' . $id, [], '', [], $session);
        ensure($response['status'] === 404 && $response['body']['errors']['code'] === 'ORDER_NOT_FOUND');
        $owner = HomeCare\OrderApi\handleOrderApi('GET', '/orders/' . $id, [], '', [], array_replace($session, ['user' => actor()]));
        ensure($owner['status'] === 200 && $owner['body']['data']['id'] === $id);
        $foreign = HomeCare\OrderApi\handleOrderApi('GET', '/orders/' . $id, [], '', [], array_replace($session, ['user' => actor(2)]));
        ensure($foreign['status'] === 404 && $foreign['body']['errors']['code'] === 'ORDER_NOT_FOUND');
        $input = runtimeCart(6, 1);
        $quote = HomeCare\OrderApi\handleOrderApi('POST', '/checkout/quote', [], json_encode($input, JSON_THROW_ON_ERROR), ['Content-Type' => 'application/json', 'X-CSRF-Token' => 'test-runtime-csrf'], $session);
        ensure($quote['status'] === 200 && $quote['body']['data']['totals']['total'] === 710000);
    } finally { putenv('ORDER_STORAGE_MODE=disabled'); }
});
check('production checkout calculates voucher totals and confirms signed VNPay IPN once', function () use ($runtimeCheckout, $gateway, $vnpayPayments) {
    sql("INSERT INTO vouchers (code, discount_type, discount_value, min_order_amount, max_discount, starts_at, ends_at, usage_limit, used_count, is_active, per_customer_limit, is_deleted) VALUES ('TASK29-10', 'percent', 10, 500000, 100000, DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY), DATE_ADD(UTC_TIMESTAMP(), INTERVAL 1 DAY), 10, 0, 1, 1, 0)");
    $beforeStock = (int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1');
    $input = array_replace(runtimeCart(6, 1, 1, 'TASK29-10'), ['paymentMethod' => 'VNPAY']);
    $quote = $runtimeCheckout->quoteCheckout(actor(6), $input);
    ensure($quote['totals'] === ['subtotal' => 710000, 'discount' => 71000, 'shipping' => 0, 'total' => 639000], 'Server must recalculate SKU, voucher, shipping and final total.');
    $created = $runtimeCheckout->createOrder(actor(6), $input + ['quoteFingerprint' => $quote['quoteFingerprint'], 'note' => 'E2E test'], 'runtime-vnpay-first-order-key');
    $orderId = $created['order']['id'];
    $attempt = $created['payment'];
    ensure($created['order']['paymentStatus'] === 'pending' && $created['order']['paymentMethod'] === 'VNPAY', 'VNPay order and payment must remain pending until IPN.');
    ensure($attempt['attemptReference'] === 'VNPAY-' . $created['order']['code'], 'Payment reference must identify its order attempt.');
    ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === $beforeStock - 1, 'VNPay checkout must reserve inventory once.');
    ensure((int) sql("SELECT used_count FROM vouchers WHERE code = 'TASK29-10'") === 1, 'Checkout must reserve one voucher use.');
    ensure(sql("SELECT status FROM voucher_redemptions WHERE order_id = ?", [$orderId]) === 'RESERVED', 'Voucher redemption must be reserved.');
    ensure((int) sql('SELECT TIMESTAMPDIFF(SECOND, UTC_TIMESTAMP(), expires_at) FROM payments WHERE order_id = ?', [$orderId]) >= 890, 'VNPay attempt must expire after about 15 minutes.');
    $url = parse_url($attempt['redirectUrl']);
    parse_str($url['query'] ?? '', $redirect);
    ensure($url['scheme'] === 'https' && $url['host'] === 'sandbox.vnpayment.vn', 'VNPay redirect must target the official Sandbox host.');
    ensure(($redirect['vnp_Amount'] ?? null) === '63900000' && ($redirect['vnp_TxnRef'] ?? null) === $attempt['attemptReference'] && $gateway->verifyCallback($redirect), 'Sandbox redirect amount, reference and signature must match the server quote.');

    $callback = ['vnp_TmnCode' => 'TEST1234', 'vnp_TxnRef' => $attempt['attemptReference'], 'vnp_Amount' => '63900000', 'vnp_ResponseCode' => '00', 'vnp_TransactionStatus' => '00', 'vnp_TransactionNo' => 'TXN-TASK29-001'];
    $tampered = signedVnpay($callback);
    $tampered['vnp_Amount'] = '63900001';
    $invalidSignature = HomeCare\OrderApi\handleOrderApi('GET', '/payments/vnpay/ipn', $tampered, '', [], [], null, null, null, $vnpayPayments);
    ensure($invalidSignature['status'] === 200 && $invalidSignature['body']['RspCode'] === '97', 'Tampered VNPay signature must be rejected.');
    ensure(sql('SELECT status FROM payments WHERE order_id = ?', [$orderId]) === 'PENDING' && sql('SELECT payment_status FROM orders WHERE id = ?', [$orderId]) === 'PENDING');
    $wrongAmount = signedVnpay(array_replace($callback, ['vnp_Amount' => '63900001']));
    $invalidAmount = HomeCare\OrderApi\handleOrderApi('POST', '/payments/vnpay/ipn', [], http_build_query($wrongAmount), ['Content-Type' => 'application/x-www-form-urlencoded'], [], null, null, null, $vnpayPayments);
    ensure($invalidAmount['status'] === 200 && $invalidAmount['body']['RspCode'] === '04', 'Signed but incorrect VNPay amount must be rejected.');
    ensure(sql('SELECT status FROM payments WHERE order_id = ?', [$orderId]) === 'PENDING', 'Invalid amount must not settle the payment.');

    $signed = signedVnpay($callback);
    $success = HomeCare\OrderApi\handleOrderApi('GET', '/payments/vnpay/ipn', $signed, '', [], [], null, null, null, $vnpayPayments);
    $replay = HomeCare\OrderApi\handleOrderApi('GET', '/payments/vnpay/ipn', $signed, '', [], [], null, null, null, $vnpayPayments);
    ensure($success['status'] === 200 && $success['body']['RspCode'] === '00' && $replay['body']['RspCode'] === '02', 'First signed success must settle; duplicate callback must be acknowledged as already handled.');
    ensure(sql('SELECT status FROM payments WHERE order_id = ?', [$orderId]) === 'PAID', 'Valid callback must mark payment paid.');
    ensure(sql('SELECT payment_status FROM orders WHERE id = ?', [$orderId]) === 'PAID', 'Valid callback must update order payment status.');
    ensure(sql('SELECT order_status FROM orders WHERE id = ?', [$orderId]) === 'PENDING', 'Payment must not advance fulfillment status.');
    ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === $beforeStock - 1, 'Payment callback must not reserve inventory a second time.');
    ensure((int) sql("SELECT COUNT(*) FROM inventory_movements WHERE movement_type = 'RESERVE' AND order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)", [$orderId]) === 1, 'Exactly one inventory reservation must exist.');
    errorCode(fn () => $vnpayPayments->getAttempt(actor(2), $attempt['attemptReference']), 'PAYMENT_ATTEMPT_NOT_FOUND');
    $session = ['user' => actor(6), 'expiresAt' => time() + 3600, 'csrfToken' => 'test-return-csrf'];
    $ownedAttempt = HomeCare\OrderApi\handleOrderApi('GET', '/payments/vnpay/attempts/' . rawurlencode($attempt['attemptReference']), [], '', [], $session, null, null, null, $vnpayPayments);
    ensure($ownedAttempt['status'] === 200 && $ownedAttempt['body']['data']['paymentStatus'] === 'paid', 'Owner payment attempt endpoint must report server-confirmed payment status.');
    $foreignAttempt = HomeCare\OrderApi\handleOrderApi('GET', '/payments/vnpay/attempts/' . rawurlencode($attempt['attemptReference']), [], '', [], array_replace($session, ['user' => actor(2)]), null, null, null, $vnpayPayments);
    ensure($foreignAttempt['status'] === 404 && $foreignAttempt['body']['errors']['code'] === 'PAYMENT_ATTEMPT_NOT_FOUND');
});
check('late VNPay success before expiry worker releases stock and requires refund reconciliation', function () use ($runtimeCheckout, $vnpayPayments) {
    $stockBefore = (int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1');
    $input = array_replace(runtimeCart(7, 1), ['paymentMethod' => 'VNPAY']);
    $quote = $runtimeCheckout->quoteCheckout(actor(7), $input);
    $created = $runtimeCheckout->createOrder(actor(7), $input + ['quoteFingerprint' => $quote['quoteFingerprint'], 'note' => 'Late IPN without expiry job'], 'runtime-vnpay-late-before-worker-key');
    $orderId = $created['order']['id'];
    $attempt = $created['payment'];
    sql('UPDATE payments SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND) WHERE order_id = ?', [$orderId]);
    $callback = signedVnpay(['vnp_TmnCode' => 'TEST1234', 'vnp_TxnRef' => $attempt['attemptReference'], 'vnp_Amount' => (string) ($created['order']['totals']['total'] * 100), 'vnp_ResponseCode' => '00', 'vnp_TransactionStatus' => '00', 'vnp_TransactionNo' => 'TXN-TASK29-LATE-BEFORE-WORKER']);
    ensure($vnpayPayments->handleIpn($callback)['RspCode'] === '00', 'Late successful payment must be recorded for reconciliation.');
    ensure(sql('SELECT order_status FROM orders WHERE id = ?', [$orderId]) === 'CANCELLED', 'Expired unpaid order must be cancelled even when expiry job has not run.');
    ensure(sql('SELECT payment_status FROM orders WHERE id = ?', [$orderId]) === 'PAID' && (int) sql('SELECT refund_required FROM orders WHERE id = ?', [$orderId]) === 1, 'Late success must be paid in the ledger and flagged for refund.');
    ensure(sql('SELECT status FROM payments WHERE order_id = ?', [$orderId]) === 'PAID', 'Late success must be retained in the payment ledger.');
    ensure(sql('SELECT inventory_state FROM orders WHERE id = ?', [$orderId]) === 'RELEASED' && (int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === $stockBefore, 'Expired stock reservation must be released.');
    ensure((int) sql("SELECT COUNT(*) FROM inventory_movements WHERE movement_type = 'RELEASE' AND order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)", [$orderId]) === 1, 'Late callback must create one stock release movement.');
    ensure($vnpayPayments->handleIpn($callback)['RspCode'] === '02', 'Duplicate late callback must be idempotent.');
});
check('VNPay expiry releases stock/voucher once and late success requires reconciliation', function () use ($runtimeCheckout, $vnpayPayments) {
    $stockBefore = (int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1');
    $input = array_replace(runtimeCart(7, 1, 1, 'TASK29-10'), ['paymentMethod' => 'VNPAY']);
    $quote = $runtimeCheckout->quoteCheckout(actor(7), $input);
    $created = $runtimeCheckout->createOrder(actor(7), $input + ['quoteFingerprint' => $quote['quoteFingerprint'], 'note' => 'Expire test'], 'runtime-vnpay-expiry-order-key');
    $orderId = $created['order']['id'];
    $attempt = $created['payment'];
    ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === $stockBefore - 1);
    sql('UPDATE payments SET expires_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 SECOND) WHERE order_id = ?', [$orderId]);
    ensure($vnpayPayments->expirePending() === 1);
    ensure($vnpayPayments->expirePending() === 0);
    ensure(sql('SELECT order_status FROM orders WHERE id = ?', [$orderId]) === 'CANCELLED');
    ensure(sql('SELECT inventory_state FROM orders WHERE id = ?', [$orderId]) === 'RELEASED');
    ensure(sql('SELECT status FROM payments WHERE order_id = ?', [$orderId]) === 'FAILED');
    ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === $stockBefore);
    ensure((int) sql("SELECT used_count FROM vouchers WHERE code = 'TASK29-10'") === 1);
    ensure(sql('SELECT status FROM voucher_redemptions WHERE order_id = ?', [$orderId]) === 'RELEASED');
    ensure((int) sql("SELECT COUNT(*) FROM inventory_movements WHERE movement_type = 'RELEASE' AND order_item_id IN (SELECT id FROM order_items WHERE order_id = ?)", [$orderId]) === 1);

    $lateSuccess = signedVnpay(['vnp_TmnCode' => 'TEST1234', 'vnp_TxnRef' => $attempt['attemptReference'], 'vnp_Amount' => (string) ($created['order']['totals']['total'] * 100), 'vnp_ResponseCode' => '00', 'vnp_TransactionStatus' => '00', 'vnp_TransactionNo' => 'TXN-TASK29-LATE']);
    ensure($vnpayPayments->handleIpn($lateSuccess)['RspCode'] === '00');
    ensure($vnpayPayments->handleIpn($lateSuccess)['RspCode'] === '02');
    ensure(sql('SELECT payment_status FROM orders WHERE id = ?', [$orderId]) === 'PAID');
    ensure((int) sql('SELECT refund_required FROM orders WHERE id = ?', [$orderId]) === 1);
    ensure((int) sql('SELECT stock_quantity FROM product_variants WHERE id = 1') === $stockBefore);
    ensure(sql('SELECT order_status FROM orders WHERE id = ?', [$orderId]) === 'CANCELLED');
});
echo "MySQL checks: {$checks}; failures: {$failures}\n";
exit($failures === 0 ? 0 : 1);
