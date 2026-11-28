<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli' || getenv('ORDER_MYSQL_TEST') !== 'isolated' || getenv('DB_HOST') !== '127.0.0.1' || getenv('DB_PORT') === '3306' || !preg_match('/^homecare_order_test_[0-9]+$/D', getenv('DB_NAME') ?: '')) exit(1);

require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../models/review-model.php';
require_once __DIR__ . '/../services/review-service.php';

$pdo = new PDO('mysql:host=127.0.0.1;port=' . getenv('DB_PORT') . ';dbname=' . getenv('DB_NAME') . ';charset=utf8mb4', 'root', '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec("SET time_zone = '+00:00'");
$model = new ReviewModel($pdo);
$service = new ReviewService($model);
$customer = ['id' => 1, 'role' => 'CUSTOMER'];
$admin = ['id' => 4, 'role' => 'ADMIN'];
$completed = $pdo->query("SELECT o.id AS order_id, oi.id AS order_item_id, pv.product_id FROM orders o JOIN order_items oi ON oi.order_id = o.id JOIN product_variants pv ON pv.id = oi.variant_id WHERE o.customer_id = 1 AND o.order_status = 'COMPLETED' AND o.is_deleted = 0 AND oi.is_deleted = 0 ORDER BY o.id, oi.id LIMIT 1")->fetch();
if (!$completed) throw new RuntimeException('A completed customer order line is required by the preceding isolated order suite.');
$age = $pdo->prepare("UPDATE order_status_history SET changed_at = UTC_TIMESTAMP() - INTERVAL 31 DAY WHERE order_id = ? AND status = 'COMPLETED'");
$age->execute([$completed['order_id']]);
$itemId = (int) $completed['order_item_id'];
$photo = '/uploads/reviews/' . str_repeat('a', 32) . '.webp';
$context = ['roomAreaM2' => 22, 'householdSize' => 3, 'usageFrequency' => 'DAILY', 'noisePerception' => 'QUIET', 'consumptionPerception' => 'AS_EXPECTED', 'cleaningEase' => 'EASY'];
$review = $service->create($customer, ['orderItemId' => $itemId, 'rating' => 5, 'content' => 'Lắp đặt thuận tiện, dùng ổn định.', 'photos' => [$photo], 'context' => $context]);
$eligible = $service->eligible($customer, ['productId' => (int) $completed['product_id']]);
$entry = array_values(array_filter($eligible['items'], static fn(array $row): bool => $row['orderItemId'] === $itemId))[0] ?? null;
if (!$entry || $entry['reviewId'] !== $review['id'] || $entry['followupDays'] !== [30]) throw new RuntimeException('Completed purchase review and 30-day follow-up eligibility did not match.');
$public = $service->publicList((int) $completed['product_id'], ['rating' => '5']);
if (($public['items'][0]['photos'] ?? []) !== [$photo] || array_key_exists('customerId', $public['items'][0] ?? [])) throw new RuntimeException('Public review photo/privacy response mismatch.');
$service->createFollowup($customer, $review['id'], ['milestoneDays' => 30, 'context' => $context]);
try {
    $service->createFollowup($customer, $review['id'], ['milestoneDays' => 30, 'context' => $context]);
    throw new RuntimeException('Duplicate 30-day reflection was accepted.');
} catch (ApiException $error) {
    if ($error->status !== 409) throw $error;
}
$pdo->prepare("UPDATE order_status_history SET changed_at = UTC_TIMESTAMP() - INTERVAL 90 DAY WHERE order_id = ? AND status = 'COMPLETED'")->execute([$completed['order_id']]);
$eligible = $service->eligible($customer, ['productId' => (int) $completed['product_id']]);
$entry = array_values(array_filter($eligible['items'], static fn(array $row): bool => $row['orderItemId'] === $itemId))[0] ?? null;
if (!$entry || $entry['followupDays'] !== [90]) throw new RuntimeException('90-day reflection did not open at its milestone.');
$service->createFollowup($customer, $review['id'], ['milestoneDays' => 90, 'context' => $context]);
$before = $pdo->query('SELECT rating, content FROM product_reviews WHERE id = ' . (int) $review['id'])->fetch();
$service->setVisibility($admin, $review['id'], ['isVisible' => false, 'reason' => 'Ẩn trong bài kiểm tra cô lập.']);
$hidden = $service->publicList((int) $completed['product_id'], ['rating' => '5']);
$adminRows = $service->adminList(['visibility' => 'hidden'], 1, 20);
if ((int) $before['rating'] !== 5 || $before['content'] !== 'Lắp đặt thuận tiện, dùng ổn định.' || $hidden['pagination']['total'] !== 0 || ($adminRows['items'][0]['isVisible'] ?? true)) throw new RuntimeException('Hide must preserve content and remove the review from public results.');
$service->setVisibility($admin, $review['id'], ['isVisible' => true, 'reason' => 'Khôi phục trong bài kiểm tra cô lập.']);
$restored = $service->publicList((int) $completed['product_id'], ['rating' => '5']);
if ($restored['pagination']['total'] !== 1 || count($restored['items'][0]['followups']) !== 2 || (int) $pdo->query("SELECT COUNT(*) FROM audit_logs WHERE entity_type = 'product_review' AND entity_id = " . (int) $review['id'])->fetchColumn() !== 2) throw new RuntimeException('Restore, immutable follow-ups or moderation audit failed.');
echo "PASS: isolated MySQL review eligibility, 30/90-day reflections, photos, visibility and audit.\n";
