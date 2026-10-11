<?php

require_once __DIR__ . '/../services/auth-service.php';

function staffLogin(): void
{
    $input = json_decode(file_get_contents('php://input'), true);

    if (!is_array($input)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Dữ liệu JSON không hợp lệ.'
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    $identifier = trim((string) ($input['identifier'] ?? ''));
    $password = (string) ($input['password'] ?? '');

    try {
        $user = signInStaff($identifier, $password);

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'sessionEstablished' => true,
            'user' => $user,
            'role' => $user['role']
        ], JSON_UNESCAPED_UNICODE);
    } catch (InvalidArgumentException $e) {
        http_response_code(422);
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage()
        ], JSON_UNESCAPED_UNICODE);
    } catch (RuntimeException $e) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Thông tin đăng nhập không hợp lệ.'
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        error_log($e->getMessage());
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Lỗi máy chủ.'
        ], JSON_UNESCAPED_UNICODE);
    }
}

function staffLogout(): void
{
    signOutStaff();

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'message' => 'Đã đăng xuất.'
    ], JSON_UNESCAPED_UNICODE);
}

function staffMe(): void
{
    $user = currentAuthenticatedUser();

    if ($user === null) {
        http_response_code(401);
        echo json_encode([
            'success' => false,
            'message' => 'Vui lòng đăng nhập.'
        ], JSON_UNESCAPED_UNICODE);
        return;
    }

    http_response_code(200);
    echo json_encode([
        'success' => true,
        'user' => [
            'id' => (int) $user['id'],
            'full_name' => $user['full_name'],
            'email' => $user['email'],
            'role' => $user['role']
        ]
    ], JSON_UNESCAPED_UNICODE);
}
