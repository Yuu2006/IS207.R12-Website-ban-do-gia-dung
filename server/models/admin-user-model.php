<?php
declare(strict_types=1);

// Queries for administrator-managed user accounts; mutations and audit rows share a transaction.
class AdminUserModel
{
    public function __construct(private PDO $pdo) {}

    // Keep account mutation and its audit event atomic.
    public function transaction(callable $work): mixed
    {
        $this->pdo->beginTransaction();
        try {
            $result = $work();
            $this->pdo->commit();
            return $result;
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
    }

    // Fetch internal account fields needed for authorization and locked updates.
    public function findAccount(int $id, bool $lock = false): ?array
    {
        $sql = 'SELECT id, full_name, email, phone, role, status, is_deleted, admin_lock_reason FROM users WHERE id = ?';
        $stmt = $this->pdo->prepare($sql . ($lock ? ' FOR UPDATE' : ''));
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    // Lock the active-admin set so two concurrent requests cannot both remove the final administrator.
    // Lock the active-admin set in stable order for last-admin invariants.
    public function activeAdminIdsForUpdate(): array
    {
        $stmt = $this->pdo->query("SELECT id FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE' AND is_deleted = 0 ORDER BY id FOR UPDATE");
        return array_map('intval', $stmt->fetchAll(PDO::FETCH_COLUMN));
    }

    // Return a page of safe account fields with total count and last successful login.
    public function list(array $filters): array
    {
        $where = ['u.is_deleted = 0'];
        $params = [];
        if ($filters['q'] !== '') {
            $where[] = '(u.full_name LIKE ? OR u.email LIKE ? OR u.phone LIKE ?)';
            $needle = '%' . $filters['q'] . '%';
            array_push($params, $needle, $needle, $needle);
        }
        if ($filters['role'] !== '') { $where[] = 'u.role = ?'; $params[] = $filters['role']; }
        if ($filters['status'] !== '') { $where[] = 'u.status = ?'; $params[] = $filters['status']; }
        $condition = implode(' AND ', $where);

        $count = $this->pdo->prepare('SELECT COUNT(*) FROM users u WHERE ' . $condition);
        $count->execute($params);
        $total = (int) $count->fetchColumn();

        $sql = 'SELECT u.id, u.full_name, u.email, u.phone, u.role, u.status, u.created_at,
                       u.locked_until, u.admin_locked_at, u.admin_lock_reason,
                       (SELECT MAX(a.created_at) FROM auth_login_attempts a WHERE a.user_id = u.id AND a.succeeded = 1) AS last_login_at
                FROM users u WHERE ' . $condition . ' ORDER BY u.created_at DESC, u.id DESC LIMIT ? OFFSET ?';
        $stmt = $this->pdo->prepare($sql);
        foreach ($params as $index => $param) $stmt->bindValue($index + 1, $param, PDO::PARAM_STR);
        $stmt->bindValue(count($params) + 1, $filters['perPage'], PDO::PARAM_INT);
        $stmt->bindValue(count($params) + 2, ($filters['page'] - 1) * $filters['perPage'], PDO::PARAM_INT);
        $stmt->execute();

        return [
            'items' => array_map([self::class, 'publicUser'], $stmt->fetchAll(PDO::FETCH_ASSOC)),
            'pagination' => [
                'page' => $filters['page'],
                'perPage' => $filters['perPage'],
                'total' => $total,
                'totalPages' => (int) ceil($total / $filters['perPage']),
            ],
        ];
    }

    // Insert a new active account; the caller supplies a one-way password hash.
    public function create(array $values, string $passwordHash): int
    {
        $stmt = $this->pdo->prepare("INSERT INTO users (full_name, email, phone, password_hash, role, status) VALUES (?, ?, ?, ?, ?, 'ACTIVE')");
        $stmt->execute([$values['fullName'], $values['email'], $values['phone'] ?: null, $passwordHash, $values['role']]);
        return (int) $this->pdo->lastInsertId();
    }

    // Update account identity and fixed role without touching status or password.
    public function update(int $id, array $values): void
    {
        $stmt = $this->pdo->prepare('UPDATE users SET full_name = ?, email = ?, phone = ?, role = ? WHERE id = ? AND is_deleted = 0');
        $stmt->execute([$values['fullName'], $values['email'], $values['phone'] ?: null, $values['role'], $id]);
    }

    // Toggle administrator suspension metadata while keeping failed-login locks separate.
    public function changeStatus(int $id, string $status, ?int $actorId, ?string $reason): void
    {
        if ($status === 'DISABLED') {
            $sql = 'UPDATE users SET status = ?, admin_locked_at = UTC_TIMESTAMP(), admin_locked_by = ?, admin_lock_reason = ? WHERE id = ? AND is_deleted = 0';
            $this->pdo->prepare($sql)->execute([$status, $actorId, $reason, $id]);
            return;
        }
        $sql = 'UPDATE users SET status = ?, admin_locked_at = NULL, admin_locked_by = NULL, admin_lock_reason = NULL WHERE id = ? AND is_deleted = 0';
        $this->pdo->prepare($sql)->execute([$status, $id]);
    }

    // Return the public account DTO after a successful mutation.
    public function get(int $id): ?array
    {
        $stmt = $this->pdo->prepare('SELECT id, full_name, email, phone, role, status, created_at, locked_until, admin_locked_at, admin_lock_reason FROM users WHERE id = ? AND is_deleted = 0');
        $stmt->execute([$id]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        return $user ? self::publicUser($user) : null;
    }

    // Persist an audit event in the caller's transaction.
    public function audit(int $actorId, string $action, int $userId, array $details): void
    {
        $stmt = $this->pdo->prepare('INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)');
        $stmt->execute([$actorId, $action, 'user', $userId, json_encode($details, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
    }

    // Whitelist account fields so hashes and internal flags never leave the server.
    private static function publicUser(array $user): array
    {
        return [
            'id' => (string) $user['id'],
            'fullName' => $user['full_name'],
            'email' => $user['email'],
            'phone' => $user['phone'] ?? '',
            'role' => $user['role'],
            'status' => $user['status'],
            'createdAt' => $user['created_at'] ?? '',
            'lastLoginAt' => $user['last_login_at'] ?? '',
            'lockedUntil' => $user['locked_until'] ?? '',
            'adminLockedAt' => $user['admin_locked_at'] ?? '',
            'lockReason' => $user['admin_lock_reason'] ?? '',
        ];
    }
}
