<?php

require_once __DIR__ . '/../models/auth-model.php';
require_once __DIR__ . '/../middleware/auth-middleware.php';

function signInStaff(string $identifier, string $password): array
{
    if (trim($identifier) === '' || $password === '') {
        throw new InvalidArgumentException('Vui lòng nhập tài khoản và mật khẩu.');
    }

    $user = verifyStaffCredentials($identifier, $password);

    if ($user === null) {
        throw new RuntimeException('Thông tin đăng nhập không hợp lệ.');
    }

    startAppSession();

    // Đổi session ID sau khi xác thực để hạn chế session fixation.
    session_regenerate_id(true);

    $_SESSION['user_id'] = (int) $user['id'];

    return [
        'id' => (int) $user['id'],
        'full_name' => $user['full_name'],
        'email' => $user['email'],
        'role' => $user['role'],
    ];
}

function signOutStaff(): void
{
    startAppSession();

    $_SESSION = [];

    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();

        setcookie(session_name(), '', [
            'expires' => time() - 42000,
            'path' => $params['path'],
            'domain' => $params['domain'],
            'secure' => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => $params['samesite'] ?? 'Lax',
        ]);
    }

    session_destroy();
}
