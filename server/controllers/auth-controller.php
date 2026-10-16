<?php
declare(strict_types=1);
require_once __DIR__ . '/../services/auth-service.php';

// Chuyển request tới service; cookie/session ID không được gửi trong JSON.
function authController(string $action, array $input, AuthService $service): void
{
    $data = match ($action) {
        'session' => $service->session(),
        'login' => $service->login($input, false),
        'loginStaff' => $service->login($input, true),
        'register' => $service->register($input),
        'changePassword' => $service->changePassword($input),
        'resetRequest' => $service->requestPasswordReset($input),
        'resetVerify' => $service->verifyPasswordReset($input),
        'resetConfirm' => $service->confirmPasswordReset($input),
        'logout' => $service->logout(),
    };
    // Đổi session ID khi quyền đăng nhập thay đổi để chống session fixation.
    if (in_array($action, ['login', 'loginStaff', 'register', 'changePassword', 'resetConfirm', 'logout'], true)) {
        session_regenerate_id(true);
        if ($action === 'logout') issueCsrfToken(true);
    }
    if (array_key_exists('user', $data)) $data['csrfToken'] = $_SESSION['csrfToken'];
    respondJson($data, 'Thành công.', $action === 'register' ? 201 : 200);
}
