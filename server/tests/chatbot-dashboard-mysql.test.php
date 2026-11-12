<?php
declare(strict_types=1);

// BOT-01..06 + DASH-01 against the runner's private MySQL (after order/TCO/care init). Never the shared DB.
if (PHP_SAPI !== 'cli' || getenv('ORDER_MYSQL_TEST') !== 'isolated') { http_response_code(404); exit; }
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../utils/order-api.php';
require_once __DIR__ . '/../models/chatbot-model.php';
require_once __DIR__ . '/../services/chatbot-service.php';

$name = getenv('DB_NAME');
$port = getenv('DB_PORT');
if (getenv('DB_HOST') !== '127.0.0.1' || !preg_match('/^homecare_order_test_[0-9]+$/D', $name ?: '') || !ctype_digit($port ?: '') || (int) $port === 3306) throw new RuntimeException('Unsafe test database target.');
$pdo = new PDO("mysql:host=127.0.0.1;port={$port};dbname={$name};charset=utf8mb4", 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec("SET time_zone = '+00:00'");
$mode = $argv[1] ?? 'test';

if ($mode === 'init') {
    $pdo->exec(file_get_contents(__DIR__ . '/../db/migrations/018_chatbot_faqs.sql'));
    $pdo->exec("INSERT INTO categories (id, name, slug) VALUES (50, 'Máy giặt', 'may-giat')");
    $pdo->exec("INSERT INTO brands (id, name, is_active) VALUES (50, 'LG', 1), (51, 'Toshiba', 1), (52, 'Hidden', 0)");
    $pdo->exec("INSERT INTO product_attributes (id, category_id, name, attribute_key, data_type, unit) VALUES (500, 50, 'Công suất', 'power_watts', 'number', 'W'), (501, 50, 'Khối lượng giặt', 'capacity_kg', 'number', 'kg')");
    $pdo->exec("INSERT INTO products (id, category_id, brand_id, product_code, name, slug, warranty_months, is_active) VALUES
        (50, 50, 50, 'BOT-50', 'LG washer', 'bot-lg-washer', 24, 1),
        (51, 50, 51, 'BOT-51', 'Toshiba washer', 'bot-toshiba-washer', 24, 1),
        (52, 50, 50, 'BOT-52', 'Inactive washer', 'bot-inactive-washer', 24, 0),
        (53, 50, 52, 'BOT-53', 'Hidden brand washer', 'bot-hidden-brand', 24, 1),
        (54, 50, 50, 'BOT-54', 'Inactive SKU washer', 'bot-inactive-sku', 24, 1)");
    $pdo->exec("INSERT INTO product_variants (id, product_id, sku, variant_name, price, stock_quantity, is_active, low_stock_threshold) VALUES
        (500, 50, 'BOT-50-A', 'Trắng', 8000000, 3, 1, 5), (501, 51, 'BOT-51-A', 'Bạc', 9000000, 20, 1, 5), (502, 52, 'BOT-52-A', 'Trắng', 5000000, 9, 1, 5),
        (503, 53, 'BOT-53-A', 'Trắng', 5000000, 9, 1, 5), (504, 54, 'BOT-54-A', 'Trắng', 5000000, 9, 0, 5)");
    $pdo->exec("INSERT INTO product_attribute_values (product_id, attribute_id, value_number) VALUES (50, 500, 1500), (51, 500, 1800), (52, 500, 900), (53, 500, 900), (54, 500, 900), (50, 501, 9), (51, 501, 10)");
    // Dashboard fixture lives in January 2020 so other suites' current-time orders cannot leak into the period.
    $order = $pdo->prepare("INSERT INTO orders (id, order_code, customer_id, recipient_name, recipient_phone, shipping_address, delivery_method, subtotal, total_amount, payment_method, payment_status, order_status, placed_at) VALUES (?, ?, 1, 'Test', '0900000000', 'Test address', 'STANDARD', ?, ?, 'COD', ?, ?, ?)");
    $order->execute([9001, 'DASH-1', 1000000, 1000000, 'PAID', 'COMPLETED', '2020-01-05 03:00:00']);
    $order->execute([9002, 'DASH-2', 500000, 500000, 'UNPAID', 'CANCELLED', '2020-01-11 03:00:00']);
    $order->execute([9003, 'DASH-3', 800000, 800000, 'PAID', 'COMPLETED', '2020-01-20 03:00:00']);
    $pdo->exec("INSERT INTO order_items (order_id, variant_id, product_name, sku, variant_name, unit_price, quantity, line_total, warranty_months) VALUES
        (9001, 500, 'LG washer', 'BOT-50-A', 'Trắng', 500000, 2, 1000000, 24), (9002, 501, 'Toshiba washer', 'BOT-51-A', 'Bạc', 500000, 1, 500000, 24), (9003, 501, 'Toshiba washer', 'BOT-51-A', 'Bạc', 800000, 1, 800000, 24)");
    // 2020-01-31 17:30 UTC is 2020-02-01 00:30 in Vietnam: outside a January report.
    $pdo->exec("INSERT INTO order_status_history (order_id, changed_by, status, changed_at) VALUES
        (9001, 3, 'COMPLETED', '2020-01-10 03:00:00'), (9001, 3, 'COMPLETED', '2020-01-12 03:00:00'), (9003, 3, 'COMPLETED', '2020-01-31 17:30:00')");
    echo "Chatbot FAQ migration 018 and chatbot/dashboard fixtures applied to the isolated DB.\n";
    exit;
}

$passed = 0;
function ensureBot(bool $condition, string $message): void
{
    global $passed;
    if (!$condition) { fwrite(STDERR, "FAIL: {$message}\n"); exit(1); }
    $passed++;
}
function rejectedWith(callable $operation, int|string $expected): void
{
    try { $operation(); }
    catch (ApiException $error) { ensureBot($error->status === $expected, "expected HTTP {$expected}, got {$error->status}"); return; }
    catch (HomeCare\OrderApi\ApiException $error) { ensureBot($error->errorCode === $expected, "expected {$expected}, got {$error->errorCode}"); return; }
    ensureBot(false, "expected rejection {$expected}");
}

$chatbot = new ChatbotService(new ChatbotModel($pdo));
$answer = $chatbot->reply(['message' => 'Tư vấn máy giặt dưới 10 triệu tiết kiệm điện']);
ensureBot($answer['intent'] === 'RECOMMEND' && $answer['state'] === 'ANSWERED', 'recommendation answered');
ensureBot(array_column($answer['recommendations'], 'productId') === ['50', '51'], 'only active product/brand/SKU are recommended, lower power first');
ensureBot($answer['recommendations'][0]['currentPrice'] === '8000000' && $answer['recommendations'][0]['stockQuantity'] === 3, 'price and stock come from MySQL');
ensureBot($answer['followUpQuestion'] !== '' && $answer['context']['category'] === 'may-giat' && $answer['context']['budgetMax'] === 10000000, 'follow-up question and slot context returned');
$followUp = $chatbot->reply(['message' => 'hãng LG', 'context' => $answer['context']]);
ensureBot($followUp['recommendations'][0]['productId'] === '50' && $followUp['context']['brandIds'] === ['50'], 'follow-up keeps category/budget and adds brand');
ensureBot($chatbot->reply(['message' => 'giờ mở cửa?', 'context' => $followUp['context']])['recommendations'] === [], 'unmatched question does not repeat old recommendations');
$switched = $chatbot->reply(['message' => 'còn tủ lạnh thì sao', 'context' => $followUp['context']]);
ensureBot($switched['context']['category'] === 'tu-lanh' && $switched['context']['budgetMax'] === null && $switched['context']['brandIds'] === [], 'switching category drops the previous budget/brand');
$clarify = $chatbot->reply(['message' => 'dưới 5 triệu']);
ensureBot($clarify['state'] === 'NEEDS_CLARIFICATION' && $clarify['recommendations'] === [], 'no category asks instead of guessing');
ensureBot($chatbot->reply(['message' => 'máy giặt dưới 1 triệu'])['state'] === 'NO_DATA', 'nothing in budget is NO_DATA, not a fake answer');
rejectedWith(fn () => $chatbot->reply(['message' => 'máy giặt', 'context' => ['category' => 'DROP TABLE']]), 422);
rejectedWith(fn () => $chatbot->reply(['message' => str_repeat('a', 501)]), 422);
rejectedWith(fn () => $chatbot->reply(['message' => 'x', 'price' => 1]), 422);

$faq = $chatbot->createFaq(['question' => 'Chính sách đổi trả?', 'answer' => 'Nội dung đã duyệt.', 'keywords' => 'đổi trả, trả hàng, đổi trả', 'status' => 'DRAFT', 'sortOrder' => 1], 4);
ensureBot($faq['keywords'] === 'đổi trả, trả hàng' && $faq['version'] === 1, 'keywords normalized, duplicate removed');
ensureBot($chatbot->reply(['message' => 'đổi trả thế nào'])['intent'] === 'UNKNOWN', 'DRAFT FAQ is never answered');
ensureBot($chatbot->quickQuestions()['items'] === [], 'DRAFT FAQ is not a quick question');
$active = $chatbot->updateFaq((int) $faq['id'], ['question' => 'Chính sách đổi trả?', 'answer' => 'Nội dung đã duyệt.', 'keywords' => 'đổi trả, trả hàng', 'status' => 'ACTIVE', 'sortOrder' => 1, 'expectedVersion' => 1], 4);
ensureBot($active['status'] === 'ACTIVE' && $active['version'] === 2 && $active['updatedBy'] === 'Test 4', 'admin activation versioned with actor');
$faqAnswer = $chatbot->reply(['message' => 'Chính sách đổi trả thế nào?']);
ensureBot($faqAnswer['intent'] === 'FAQ' && $faqAnswer['reply'] === 'Nội dung đã duyệt.' && $faqAnswer['faq']['id'] === $faq['id'], 'ACTIVE FAQ answered verbatim');
ensureBot($chatbot->quickQuestions()['items'][0]['question'] === 'Chính sách đổi trả?', 'ACTIVE FAQ becomes a quick question');
rejectedWith(fn () => $chatbot->updateFaq((int) $faq['id'], ['question' => 'Q', 'answer' => 'A', 'keywords' => 'ab', 'status' => 'INACTIVE', 'sortOrder' => 0, 'expectedVersion' => 1], 4), 409);
rejectedWith(fn () => $chatbot->createFaq(['question' => '', 'answer' => 'A', 'keywords' => 'ab', 'status' => 'LIVE'], 4), 422);
rejectedWith(fn () => $chatbot->updateFaq(999999, ['question' => 'Q', 'answer' => 'A', 'keywords' => 'ab', 'status' => 'ACTIVE', 'sortOrder' => 0, 'expectedVersion' => 1], 4), 404);

$reports = new HomeCare\OrderApi\ReportService($pdo, new HomeCare\OrderApi\ReportModel($pdo));
$admin = ['id' => '4', 'role' => 'ADMIN'];
rejectedWith(fn () => $reports->dashboard(['id' => '1', 'role' => 'CUSTOMER'], ['from' => '2020-01-01', 'to' => '2020-01-31']), 'FORBIDDEN');
$dashboard = $reports->dashboard($admin, ['from' => '2020-01-01', 'to' => '2020-01-31']);
$sales = $dashboard['sales'];
ensureBot($sales['placedOrders'] === 3, 'placed orders count by placed_at, including cancelled');
ensureBot($sales['grossSalesVnd'] === 1000000 && $sales['saleOrders'] === 1 && $sales['netRevenueVnd'] === 1000000, 'SALE recognized once at first COMPLETED; cancelled and next-month completion excluded');
ensureBot($sales['averageOrderValueVnd'] === 1000000 && $sales['soldUnits'] === 2 && $sales['purchasingCustomers'] === 1, 'units/customers from completed orders only');
$statuses = array_column($dashboard['ordersByStatus'], 'orders', 'status');
ensureBot($statuses === ['completed' => 2, 'cancelled' => 1] && array_sum($statuses) === $sales['placedOrders'], 'status groups add up to placed orders');
ensureBot($dashboard['topProducts'] === [['productId' => '50', 'productName' => 'LG washer', 'soldUnits' => 2, 'revenueVnd' => 1000000]], 'top products by completed units');
ensureBot(in_array('BOT-50-A', array_column($dashboard['lowStock']['items'], 'sku'), true) || $dashboard['lowStock']['total'] > 10, 'low stock SKU listed');
ensureBot($dashboard['lowStock']['total'] === (int) $pdo->query('SELECT COUNT(*) FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.is_active = 1 AND v.is_deleted = 0 AND p.is_active = 1 AND p.is_deleted = 0 AND v.stock_quantity <= v.low_stock_threshold')->fetchColumn(), 'low stock total matches active SKUs');
ensureBot(!in_array('BOT-54-A', array_column($dashboard['lowStock']['items'], 'sku'), true), 'inactive SKU is not a stock alert');
ensureBot($dashboard['decisionTools']['fitChecks'] === 0 && $dashboard['decisionTools']['notFitRate'] === null && $dashboard['decisionTools']['careCompletionRate'] === null, 'empty period gives null rate, not a division by zero');
$february = $reports->dashboard($admin, ['from' => '2020-02-01', 'to' => '2020-02-29']);
ensureBot($february['sales']['grossSalesVnd'] === 800000 && $february['sales']['placedOrders'] === 0, 'Vietnam-time boundary moves the late completion into February');

echo "PASS: {$passed} chatbot and dashboard MySQL checks.\n";
