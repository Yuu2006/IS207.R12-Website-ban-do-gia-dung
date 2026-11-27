<?php
declare(strict_types=1);

require_once __DIR__ . '/../services/notification-service.php';

// Convert a matched notification action into a status-aware JSON response.
function notificationController(string $action, ?array $principal, string $id, array $input, NotificationService $service): void
{
    $data = match ($action) {
        'list' => $service->list($principal, $input),
        'markRead' => $service->markRead($principal, $id),
        'markAllRead' => $service->markAllRead($principal),
    };
    respondJson($data, 'Thành công.');
}
