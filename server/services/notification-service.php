<?php
declare(strict_types=1);

require_once __DIR__ . '/../models/notification-model.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

// Keeps inbox ownership and pagination policy in the service, independent of controller input.
final class NotificationService
{
    public function __construct(private NotificationModel $model) {}

    // Validate bounded query parameters and always scope reads to the authenticated account.
    public function list(?array $principal, array $query): array
    {
        $actor = requireRole($principal, AUTH_ROLES);
        foreach (array_keys($query) as $key) {
            if (!in_array($key, ['page', 'pageSize', 'unreadOnly'], true)) throw new ApiException('Bộ lọc thông báo có trường không được hỗ trợ.', 422);
        }
        $page = $this->positiveInt($query['page'] ?? '1', 'page', 1000000);
        $pageSize = $this->positiveInt($query['pageSize'] ?? '20', 'pageSize', 50);
        $unreadOnly = $query['unreadOnly'] ?? 'false';
        if (!in_array($unreadOnly, ['true', 'false', '1', '0'], true)) throw new ApiException('Bộ lọc chưa đọc không hợp lệ.', 422, ['unreadOnly' => 'Chọn true hoặc false.']);
        return $this->model->page((int) $actor['id'], $page, $pageSize, in_array($unreadOnly, ['true', '1'], true));
    }

    // A missing or foreign notification returns 404 so existence is not disclosed across accounts.
    public function markRead(?array $principal, string $id): array
    {
        $actor = requireRole($principal, AUTH_ROLES);
        $notificationId = $this->positiveInt($id, 'notificationId', PHP_INT_MAX);
        $result = $this->model->markRead((int) $actor['id'], $notificationId);
        if ($result === null) throw new ApiException('Không tìm thấy thông báo.', 404);
        return $result;
    }

    // Marking the inbox read is idempotent and never affects other recipients.
    public function markAllRead(?array $principal): array
    {
        $actor = requireRole($principal, AUTH_ROLES);
        return ['updatedCount' => $this->model->markAllRead((int) $actor['id'])];
    }

    // Parse canonical positive integer strings without accepting arrays, signs or overflow.
    private function positiveInt(mixed $value, string $field, int $max): int
    {
        if ((!is_string($value) && !is_int($value)) || preg_match('/^[1-9][0-9]*$/D', (string) $value) !== 1) {
            throw new ApiException('Tham số thông báo chưa hợp lệ.', 422, [$field => 'Cần số nguyên dương.']);
        }
        $number = filter_var((string) $value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => $max]]);
        if ($number === false) throw new ApiException('Tham số thông báo vượt giới hạn.', 422, [$field => 'Giá trị vượt giới hạn.']);
        return $number;
    }
}
