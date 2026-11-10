<?php
declare(strict_types=1);
require_once __DIR__ . '/../models/admin-user-model.php';
require_once __DIR__ . '/../middleware/role-middleware.php';
require_once __DIR__ . '/../middleware/validation-middleware.php';

// USR-01: staff account management; all authorization and invariants are enforced here, not in React.
class AdminUserService
{
    private const ROLES = ['CUSTOMER', 'ADMIN', 'SALES', 'WAREHOUSE'];

    public function __construct(private AdminUserModel $model) {}

    // Require the fixed ADMIN role before every admin-user operation.
    private function actor(?array $principal): array
    {
        return requireRole($principal, ['ADMIN']);
    }

    // Recheck the acting administrator inside the mutation transaction.
    private function activeActor(int $id): array
    {
        $actor = $this->model->findAccount($id, true);
        if (!$actor || (int) $actor['is_deleted'] === 1 || $actor['status'] !== 'ACTIVE' || $actor['role'] !== 'ADMIN') {
            throw new ApiException('Phiên quản trị không còn hợp lệ.', 401);
        }
        return $actor;
    }

    // Reject IDs that cannot be represented safely by this PHP runtime.
    private function targetId(string $id): int
    {
        $value = filter_var($id, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($value === false) throw new ApiException('Không tìm thấy tài khoản.', 404);
        return $value;
    }

    // Normalize PDO's SQLSTATE representations before mapping duplicate fields to 409.
    private function isUniqueViolation(PDOException $error): bool
    {
        return (string) $error->getCode() === '23000' || ($error->errorInfo[0] ?? null) === '23000';
    }

    // Validate filters, fixed role/status values and bounded pagination.
    private function listFilters(array $query): array
    {
        onlyFields($query, ['q', 'role', 'status', 'page', 'perPage']);
        $errors = [];
        $q = textValue($query['q'] ?? '', 'q', 100, false, $errors);
        $role = $query['role'] ?? '';
        $status = $query['status'] ?? '';
        if (!is_string($role) || ($role !== '' && !in_array($role, self::ROLES, true))) $errors['role'] = 'Vai trò không hợp lệ.';
        if (!is_string($status) || ($status !== '' && !in_array($status, ['ACTIVE', 'DISABLED'], true))) $errors['status'] = 'Trạng thái không hợp lệ.';
        $page = $this->positiveQueryInt($query['page'] ?? '1', 'page', 1000000, $errors);
        $perPage = $this->positiveQueryInt($query['perPage'] ?? '10', 'perPage', 50, $errors);
        if ($errors) throw new ApiException('Bộ lọc tài khoản chưa hợp lệ.', 422, $errors);
        return compact('q', 'role', 'status', 'page', 'perPage');
    }

    // Parse a positive decimal query value without accepting arrays or coercion.
    private function positiveQueryInt(mixed $value, string $field, int $max, array &$errors): int
    {
        if (!is_string($value) || preg_match('/^[1-9][0-9]*$/D', $value) !== 1 || strlen($value) > 9) {
            $errors[$field] = 'Giá trị phân trang chưa hợp lệ.';
            return 1;
        }
        $integer = (int) $value;
        if ($integer > $max) { $errors[$field] = 'Giá trị phân trang vượt giới hạn.'; return 1; }
        return $integer;
    }

    // Whitelist and normalize the account identity fields shared by create and update.
    private function fields(array $input, array $current = [], bool $creating = false): array
    {
        $allowed = ['fullName', 'email', 'phone', 'role'];
        if ($creating) $allowed[] = 'password';
        onlyFields($input, $allowed);
        if (!$creating && !$input) throw new ApiException('Cần ít nhất một trường để cập nhật.', 422);

        $values = array_merge($current, $input);
        $errors = [];
        $result = [
            'fullName' => textValue($values['fullName'] ?? null, 'fullName', 150, true, $errors),
            'email' => normalizeContact(textValue($values['email'] ?? null, 'email', 255, true, $errors)),
            'phone' => phoneValue($values['phone'] ?? '', 'phone', false, $errors),
            'role' => textValue($values['role'] ?? null, 'role', 20, true, $errors),
        ];
        if (!isset($errors['email']) && !preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $result['email'])) $errors['email'] = 'Email chưa hợp lệ.';
        if (!in_array($result['role'], self::ROLES, true)) $errors['role'] = 'Vai trò không hợp lệ.';
        if ($creating) $result['password'] = passwordValue($input['password'] ?? null, 'password', $errors);
        if ($errors) throw new ApiException('Hãy kiểm tra thông tin tài khoản.', 422, $errors);
        return $result;
    }

    // Return an ADMIN-only filtered account page.
    public function list(?array $principal, array $query): array
    {
        $this->actor($principal);
        return $this->model->list($this->listFilters($query));
    }

    // Create a password-hashed account and audit it atomically.
    public function create(?array $principal, array $input): array
    {
        $actor = $this->actor($principal);
        $values = $this->fields($input, [], true);
        try {
            $id = $this->model->transaction(function () use ($actor, $values) {
                $this->activeActor((int) $actor['id']);
                $id = $this->model->create($values, password_hash($values['password'], PASSWORD_DEFAULT));
                $this->model->audit((int) $actor['id'], 'USER_CREATE', $id, ['role' => $values['role']]);
                return $id;
            });
        } catch (PDOException $error) {
            if ($this->isUniqueViolation($error)) throw new ApiException('Email hoặc số điện thoại đã được sử dụng.', 409);
            throw $error;
        }
        return $this->model->get($id) ?? throw new ApiException('Không thể tải tài khoản vừa tạo.', 500);
    }

    // Update profile/role fields while protecting the acting and final administrators.
    public function update(?array $principal, string $id, array $input): array
    {
        $actor = $this->actor($principal);
        $targetId = $this->targetId($id);
        try {
            $this->model->transaction(function () use ($actor, $targetId, $input) {
                $activeAdminIds = $this->model->activeAdminIdsForUpdate();
                $this->activeActor((int) $actor['id']);
                $current = $this->model->findAccount($targetId, true);
                if (!$current || (int) $current['is_deleted'] === 1) throw new ApiException('Không tìm thấy tài khoản.', 404);
                $values = $this->fields($input, [
                    'fullName' => $current['full_name'], 'email' => $current['email'],
                    'phone' => $current['phone'] ?? '', 'role' => $current['role'],
                ]);
                if ($targetId === (int) $actor['id'] && $values['role'] !== 'ADMIN') {
                    throw new ApiException('Không thể tự hạ quyền tài khoản quản trị đang sử dụng.', 409);
                }
                if ($current['role'] === 'ADMIN' && $current['status'] === 'ACTIVE' && $values['role'] !== 'ADMIN') {
                    if (count($activeAdminIds) <= 1) throw new ApiException('Không thể hạ quyền quản trị viên hoạt động cuối cùng.', 409);
                }
                $changed = [];
                foreach (['fullName' => 'full_name', 'email' => 'email', 'phone' => 'phone', 'role' => 'role'] as $key => $column) {
                    if (($current[$column] ?? '') !== ($values[$key] ?: null)) $changed[] = $key;
                }
                if (!$changed) return;
                $this->model->update($targetId, $values);
                $this->model->audit((int) $actor['id'], 'USER_UPDATE', $targetId, ['changedFields' => $changed, 'role' => ['from' => $current['role'], 'to' => $values['role']]]);
            });
        } catch (PDOException $error) {
            if ($this->isUniqueViolation($error)) throw new ApiException('Email hoặc số điện thoại đã được sử dụng.', 409);
            throw $error;
        }
        return $this->model->get($targetId) ?? throw new ApiException('Không tìm thấy tài khoản.', 404);
    }

    // Lock or unlock an account with a reason, audit trail and last-admin safeguards.
    public function changeStatus(?array $principal, string $id, array $input): array
    {
        $actor = $this->actor($principal);
        onlyFields($input, ['status', 'reason']);
        $errors = [];
        $status = $input['status'] ?? null;
        if (!is_string($status) || !in_array($status, ['ACTIVE', 'DISABLED'], true)) $errors['status'] = 'Trạng thái đích không hợp lệ.';
        $reason = textValue($input['reason'] ?? null, 'reason', 255, true, $errors);
        $reasonLength = preg_match_all('/./us', $reason);
        if ($reasonLength === false || $reasonLength < 3) $errors['reason'] = 'Lý do cần ít nhất 3 ký tự.';
        if ($errors) throw new ApiException('Hãy nhập trạng thái và lý do hợp lệ.', 422, $errors);

        $targetId = $this->targetId($id);
        $this->model->transaction(function () use ($actor, $targetId, $status, $reason) {
            $activeAdminIds = $this->model->activeAdminIdsForUpdate();
            $this->activeActor((int) $actor['id']);
            $current = $this->model->findAccount($targetId, true);
            if (!$current || (int) $current['is_deleted'] === 1) throw new ApiException('Không tìm thấy tài khoản.', 404);
            if ($targetId === (int) $actor['id'] && $status === 'DISABLED') throw new ApiException('Không thể tự khóa tài khoản quản trị đang sử dụng.', 409);
            if ($current['status'] === $status) throw new ApiException($status === 'DISABLED' ? 'Tài khoản đã bị khóa.' : 'Tài khoản đang hoạt động.', 409);
            if ($status === 'DISABLED' && $current['role'] === 'ADMIN' && count($activeAdminIds) <= 1) {
                throw new ApiException('Không thể khóa quản trị viên hoạt động cuối cùng.', 409);
            }
            $this->model->changeStatus($targetId, $status, (int) $actor['id'], $reason);
            $this->model->audit((int) $actor['id'], $status === 'DISABLED' ? 'USER_DISABLE' : 'USER_ENABLE', $targetId, [
                'from' => $current['status'], 'to' => $status, 'reason' => $reason,
            ]);
        });
        return $this->model->get($targetId) ?? throw new ApiException('Không tìm thấy tài khoản.', 404);
    }
}
