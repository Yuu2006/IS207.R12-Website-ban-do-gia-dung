<?php
declare(strict_types=1);
require_once __DIR__ . '/../models/user-model.php';
require_once __DIR__ . '/../middleware/role-middleware.php';
require_once __DIR__ . '/../middleware/validation-middleware.php';

// Đăng ký/đăng nhập email-mật khẩu (CUS-01..03); principal lưu trong PHP session.
class AuthService
{
    private const SESSION_SECONDS = 3600;
    private const STAFF_ROLES = ['ADMIN', 'SALES', 'WAREHOUSE'];
    private array $state;

    // clientIp lấy từ REMOTE_ADDR của máy chủ, không đọc X-Forwarded-For do client tự gửi.
    public function __construct(private UserModel $model, array &$state, private string $clientIp = '') { $this->state =& $state; }

    // shortcut: giới hạn theo phiên, client bỏ cookie là reset; khóa theo tài khoản trong UserModel chặn dò mật khẩu.
    private function rateLimit(string $action): void
    {
        $limit = $this->state['limits'][$action] ?? ['startedAt' => time(), 'count' => 0];
        if ($limit['startedAt'] + 60 <= time()) $limit = ['startedAt' => time(), 'count' => 0];
        $limit['count']++;
        $this->state['limits'][$action] = $limit;
        if ($limit['count'] > 10) throw new ApiException('Quá nhiều yêu cầu. Hãy thử lại sau một phút.', 429);
    }

    // Dấu của hash mật khẩu: đổi/đặt lại mật khẩu làm mọi phiên cũ hết hiệu lực.
    private static function passwordStamp(array $user): string
    {
        return substr(hash('sha256', $user['password_hash']), 0, 16);
    }

    private function establish(array $user): array
    {
        $this->state['principal'] = ['id' => (string) $user['id'], 'role' => $user['role'], 'status' => $user['status'], 'expiresAt' => time() + self::SESSION_SECONDS, 'stamp' => self::passwordStamp($user)];
        unset($this->state['reset']);
        return $this->session();
    }

    // Đối chiếu principal với MySQL mỗi request: khóa tài khoản, đổi role hay đổi mật khẩu đều hủy phiên.
    public function session(): array
    {
        $principal = $this->state['principal'] ?? null;
        $user = null;
        try {
            $principal = requireRole($principal, AUTH_ROLES);
            $user = $this->model->findUser((int) $principal['id']);
        } catch (ApiException) {}
        if (!$user || $user['status'] !== 'ACTIVE' || $user['role'] !== $principal['role'] || self::passwordStamp($user) !== ($principal['stamp'] ?? '')) {
            unset($this->state['principal']);
            return ['user' => null, 'expiresAt' => null];
        }
        return ['user' => UserModel::publicUser($user), 'expiresAt' => $principal['expiresAt'] * 1000];
    }

    // Khách đăng nhập tại /login, nhân viên tại /internal/login; sai cổng trả cùng lỗi 401 để không lộ role.
    public function login(array $input, bool $staff): array
    {
        onlyFields($input, ['identifier', 'password']);
        if (!is_string($input['identifier'] ?? null) || !is_string($input['password'] ?? null) || $input['password'] === '' || strlen($input['password']) > 200) throw new ApiException('Tài khoản và mật khẩu chưa hợp lệ.', 422);
        $this->rateLimit('login');
        // Chặn dò mật khẩu trên nhiều tài khoản từ một IP: mặc định 30 lần sai/15 phút (AUTH_IP_MAX_FAILURES cho máy test).
        if ($this->clientIp !== '' && $this->model->recentFailedLogins($this->clientIp) >= ((int) getenv('AUTH_IP_MAX_FAILURES') ?: 30)) throw new ApiException('Có quá nhiều lần đăng nhập sai từ thiết bị này. Hãy thử lại sau 15 phút.', 429);
        $user = $this->model->findContact(normalizeContact($input['identifier']));
        if ($user && $user['locked_until'] && strtotime($user['locked_until'] . ' UTC') > time()) throw new ApiException('Đăng nhập sai quá nhiều lần. Hãy thử lại sau 15 phút.', 429);
        $valid = $user && password_verify($input['password'], $user['password_hash']);
        if ($user && !$valid) $this->model->recordLoginFailure((int) $user['id']);
        $allowed = $valid && $user['status'] === 'ACTIVE' && in_array($user['role'], self::STAFF_ROLES, true) === $staff && in_array($user['role'], AUTH_ROLES, true);
        if ($this->clientIp !== '') $this->model->recordLoginAttempt($this->clientIp, $user ? (int) $user['id'] : null, $allowed);
        if (!$allowed) throw new ApiException('Tài khoản hoặc mật khẩu chưa đúng.', 401);
        $this->model->resetLoginFailures((int) $user['id']);
        if (password_needs_rehash($user['password_hash'], PASSWORD_DEFAULT)) {
            $user['password_hash'] = password_hash($input['password'], PASSWORD_DEFAULT);
            $this->model->updatePassword((int) $user['id'], $user['password_hash']);
        }
        return $this->establish($user);
    }

    // Đăng ký chỉ tạo CUSTOMER; trùng email/điện thoại do unique constraint trả 409.
    public function register(array $input): array
    {
        $values = validateRegistration($input);
        $this->rateLimit('register');
        try {
            $id = $this->model->createCustomer($values, password_hash($values['password'], PASSWORD_DEFAULT));
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') throw new ApiException('Email hoặc số điện thoại đã được đăng ký.', 409);
            throw $error;
        }
        return $this->establish($this->model->findUser($id));
    }

    public function changePassword(array $input): array
    {
        $principal = requireRole($this->state['principal'] ?? null, AUTH_ROLES);
        onlyFields($input, ['currentPassword', 'newPassword']);
        $errors = [];
        $password = passwordValue($input['newPassword'] ?? null, 'newPassword', $errors);
        if ($errors) throw new ApiException('Mật khẩu mới chưa đạt yêu cầu.', 422, $errors);
        $this->rateLimit('password');
        $user = $this->model->findUser((int) $principal['id']);
        if (!$user || !is_string($input['currentPassword'] ?? null) || !password_verify($input['currentPassword'], $user['password_hash'])) throw new ApiException('Mật khẩu hiện tại chưa đúng.', 422, ['currentPassword' => 'Mật khẩu hiện tại chưa đúng.']);
        $user['password_hash'] = password_hash($password, PASSWORD_DEFAULT);
        $this->model->updatePassword((int) $user['id'], $user['password_hash']);
        return $this->establish($user);
    }

    // CUS-03 mô phỏng: chưa có dịch vụ email nên mã chỉ hiển thị ngoài production, không bao giờ gửi đi.
    public function requestPasswordReset(array $input): array
    {
        if (getenv('APP_ENV') === 'production') throw new ApiException('Khôi phục mật khẩu qua email chưa được cấu hình.', 503);
        onlyFields($input, ['contact']);
        if (!is_string($input['contact'] ?? null)) throw new ApiException('Hãy nhập email hoặc số điện thoại.', 422);
        $this->rateLimit('reset');
        if (($this->state['reset']['sentAt'] ?? 0) + 30 > time()) throw new ApiException('Hãy chờ 30 giây trước khi yêu cầu mã mới.', 429);
        $user = $this->model->findContact(normalizeContact($input['contact']));
        if (!$user || $user['status'] !== 'ACTIVE') throw new ApiException('Không tìm thấy tài khoản đang hoạt động với thông tin này.', 404);
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $this->state['reset'] = ['id' => bin2hex(random_bytes(16)), 'userId' => (int) $user['id'], 'code' => $code, 'expiresAt' => time() + 300, 'attempts' => 0, 'token' => null, 'sentAt' => time()];
        return ['challengeId' => $this->state['reset']['id'], 'previewCode' => $code, 'retryAfterSeconds' => 30, 'expiresInSeconds' => 300, 'demo' => true];
    }

    public function verifyPasswordReset(array $input): array
    {
        onlyFields($input, ['challengeId', 'code']);
        if (!is_string($input['challengeId'] ?? null) || !is_string($input['code'] ?? null) || !preg_match('/^\d{6}$/', $input['code'])) throw new ApiException('Mã xác nhận cần có 6 chữ số.', 422);
        $reset = $this->state['reset'] ?? null;
        if (!$reset || $reset['token'] !== null || !hash_equals($reset['id'], $input['challengeId']) || $reset['expiresAt'] <= time()) throw new ApiException('Mã xác nhận đã hết hạn hoặc không còn hiệu lực.', 422);
        if (++$this->state['reset']['attempts'] > 5) { unset($this->state['reset']); throw new ApiException('Bạn đã nhập sai quá nhiều lần. Hãy yêu cầu mã mới.', 429); }
        if (!hash_equals($reset['code'], $input['code'])) throw new ApiException('Mã xác nhận chưa đúng.', 422);
        $this->state['reset']['token'] = bin2hex(random_bytes(32));
        return ['resetToken' => $this->state['reset']['token']];
    }

    // Đặt lại xong không tự đăng nhập; mọi phiên cũ của tài khoản hết hiệu lực vì hash đổi.
    public function confirmPasswordReset(array $input): array
    {
        onlyFields($input, ['resetToken', 'newPassword']);
        $reset = $this->state['reset'] ?? null;
        if (!$reset || !is_string($reset['token']) || !is_string($input['resetToken'] ?? null) || !hash_equals($reset['token'], $input['resetToken']) || $reset['expiresAt'] <= time()) throw new ApiException('Phiên đặt lại mật khẩu đã hết hạn. Hãy bắt đầu lại.', 422);
        $errors = [];
        $password = passwordValue($input['newPassword'] ?? null, 'newPassword', $errors);
        if ($errors) throw new ApiException('Mật khẩu mới chưa đạt yêu cầu.', 422, $errors);
        $this->model->updatePassword($reset['userId'], password_hash($password, PASSWORD_DEFAULT));
        unset($this->state['reset'], $this->state['principal']);
        return ['passwordChanged' => true];
    }

    // CUS-04: đổi email đăng nhập cần mật khẩu hiện tại + mã gửi tới email mới (mô phỏng: hiển thị mã, chặn ở production).
    public function requestEmailChange(array $input): array
    {
        $principal = requireRole($this->state['principal'] ?? null, AUTH_ROLES);
        if (getenv('APP_ENV') === 'production') throw new ApiException('Xác minh email chưa được cấu hình.', 503);
        onlyFields($input, ['newEmail', 'currentPassword']);
        $errors = [];
        $email = normalizeContact(textValue($input['newEmail'] ?? '', 'newEmail', 255, true, $errors));
        if (!isset($errors['newEmail']) && !preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $email)) $errors['newEmail'] = 'Email chưa hợp lệ.';
        if ($errors) throw new ApiException('Hãy kiểm tra email mới.', 422, $errors);
        $this->rateLimit('email');
        $user = $this->model->findUser((int) $principal['id']);
        if (!$user || !is_string($input['currentPassword'] ?? null) || !password_verify($input['currentPassword'], $user['password_hash'])) throw new ApiException('Mật khẩu hiện tại chưa đúng.', 422, ['currentPassword' => 'Mật khẩu hiện tại chưa đúng.']);
        if ($email === $user['email']) throw new ApiException('Email mới trùng email hiện tại.', 422, ['newEmail' => 'Email mới trùng email hiện tại.']);
        if ($this->model->findContact($email)) throw new ApiException('Email đã được sử dụng.', 409, ['newEmail' => 'Email đã được sử dụng.']);
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $this->state['emailChange'] = ['id' => bin2hex(random_bytes(16)), 'userId' => (int) $user['id'], 'email' => $email, 'code' => $code, 'expiresAt' => time() + 300, 'attempts' => 0];
        return ['challengeId' => $this->state['emailChange']['id'], 'email' => $email, 'previewCode' => $code, 'expiresInSeconds' => 300, 'demo' => true];
    }

    public function confirmEmailChange(array $input): array
    {
        $principal = requireRole($this->state['principal'] ?? null, AUTH_ROLES);
        onlyFields($input, ['challengeId', 'code']);
        if (!is_string($input['challengeId'] ?? null) || !is_string($input['code'] ?? null) || !preg_match('/^\d{6}$/', $input['code'])) throw new ApiException('Mã xác nhận cần có 6 chữ số.', 422);
        $change = $this->state['emailChange'] ?? null;
        if (!$change || $change['userId'] !== (int) $principal['id'] || !hash_equals($change['id'], $input['challengeId']) || $change['expiresAt'] <= time()) throw new ApiException('Mã xác nhận đã hết hạn hoặc không còn hiệu lực.', 422);
        if (++$this->state['emailChange']['attempts'] > 5) { unset($this->state['emailChange']); throw new ApiException('Bạn đã nhập sai quá nhiều lần. Hãy yêu cầu mã mới.', 429); }
        if (!hash_equals($change['code'], $input['code'])) throw new ApiException('Mã xác nhận chưa đúng.', 422);
        try {
            $this->model->updateEmail($change['userId'], $change['email']);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') throw new ApiException('Email đã được sử dụng.', 409);
            throw $error;
        }
        unset($this->state['emailChange']);
        return $this->session();
    }

    public function logout(): array
    {
        unset($this->state['principal'], $this->state['reset'], $this->state['emailChange']);
        return ['user' => null, 'expiresAt' => null];
    }
}
