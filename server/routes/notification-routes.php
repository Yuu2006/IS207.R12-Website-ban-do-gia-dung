<?php
declare(strict_types=1);
require_once __DIR__ . '/../controllers/notification-controller.php';

// Match only the signed-in user's notification inbox endpoints.
function dispatchNotificationRoute(string $method, string $path, array $input, ?array $principal, NotificationService $service): bool
{
    $action = null;
    $id = '';
    if ($path === '/notifications') $action = ['GET' => 'list'][$method] ?? null;
    elseif ($path === '/notifications/read-all') $action = ['POST' => 'markAllRead'][$method] ?? null;
    elseif (preg_match('#^/notifications/([1-9][0-9]{0,18})/read$#D', $path, $matches)) {
        $id = $matches[1];
        $action = ['PATCH' => 'markRead'][$method] ?? null;
    } else return false;

    if ($action === null) { header('Allow: GET, PATCH, POST'); throw new ApiException('HTTP method không được hỗ trợ.', 405); }
    notificationController($action, $principal, $id, $input, $service);
    return true;
}
