<?php
declare(strict_types=1);

namespace {

// Persists user-scoped inbox events with a unique recipient/event key for safe retries.
final class NotificationModel
{
    private const ALLOWED_TYPES = ['ORDER', 'RETURN', 'CARE', 'WARRANTY', 'ACCOUNT', 'SYSTEM'];
    private const ALLOWED_TARGETS = ['/orders', '/customer/devices', '/sales/orders', '/sales/returns', '/warehouse/returns', '/notifications'];

    public function __construct(private PDO $pdo) {}

    // Allow approved static internal routes and canonical customer order detail routes (/orders/{id}).
    public static function isAllowedTarget(string $targetUrl): bool
    {
        return in_array($targetUrl, self::ALLOWED_TARGETS, true)
            || preg_match('#^/orders/[1-9][0-9]{0,18}$#D', $targetUrl) === 1;
    }

    // Validate the persisted notification before it becomes a clickable inbox item.
    public static function validatePayload(int $recipientId, string $eventKey, string $type, string $title, string $message, string $targetUrl): void
    {
        $title = trim($title);
        $message = trim($message);
        if ($recipientId < 1) throw new InvalidArgumentException('Notification recipient must be a positive user id.');
        if (preg_match('/^[A-Za-z0-9][A-Za-z0-9:._-]{0,159}$/D', $eventKey) !== 1) throw new InvalidArgumentException('Notification event key is invalid.');
        if (!in_array($type, self::ALLOWED_TYPES, true)) throw new InvalidArgumentException('Notification type is not supported.');
        if ($title === '' || self::characterLength($title) > 160 || self::hasControlCharacters($title)) throw new InvalidArgumentException('Notification title is invalid.');
        if ($message === '' || self::characterLength($message) > 500 || self::hasControlCharacters($message)) throw new InvalidArgumentException('Notification message is invalid.');
        if (!self::isAllowedTarget($targetUrl)) throw new InvalidArgumentException('Notification target must be an approved internal route.');
    }

    // Duplicate event keys are an idempotent no-op; unrelated integrity errors still fail the transaction.
    public function create(int $recipientId, string $eventKey, string $type, string $title, string $message, string $targetUrl): bool
    {
        self::validatePayload($recipientId, $eventKey, $type, $title, $message, $targetUrl);
        try {
            $statement = $this->pdo->prepare('INSERT INTO notifications (recipient_id, event_key, notification_type, title, message, target_url, created_at) VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())');
            $statement->execute([$recipientId, $eventKey, $type, trim($title), trim($message), $targetUrl]);
            return true;
        } catch (PDOException $error) {
            if ($error->getCode() === '23000' && (int) ($error->errorInfo[1] ?? 0) === 1062) return false;
            throw $error;
        }
    }

    // Return only active users in one of the application's fixed staff roles.
    public function activeRecipientIds(string $role): array
    {
        if (!in_array($role, ['ADMIN', 'SALES', 'WAREHOUSE', 'CUSTOMER'], true)) throw new InvalidArgumentException('Notification recipient role is not supported.');
        $query = $this->pdo->prepare("SELECT id FROM users WHERE role = ? AND status = 'ACTIVE' AND is_deleted = 0 ORDER BY id");
        $query->execute([$role]);
        return array_map('intval', $query->fetchAll(PDO::FETCH_COLUMN));
    }

    // Count Unicode code points when mbstring is unavailable in the local PHP CLI package.
    private static function characterLength(string $value): int
    {
        if (function_exists('mb_strlen')) return mb_strlen($value, 'UTF-8');
        $count = preg_match_all('/./us', $value);
        return $count === false ? PHP_INT_MAX : $count;
    }

    private static function hasControlCharacters(string $value): bool
    {
        return preg_match('/[\x00-\x1F\x7F]/u', $value) === 1;
    }

    // Read only the authenticated recipient's inbox and unread count.
    public function page(int $userId, int $page, int $pageSize, bool $unreadOnly): array
    {
        $where = 'recipient_id = ? AND is_deleted = 0' . ($unreadOnly ? ' AND read_at IS NULL' : '');
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM notifications WHERE ' . $where);
        $count->execute([$userId]);
        $total = (int) $count->fetchColumn();
        $query = $this->pdo->prepare('SELECT id, notification_type, title, message, target_url, read_at, created_at FROM notifications WHERE ' . $where . ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?');
        $query->bindValue(1, $userId, PDO::PARAM_INT);
        $query->bindValue(2, $pageSize, PDO::PARAM_INT);
        $query->bindValue(3, ($page - 1) * $pageSize, PDO::PARAM_INT);
        $query->execute();
        $unread = $this->pdo->prepare('SELECT COUNT(*) FROM notifications WHERE recipient_id = ? AND is_deleted = 0 AND read_at IS NULL');
        $unread->execute([$userId]);
        $items = array_map(static fn (array $row): array => ['id' => (string) $row['id'], 'type' => $row['notification_type'], 'title' => $row['title'], 'message' => $row['message'], 'targetUrl' => $row['target_url'], 'readAt' => $row['read_at'], 'createdAt' => $row['created_at']], $query->fetchAll(PDO::FETCH_ASSOC));
        return ['items' => $items, 'unreadCount' => (int) $unread->fetchColumn(), 'pagination' => ['page' => $page, 'pageSize' => $pageSize, 'totalItems' => $total, 'totalPages' => (int) ceil($total / $pageSize)]];
    }

    // Query reminders from the signed-in customer's own device/care records only.
    public function dueCareTasks(int $userId): array
    {
        $query = $this->pdo->prepare("SELECT t.id, t.due_date, d.product_name_snapshot FROM care_tasks t JOIN owned_devices d ON d.id = t.owned_device_id WHERE d.customer_id = ? AND d.status = 'ACTIVE' AND t.status IN ('DUE','POSTPONED') AND t.due_date <= DATE_ADD(UTC_DATE(), INTERVAL 7 DAY) ORDER BY t.due_date, t.id LIMIT 100");
        $query->execute([$userId]);
        return $query->fetchAll(PDO::FETCH_ASSOC);
    }

    public function expiringWarranties(int $userId): array
    {
        $query = $this->pdo->prepare("SELECT id, product_name_snapshot, DATE_ADD(warranty_start_date, INTERVAL warranty_months_snapshot MONTH) AS expires_on FROM owned_devices WHERE customer_id = ? AND status = 'ACTIVE' AND warranty_start_date IS NOT NULL AND warranty_months_snapshot > 0 AND DATE_ADD(warranty_start_date, INTERVAL warranty_months_snapshot MONTH) BETWEEN UTC_DATE() AND DATE_ADD(UTC_DATE(), INTERVAL 30 DAY) ORDER BY expires_on, id LIMIT 100");
        $query->execute([$userId]);
        return $query->fetchAll(PDO::FETCH_ASSOC);
    }

    // Select reminder candidates not previously emitted; repeated scheduler runs advance through every batch.
    public function pendingCareReminders(int $limit = 500): array
    {
        $query = $this->pdo->prepare("SELECT t.id, t.due_date, d.customer_id AS recipient_id, d.product_name_snapshot, CONCAT('care:', t.id, ':due:', DATE_FORMAT(t.due_date, '%Y-%m-%d')) AS event_key FROM care_tasks t JOIN owned_devices d ON d.id = t.owned_device_id JOIN users u ON u.id = d.customer_id AND u.role = 'CUSTOMER' AND u.status = 'ACTIVE' AND u.is_deleted = 0 WHERE d.status = 'ACTIVE' AND t.status IN ('DUE','POSTPONED') AND t.due_date <= DATE_ADD(UTC_DATE(), INTERVAL 7 DAY) AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.recipient_id = d.customer_id AND n.event_key = CONCAT('care:', t.id, ':due:', DATE_FORMAT(t.due_date, '%Y-%m-%d'))) ORDER BY t.due_date, t.id LIMIT ?");
        $query->bindValue(1, max(1, min(1000, $limit)), PDO::PARAM_INT);
        $query->execute();
        return $query->fetchAll(PDO::FETCH_ASSOC);
    }

    public function pendingWarrantyReminders(int $limit = 500): array
    {
        $query = $this->pdo->prepare("SELECT d.id, d.customer_id AS recipient_id, d.product_name_snapshot, DATE_ADD(d.warranty_start_date, INTERVAL d.warranty_months_snapshot MONTH) AS expires_on, CONCAT('warranty:', d.id, ':expires:', DATE_FORMAT(DATE_ADD(d.warranty_start_date, INTERVAL d.warranty_months_snapshot MONTH), '%Y-%m-%d')) AS event_key FROM owned_devices d JOIN users u ON u.id = d.customer_id AND u.role = 'CUSTOMER' AND u.status = 'ACTIVE' AND u.is_deleted = 0 WHERE d.status = 'ACTIVE' AND d.warranty_start_date IS NOT NULL AND d.warranty_months_snapshot > 0 AND DATE_ADD(d.warranty_start_date, INTERVAL d.warranty_months_snapshot MONTH) BETWEEN UTC_DATE() AND DATE_ADD(UTC_DATE(), INTERVAL 30 DAY) AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.recipient_id = d.customer_id AND n.event_key = CONCAT('warranty:', d.id, ':expires:', DATE_FORMAT(DATE_ADD(d.warranty_start_date, INTERVAL d.warranty_months_snapshot MONTH), '%Y-%m-%d'))) ORDER BY expires_on, d.id LIMIT ?");
        $query->bindValue(1, max(1, min(1000, $limit)), PDO::PARAM_INT);
        $query->execute();
        return $query->fetchAll(PDO::FETCH_ASSOC);
    }

    // Ownership predicates make marking an unknown or another user's event indistinguishable (404).
    public function markRead(int $userId, int $notificationId): ?array
    {
        $this->pdo->prepare('UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE id = ? AND recipient_id = ? AND is_deleted = 0 AND read_at IS NULL')->execute([$notificationId, $userId]);
        $query = $this->pdo->prepare('SELECT id, read_at FROM notifications WHERE id = ? AND recipient_id = ? AND is_deleted = 0');
        $query->execute([$notificationId, $userId]);
        $row = $query->fetch(PDO::FETCH_ASSOC);
        return $row ? ['id' => (string) $row['id'], 'readAt' => $row['read_at']] : null;
    }

    public function markAllRead(int $userId): int
    {
        $query = $this->pdo->prepare('UPDATE notifications SET read_at = UTC_TIMESTAMP() WHERE recipient_id = ? AND is_deleted = 0 AND read_at IS NULL');
        $query->execute([$userId]);
        return $query->rowCount();
    }
}

}
