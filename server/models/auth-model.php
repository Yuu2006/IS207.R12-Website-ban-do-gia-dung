<?php

require_once __DIR__ . '/../config/database.php';

/**
 * Tìm tài khoản nhân viên theo email hoặc số điện thoại.
 * Không trả về tài khoản đã bị xóa hoặc vô hiệu hóa.
 */
function findActiveStaffByIdentifier(string $identifier): ?array
{
    $sql = "
        SELECT id, full_name, email, phone, password_hash, role, status
        FROM users
        WHERE (email = :email OR phone = :phone)
          AND is_deleted = 0
          AND status = 'ACTIVE'
          AND role IN ('ADMIN', 'SALES', 'WAREHOUSE', 'TECHNICIAN')
        LIMIT 1
    ";

    $stmt = db()->prepare($sql);
    $stmt->execute([
        'email' => trim($identifier),
        'phone' => trim($identifier),
    ]);

    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    return $user ?: null;
}

/**
 * Kiểm tra mật khẩu bằng password_hash đã lưu trong database.
 */
function verifyStaffCredentials(
    string $identifier,
    string $password
): ?array {
    $user = findActiveStaffByIdentifier($identifier);

    if ($user === null || !password_verify($password, $user['password_hash'])) {
        return null;
    }

    unset($user['password_hash']);

    return $user;
}
