<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

// Read only database settings from the root .env; inherited process variables take precedence.
$envFile = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env';
$allowedSettings = ['ORDER_STORAGE_MODE', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
if (is_file($envFile)) {
    foreach (file($envFile, FILE_IGNORE_NEW_LINES) ?: [] as $line) {
        if (!preg_match('/^\s*([A-Z_]+)\s*=(.*)$/', $line, $matches)) continue;
        $key = $matches[1];
        if (!in_array($key, $allowedSettings, true) || getenv($key) !== false) continue;
        $value = trim($matches[2]);
        if (strlen($value) >= 2 && (($value[0] === '"' && $value[-1] === '"') || ($value[0] === "'" && $value[-1] === "'"))) $value = substr($value, 1, -1);
        putenv($key . '=' . $value);
    }
}

if (getenv('ORDER_STORAGE_MODE') !== 'mysql') { fwrite(STDERR, "ORDER_STORAGE_MODE=mysql required\n"); exit(1); }
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../models/notification-model.php';

$model = new NotificationModel(db());
$created = ['care' => 0, 'warranty' => 0];
$processed = 0;
$maximum = 10000;

// Drain bounded batches; the unique recipient/event key makes parallel and repeated runs safe.
while ($processed < $maximum) {
    $limit = min(500, $maximum - $processed);
    $care = $model->pendingCareReminders($limit);
    $warranties = $model->pendingWarrantyReminders($limit);
    if (!$care && !$warranties) break;

    foreach ($care as $item) {
        $dueDate = (new DateTimeImmutable($item['due_date'], new DateTimeZone('UTC')))->format('d/m/Y');
        $inserted = $model->create((int) $item['recipient_id'], $item['event_key'], 'CARE', 'Đã đến kỳ bảo trì thiết bị', $item['product_name_snapshot'] . ' có lịch bảo trì vào ' . $dueDate . '.', '/customer/devices');
        $created['care'] += (int) $inserted;
        $processed++;
    }
    foreach ($warranties as $item) {
        $expiry = (new DateTimeImmutable($item['expires_on'], new DateTimeZone('UTC')))->format('d/m/Y');
        $inserted = $model->create((int) $item['recipient_id'], $item['event_key'], 'WARRANTY', 'Bảo hành sắp hết hạn', $item['product_name_snapshot'] . ' dự kiến hết hạn bảo hành ngày ' . $expiry . '.', '/customer/devices');
        $created['warranty'] += (int) $inserted;
        $processed++;
    }
}

echo 'Care reminders created: ' . $created['care'] . PHP_EOL;
echo 'Warranty reminders created: ' . $created['warranty'] . PHP_EOL;
if ($processed >= $maximum) fwrite(STDERR, "Batch cap reached; schedule another run to continue.\n");
