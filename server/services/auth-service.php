<?php
declare(strict_types=1);
require_once __DIR__ . '/../models/user-model.php';
require_once __DIR__ . '/../middleware/role-middleware.php';
require_once __DIR__ . '/../middleware/validation-middleware.php';

// Auth demo chỉ được router bật khi AUTH_DEMO=true, dùng state PHP session.
class AuthService
{
    private array $state;

    public function __construct(private UserModel $model, array &$state) { $this->state =& $state; }

    // ponytail: rate limit theo phiên demo; cần bộ đếm IP/account dùng chung khi nối auth thật.
    private function rateLimit(string $action): void
    {
        $limit = $this->state['limits'][$action] ?? ['startedAt' => time(), 'count' => 0];
        if ($limit['startedAt'] + 60 <= time()) $limit = ['startedAt' => time(), 'count' => 0];
        $limit['count']++;
        $this->state['limits'][$action] = $limit;
        if ($limit['count'] > 10) throw new ApiException('Quá nhiều yêu cầu. Hãy thử lại sau một phút.', 429);
    }

    private function establish(array $user): array
    {
        $this->state['principal'] = ['id' => $user['id'], 'role' => $user['role'], 'status' => $user['status'], 'expiresAt' => time() + 3600];
        return $this->session();
    }

    public function session(): array
    {
        try { $principal = requireRole($this->state['principal'] ?? null, AUTH_ROLES); }
        catch (ApiException) { unset($this->state['principal']); return ['user' => null, 'expiresAt' => null, 'demo' => true]; }
        $user = $this->model->findUser($principal['id']);
        if (!$user || $user['status'] !== 'ACTIVE') { unset($this->state['principal']); return ['user' => null, 'expiresAt' => null, 'demo' => true]; }
        return ['user' => UserModel::publicUser($user), 'expiresAt' => $principal['expiresAt'] * 1000, 'demo' => true];
    }

    public function loginStaff(array $input): array
    {
        onlyFields($input, ['identifier', 'password']);
        if (!is_string($input['identifier'] ?? null) || !is_string($input['password'] ?? null) || $input['password'] === '' || strlen($input['password']) > 200) throw new ApiException('Tên đăng nhập và mật khẩu chưa hợp lệ.', 422);
        $this->rateLimit('login');
        $user = $this->model->findContact(normalizeContact($input['identifier']));
        if (!$user || !in_array($user['role'], ['ADMIN', 'SALES', 'WAREHOUSE'], true) || $user['status'] !== 'ACTIVE' || !password_verify($input['password'], $user['passwordHash'])) throw new ApiException('Tài khoản hoặc mật khẩu chưa đúng.', 401);
        return $this->establish($user);
    }

    public function requestOtp(array $input): array
    {
        onlyFields($input, ['flow', 'contact', 'fullName']);
        if (!in_array($input['flow'] ?? null, ['login', 'register'], true) || !is_string($input['contact'] ?? null)) throw new ApiException('Yêu cầu mã xác nhận chưa hợp lệ.', 422);
        $contact = normalizeContact($input['contact']);
        $values = validateProfile(['fullName' => $input['flow'] === 'register' ? ($input['fullName'] ?? '') : 'Demo', 'email' => str_contains($contact, '@') ? $contact : '', 'phone' => str_contains($contact, '@') ? '' : $contact]);
        $user = $this->model->findContact($contact);
        if ($input['flow'] === 'login' && (!$user || $user['role'] !== 'CUSTOMER' || $user['status'] !== 'ACTIVE')) throw new ApiException('Không có tài khoản khách hàng này trong dữ liệu demo.', 404);
        if ($input['flow'] === 'register' && $user) throw new ApiException('Email hoặc số điện thoại đã được đăng ký.', 409);
        $this->rateLimit('otp-request');
        if (($this->state['lastOtpAt'] ?? 0) + 30 > time()) throw new ApiException('Hãy chờ 30 giây trước khi yêu cầu mã mới.', 429);
        $this->state['lastOtpAt'] = time();
        $challenge = ['id' => bin2hex(random_bytes(16)), 'code' => str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT), 'expiresAt' => time() + 300, 'attempts' => 0, 'flow' => $input['flow'], 'contact' => $contact, 'values' => $values];
        $this->state['challenge'] = $challenge;
        return ['challengeId' => $challenge['id'], 'previewCode' => $challenge['code'], 'retryAfterSeconds' => 30, 'expiresInSeconds' => 300, 'demo' => true];
    }

    public function verifyOtp(array $input): array
    {
        onlyFields($input, ['challengeId', 'code']);
        if (!is_string($input['challengeId'] ?? null) || !is_string($input['code'] ?? null) || !preg_match('/^\d{6}$/', $input['code'])) throw new ApiException('Mã xác nhận cần có 6 chữ số.', 422);
        $challenge = $this->state['challenge'] ?? null;
        if (!$challenge || $challenge['id'] !== $input['challengeId'] || $challenge['expiresAt'] <= time()) throw new ApiException('Mã xác nhận đã hết hạn hoặc không còn hiệu lực.', 422);
        $this->state['challenge']['attempts']++;
        if ($this->state['challenge']['attempts'] > 5) { unset($this->state['challenge']); throw new ApiException('Bạn đã nhập sai quá nhiều lần. Hãy yêu cầu mã mới.', 429); }
        if (!hash_equals($challenge['code'], $input['code'])) throw new ApiException('Mã xác nhận chưa đúng.', 422);
        $user = $this->model->findContact($challenge['contact']);
        if ($challenge['flow'] === 'register') {
            if ($user) throw new ApiException('Thông tin liên hệ đã được đăng ký.', 409);
            $user = array_merge($challenge['values'], ['id' => bin2hex(random_bytes(16)), 'role' => 'CUSTOMER', 'status' => 'ACTIVE', 'passwordHash' => null]);
            $this->model->saveUser($user);
        }
        if (!$user || $user['role'] !== 'CUSTOMER' || $user['status'] !== 'ACTIVE') throw new ApiException('Tài khoản không còn khả dụng.', 401);
        unset($this->state['challenge']);
        return $this->establish($user);
    }

    public function logout(): array
    {
        unset($this->state['principal'], $this->state['challenge']);
        return ['user' => null, 'expiresAt' => null, 'demo' => true];
    }
}
