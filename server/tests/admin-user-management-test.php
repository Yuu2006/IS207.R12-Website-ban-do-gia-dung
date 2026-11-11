<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../services/admin-user-service.php';

$checks = 0;
function checkAdmin(bool $condition, string $message): void
{
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}
function rejectsAdmin(callable $action, int $status): void
{
    try { $action(); }
    catch (ApiException $error) { checkAdmin($error->status === $status, "Expected HTTP $status, got {$error->status}"); return; }
    throw new RuntimeException("Expected HTTP $status rejection");
}
function adminPrincipal(string $id, string $role = 'ADMIN'): array
{
    return ['id' => $id, 'role' => $role, 'status' => 'ACTIVE', 'expiresAt' => time() + 3600];
}

class FakeAdminUserModel extends AdminUserModel
{
    public array $users = [];
    public array $audits = [];
    public array $createdHashes = [];
    public array $activeAdminIds = [];
    public array $lastFilters = [];
    private int $nextId = 20;

    public function __construct() {}
    public function transaction(callable $work): mixed { return $work(); }
    public function findAccount(int $id, bool $lock = false): ?array { return $this->users[$id] ?? null; }
    public function activeAdminIdsForUpdate(): array { return $this->activeAdminIds; }
    public function list(array $filters): array { $this->lastFilters = $filters; return ['items' => [], 'pagination' => ['page' => $filters['page'], 'perPage' => $filters['perPage'], 'total' => 0, 'totalPages' => 0]]; }
    public function create(array $values, string $passwordHash): int
    {
        foreach ($this->users as $user) {
            if ($user['email'] === $values['email'] || ($values['phone'] !== '' && $user['phone'] === $values['phone'])) throw new PDOException('duplicate', 23000);
        }
        $id = $this->nextId++;
        $this->createdHashes[$id] = $passwordHash;
        $this->users[$id] = ['id' => $id, 'full_name' => $values['fullName'], 'email' => $values['email'], 'phone' => $values['phone'] ?: null, 'role' => $values['role'], 'status' => 'ACTIVE', 'is_deleted' => 0, 'admin_lock_reason' => null];
        return $id;
    }
    public function update(int $id, array $values): void
    {
        $this->users[$id] = array_merge($this->users[$id], ['full_name' => $values['fullName'], 'email' => $values['email'], 'phone' => $values['phone'] ?: null, 'role' => $values['role']]);
    }
    public function changeStatus(int $id, string $status, ?int $actorId, ?string $reason): void
    {
        $this->users[$id]['status'] = $status;
        $this->users[$id]['admin_lock_reason'] = $status === 'DISABLED' ? $reason : null;
    }
    public function get(int $id): ?array
    {
        if (!isset($this->users[$id])) return null;
        $user = $this->users[$id];
        return ['id' => (string) $id, 'fullName' => $user['full_name'], 'email' => $user['email'], 'phone' => $user['phone'] ?? '', 'role' => $user['role'], 'status' => $user['status'], 'createdAt' => '', 'lastLoginAt' => '', 'lockedUntil' => '', 'adminLockedAt' => '', 'lockReason' => $user['admin_lock_reason'] ?? ''];
    }
    public function audit(int $actorId, string $action, int $userId, array $details): void { $this->audits[] = compact('actorId', 'action', 'userId', 'details'); }
}

function fixture(): array
{
    $model = new FakeAdminUserModel();
    $model->users = [
        1 => ['id' => 1, 'full_name' => 'Admin Một', 'email' => 'admin1@example.test', 'phone' => null, 'role' => 'ADMIN', 'status' => 'ACTIVE', 'is_deleted' => 0, 'admin_lock_reason' => null],
        2 => ['id' => 2, 'full_name' => 'Admin Hai', 'email' => 'admin2@example.test', 'phone' => null, 'role' => 'ADMIN', 'status' => 'ACTIVE', 'is_deleted' => 0, 'admin_lock_reason' => null],
        3 => ['id' => 3, 'full_name' => 'Khách', 'email' => 'customer@example.test', 'phone' => '0901234567', 'role' => 'CUSTOMER', 'status' => 'ACTIVE', 'is_deleted' => 0, 'admin_lock_reason' => null],
    ];
    $model->activeAdminIds = [1, 2];
    return [$model, new AdminUserService($model)];
}

[$model, $service] = fixture();
rejectsAdmin(fn () => $service->list(adminPrincipal('3', 'CUSTOMER'), []), 403);
rejectsAdmin(fn () => $service->list(null, []), 401);
$service->list(adminPrincipal('1'), ['q' => ' Minh ', 'role' => 'SALES', 'status' => 'ACTIVE', 'page' => '2', 'perPage' => '25']);
checkAdmin($model->lastFilters === ['q' => 'Minh', 'role' => 'SALES', 'status' => 'ACTIVE', 'page' => 2, 'perPage' => 25], 'List filters should be normalized and bounded');
rejectsAdmin(fn () => $service->list(adminPrincipal('1'), ['role' => 'TECHNICIAN']), 422);
rejectsAdmin(fn () => $service->list(adminPrincipal('1'), ['perPage' => '1000']), 422);

[$model, $service] = fixture();
$created = $service->create(adminPrincipal('1'), ['fullName' => ' Nhân viên mới ', 'email' => ' NEW@EXAMPLE.TEST ', 'phone' => '+84 901 234 568', 'role' => 'SALES', 'password' => 'TempPass123']);
checkAdmin($created['email'] === 'new@example.test' && $created['phone'] === '0901234568', 'Create should normalize email and phone');
checkAdmin(password_verify('TempPass123', $model->createdHashes[(int) $created['id']]), 'Create must store a password hash');
checkAdmin(!array_key_exists('password_hash', $created) && !array_key_exists('password', $created), 'Create response must not expose credentials');
checkAdmin($model->audits[0]['action'] === 'USER_CREATE' && $model->audits[0]['details']['role'] === 'SALES', 'Create should write an audit record');
rejectsAdmin(fn () => $service->create(adminPrincipal('1'), ['fullName' => 'x', 'email' => 'x@example.test', 'phone' => '', 'role' => 'TECHNICIAN', 'password' => 'TempPass123']), 422);
rejectsAdmin(fn () => $service->create(adminPrincipal('1'), ['fullName' => 'x', 'email' => 'x@example.test', 'phone' => '', 'role' => 'SALES', 'password' => 'weak']), 422);
rejectsAdmin(fn () => $service->create(adminPrincipal('1'), ['fullName' => 'x', 'email' => 'customer@example.test', 'phone' => '', 'role' => 'SALES', 'password' => 'TempPass123']), 409);

[$model, $service] = fixture();
rejectsAdmin(fn () => $service->update(adminPrincipal('1'), '1', ['role' => 'CUSTOMER']), 409);
rejectsAdmin(fn () => $service->update(adminPrincipal('1'), '3', ['status' => 'DISABLED']), 422);
$updated = $service->update(adminPrincipal('1'), '3', ['fullName' => 'Khách đã sửa', 'email' => ' CUSTOMER@EXAMPLE.TEST ']);
checkAdmin($updated['fullName'] === 'Khách đã sửa' && $updated['email'] === 'customer@example.test', 'Update should normalize editable fields');
checkAdmin($model->audits[0]['action'] === 'USER_UPDATE', 'Update should be audited');
rejectsAdmin(fn () => $service->update(adminPrincipal('1'), '99999999999999999999', ['fullName' => 'A']), 404);

[$model, $service] = fixture();
rejectsAdmin(fn () => $service->changeStatus(adminPrincipal('1'), '3', ['status' => 'DISABLED', 'reason' => 'x']), 422);
rejectsAdmin(fn () => $service->changeStatus(adminPrincipal('1'), '1', ['status' => 'DISABLED', 'reason' => 'Self lock']), 409);
$disabled = $service->changeStatus(adminPrincipal('1'), '3', ['status' => 'DISABLED', 'reason' => 'Vi phạm chính sách']);
checkAdmin($disabled['status'] === 'DISABLED' && $disabled['lockReason'] === 'Vi phạm chính sách', 'Disable should persist a reason');
checkAdmin($model->audits[0]['action'] === 'USER_DISABLE', 'Disable should be audited');
rejectsAdmin(fn () => $service->changeStatus(adminPrincipal('1'), '3', ['status' => 'DISABLED', 'reason' => 'Lặp lại']), 409);
$enabled = $service->changeStatus(adminPrincipal('1'), '3', ['status' => 'ACTIVE', 'reason' => 'Đã xác minh lại']);
checkAdmin($enabled['status'] === 'ACTIVE' && $enabled['lockReason'] === '', 'Enable should clear current lock metadata');
checkAdmin($model->audits[1]['action'] === 'USER_ENABLE', 'Enable should be audited');

[$model, $service] = fixture();
$model->activeAdminIds = [1];
rejectsAdmin(fn () => $service->changeStatus(adminPrincipal('2'), '1', ['status' => 'DISABLED', 'reason' => 'Kiểm tra cuối admin']), 409);
rejectsAdmin(fn () => $service->update(adminPrincipal('2'), '1', ['role' => 'SALES']), 409);

echo "PASS: $checks admin user-management policy checks\n";
