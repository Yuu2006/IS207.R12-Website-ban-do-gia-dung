<?php
declare(strict_types=1);

require_once __DIR__ . '/../models/notification-model.php';

function expectInvalidNotification(array $payload, string $case): void
{
    try {
        NotificationModel::validatePayload(...$payload);
    } catch (InvalidArgumentException) {
        return;
    }
    fwrite(STDERR, "FAIL: {$case} was accepted\n");
    exit(1);
}

NotificationModel::validatePayload(7, 'order:42:created', 'ORDER', 'Đã tiếp nhận đơn hàng', 'Đơn đang chờ xác nhận.', '/orders');
NotificationModel::validatePayload(7, 'order:42:detail', 'ORDER', 'Cập nhật đơn hàng', 'Đơn đang giao.', '/orders/42');
NotificationModel::validatePayload(3, 'order:42:cancelled', 'ORDER', 'Khách hàng đã hủy đơn', 'Đơn bị hủy trước giao.', '/sales/orders');
NotificationModel::validatePayload(5, 'return:8:warehouse', 'RETURN', 'Yêu cầu trả hàng chờ kho kiểm nhận', 'Kho cần kiểm nhận hàng trả.', '/warehouse/returns');

$invalidPayload = static fn (string $eventKey, string $type, string $title, string $message, string $target): array => [7, $eventKey, $type, $title, $message, $target];
expectInvalidNotification($invalidPayload('bad key', 'ORDER', 'Tiêu đề', 'Nội dung', '/orders'), 'event key with spaces');
expectInvalidNotification($invalidPayload('order:42:created', 'UNKNOWN', 'Tiêu đề', 'Nội dung', '/orders'), 'unknown type');
expectInvalidNotification($invalidPayload('order:42:created', 'ORDER', str_repeat('a', 161), 'Nội dung', '/orders'), 'overlong title');
expectInvalidNotification($invalidPayload('order:42:created', 'ORDER', 'Tiêu đề', str_repeat('a', 501), '/orders'), 'overlong message');
expectInvalidNotification($invalidPayload('order:42:created', 'ORDER', 'Tiêu đề', "Nội\n dung", '/orders'), 'control character');
expectInvalidNotification($invalidPayload('order:42:created', 'ORDER', 'Tiêu đề', 'Nội dung', 'https://example.com'), 'external target');
expectInvalidNotification($invalidPayload('order:42:created', 'ORDER', 'Tiêu đề', 'Nội dung', '//example.com/orders'), 'protocol-relative target');
expectInvalidNotification($invalidPayload('order:42:created', 'ORDER', 'Tiêu đề', 'Nội dung', '/orders?next=https://example.com'), 'query target');
expectInvalidNotification($invalidPayload('order:42:created', 'ORDER', 'Tiêu đề', 'Nội dung', '/orders/0'), 'zero order id target');
expectInvalidNotification($invalidPayload('order:42:created', 'ORDER', 'Tiêu đề', 'Nội dung', '/orders/abc'), 'non-numeric order id target');
expectInvalidNotification($invalidPayload('order:42:created', 'ORDER', 'Tiêu đề', 'Nội dung', '/orders/42/extra'), 'nested order path target');

echo "Notification payload validation passed.\n";
