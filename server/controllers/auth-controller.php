<?php
declare(strict_types=1);
require_once __DIR__ . '/../services/auth-service.php';

// Chuyển request tới service; cookie/session ID không được gửi trong JSON.
function authController(string $action, array $input, AuthService $service): void
{
    $data = match ($action) {
        'session' => $service->session(),
        'loginStaff' => $service->loginStaff($input),
        'requestOtp' => $service->requestOtp($input),
        'verifyOtp' => $service->verifyOtp($input),
        'logout' => $service->logout(),
    };
    if (in_array($action, ['loginStaff', 'verifyOtp', 'logout'], true)) session_regenerate_id(true);
    if ($action === 'logout') $_SESSION['csrfToken'] = bin2hex(random_bytes(32));
    if (in_array($action, ['session', 'loginStaff', 'verifyOtp', 'logout'], true)) $data['csrfToken'] = $_SESSION['csrfToken'];
    respondJson($data);
}
