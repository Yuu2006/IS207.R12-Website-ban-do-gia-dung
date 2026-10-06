<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../services/auth-service.php';
require_once __DIR__ . '/../services/user-service.php';

// Kiểm tra trực tiếp guard với principal giả cùng bất biến mock service, không cần DB.
$checks = 0;
function check(bool $condition, string $message): void
{
    global $checks;
    if (!$condition) throw new RuntimeException($message);
    $checks++;
}
function rejects(callable $action, int $status): void
{
    try { $action(); }
    catch (ApiException $error) { check($error->status === $status, "Expected $status, got {$error->status}"); return; }
    throw new RuntimeException("Expected rejection $status");
}
function fakePrincipal(string $id, string $role): array { return ['id' => $id, 'role' => $role, 'status' => 'ACTIVE', 'expiresAt' => time() + 3600]; }

foreach (AUTH_ROLES as $role) foreach (AUTH_ROLES as $allowed) {
    $principal = fakePrincipal('demo-' . strtolower($role), $role);
    if ($role === $allowed) check(requireRole($principal, [$allowed])['role'] === $role, 'Allowed role rejected');
    else rejects(fn () => requireRole($principal, [$allowed]), 403);
}
rejects(fn () => requireRole(null, AUTH_ROLES), 401);
rejects(fn () => requireRole(array_merge(fakePrincipal('x', 'CUSTOMER'), ['expiresAt' => time() - 1]), AUTH_ROLES), 401);
rejects(fn () => requireRole(fakePrincipal('x', 'TECHNICIAN'), AUTH_ROLES), 403);
rejects(fn () => requireRole(array_merge(fakePrincipal('x', 'CUSTOMER'), ['status' => 'DISABLED']), AUTH_ROLES), 401);

$store = [];
$state = [];
$model = new UserModel($store);
$auth = new AuthService($model, $state);
$users = new UserService($model);
$customer = fakePrincipal('demo-customer', 'CUSTOMER');
foreach (['ADMIN', 'SALES', 'WAREHOUSE'] as $role) {
    $session = $auth->loginStaff(['identifier' => strtolower($role) . '@example.test', 'password' => 'Demo@1234567890!']);
    check($session['user']['role'] === $role && !isset($session['user']['passwordHash']), 'Wrong user projection');
    rejects(fn () => $users->addresses($state['principal']), 403);
}
rejects(fn () => $auth->loginStaff(['identifier' => 'admin@example.test', 'password' => 'wrong']), 401);
rejects(fn () => $auth->loginStaff(['identifier' => 'admin@example.test', 'password' => 'Demo@1234567890! ']), 401);
rejects(fn () => $auth->loginStaff(['identifier' => 'admin@example.test', 'password' => '']), 422);
rejects(fn () => $users->updateProfile($customer, ['role' => 'ADMIN']), 422);
rejects(fn () => $users->updateProfile($customer, ['fullName' => ['invalid']]), 422);
rejects(fn () => $users->updateProfile($customer, ['fullName' => '', 'phone' => '', 'email' => '']), 422);
rejects(fn () => $users->updateProfile($customer, ['email' => 'admin@example.test']), 409);
check($users->updateProfile($customer, ['fullName' => 'Tên mới'])['fullName'] === 'Tên mới', 'Profile update failed');

$valid = ['recipientName' => 'Khách demo', 'phone' => '+84 901 234 567', 'addressLine' => '12 Đường thử nghiệm', 'province' => 'TP. Hồ Chí Minh', 'isDefault' => false];
rejects(fn () => $users->saveAddress($customer, null, array_merge($valid, ['phone' => '123'])), 422);
rejects(fn () => $users->saveAddress($customer, null, array_merge($valid, ['userId' => 'demo-admin'])), 422);
rejects(fn () => $users->saveAddress($customer, null, array_merge($valid, ['isDefault' => 'true'])), 422);
$addresses = $users->saveAddress($customer, null, $valid);
$first = $addresses[0]['id'];
check($addresses[0]['isDefault'] && $addresses[0]['phone'] === '0901234567', 'First address must be default');
$addresses = $users->saveAddress($customer, null, $valid);
$second = $addresses[1]['id'];
$addresses = $users->saveAddress($customer, $second, ['isDefault' => true]);
check(count(array_filter($addresses, fn ($item) => $item['isDefault'])) === 1 && $addresses[1]['isDefault'], 'Multiple defaults');
rejects(fn () => $users->saveAddress($customer, $second, ['isDefault' => false]), 422);
$addresses = $users->deleteAddress($customer, $second);
check(count($addresses) === 1 && $addresses[0]['isDefault'], 'Default replacement failed');
$other = fakePrincipal('second-customer', 'CUSTOMER');
rejects(fn () => $users->saveAddress($other, $first, ['isDefault' => true]), 404);
rejects(fn () => $users->deleteAddress($other, $first), 404);
check($users->addresses($other) === [], 'Owner isolation failed');
check($users->deleteAddress($customer, $first) === [], 'Last address deletion failed');
rejects(fn () => $users->deleteAddress($customer, $first), 404);

$challenge = $auth->requestOtp(['flow' => 'register', 'contact' => 'new@example.test', 'fullName' => 'Khách mới']);
rejects(fn () => $auth->requestOtp(['flow' => 'register', 'contact' => 'other@example.test', 'fullName' => 'Khách mới']), 429);
rejects(fn () => $auth->verifyOtp(['challengeId' => $challenge['challengeId'], 'code' => 'bad']), 422);
$session = $auth->verifyOtp(['challengeId' => $challenge['challengeId'], 'code' => $challenge['previewCode']]);
check($session['user']['role'] === 'CUSTOMER', 'Registration elevated role');
rejects(fn () => $auth->verifyOtp(['challengeId' => $challenge['challengeId'], 'code' => $challenge['previewCode']]), 422);
rejects(fn () => $auth->requestOtp(['flow' => 'register', 'contact' => 'new@example.test', 'fullName' => 'Khách mới']), 409);
$auth->logout();
check($auth->session()['user'] === null, 'Logout retained principal');
$state['principal'] = array_merge($customer, ['expiresAt' => time() - 1]);
check($auth->session()['user'] === null, 'Expired session retained principal');

// OTP đúng sau khi hết hạn hoặc dùng hết lượt thử vẫn không được tạo phiên.
$otpState = [];
$otpAuth = new AuthService($model, $otpState);
$otp = $otpAuth->requestOtp(['flow' => 'login', 'contact' => 'customer@example.test']);
$wrongCode = $otp['previewCode'] === '000000' ? '000001' : '000000';
for ($attempt = 0; $attempt < 5; $attempt++) rejects(fn () => $otpAuth->verifyOtp(['challengeId' => $otp['challengeId'], 'code' => $wrongCode]), 422);
rejects(fn () => $otpAuth->verifyOtp(['challengeId' => $otp['challengeId'], 'code' => $otp['previewCode']]), 429);
check($otpAuth->session()['user'] === null, 'Exhausted OTP established session');
$otpState['challenge'] = ['id' => 'expired', 'code' => '123456', 'expiresAt' => time() - 1, 'attempts' => 0];
rejects(fn () => $otpAuth->verifyOtp(['challengeId' => 'expired', 'code' => '123456']), 422);
check($otpAuth->session()['user'] === null, 'Expired OTP established session');
echo "PASS: $checks auth/profile/address checks\n";
