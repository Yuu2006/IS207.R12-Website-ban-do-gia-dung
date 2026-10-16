<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../middleware/role-middleware.php';
require_once __DIR__ . '/../middleware/validation-middleware.php';

// Kiểm tra guard và validation thuần, không cần DB. Luồng MySQL/HTTP: scripts/auth-profile-api.test.mjs.
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
    $principal = fakePrincipal('1', $role);
    if ($role === $allowed) check(requireRole($principal, [$allowed])['role'] === $role, 'Allowed role rejected');
    else rejects(fn () => requireRole($principal, [$allowed]), 403);
}
rejects(fn () => requireRole(null, AUTH_ROLES), 401);
rejects(fn () => requireRole(array_merge(fakePrincipal('1', 'CUSTOMER'), ['expiresAt' => time() - 1]), AUTH_ROLES), 401);
rejects(fn () => requireRole(fakePrincipal('1', 'TECHNICIAN'), AUTH_ROLES), 403);
rejects(fn () => requireRole(array_merge(fakePrincipal('1', 'CUSTOMER'), ['status' => 'DISABLED']), AUTH_ROLES), 401);
$_SESSION = [];
rejects(fn () => requireAdmin(), 401);
$_SESSION['principal'] = fakePrincipal('2', 'SALES');
rejects(fn () => requireAdmin(), 403);
$_SESSION['principal'] = fakePrincipal('3', 'ADMIN');
check(requireAdmin()['id'] === '3', 'Admin guard failed');

$valid = ['fullName' => 'Khách mới', 'email' => ' New@Example.TEST ', 'phone' => '+84 901 234 567', 'password' => 'abcdefg1'];
$result = validateRegistration($valid);
check($result['email'] === 'new@example.test' && $result['phone'] === '0901234567', 'Registration normalization failed');
rejects(fn () => validateRegistration($valid + ['role' => 'ADMIN']), 422);
foreach (['abc1', 'abcdefgh', '12345678', str_repeat('a1', 101)] as $password) rejects(fn () => validateRegistration(array_merge($valid, ['password' => $password])), 422);
rejects(fn () => validateRegistration(array_merge($valid, ['email' => 'x@'])), 422);
check(validateRegistration(array_merge($valid, ['phone' => '']))['phone'] === '', 'Optional phone rejected');

$current = ['fullName' => 'A', 'phone' => '', 'birthDate' => ''];
rejects(fn () => validateProfile(['email' => 'admin@example.test'], $current), 422);
rejects(fn () => validateProfile(['birthDate' => '2000-02-30'], $current), 422);
rejects(fn () => validateProfile(['birthDate' => (new DateTimeImmutable('tomorrow'))->format('Y-m-d')], $current), 422);
check(validateProfile(['birthDate' => '2000-02-29'], $current)['birthDate'] === '2000-02-29', 'Leap day rejected');

$address = ['recipientName' => 'Khách demo', 'phone' => '0901234567', 'addressLine' => '12 Đường thử', 'province' => 'Hà Nội', 'isDefault' => false];
check(validateAddress($address)['district'] === '', 'Address defaults failed');
rejects(fn () => validateAddress($address + ['userId' => '9']), 422);
rejects(fn () => validateAddress(array_merge($address, ['isDefault' => 'true'])), 422);
echo "PASS: $checks auth guard/validation checks\n";
