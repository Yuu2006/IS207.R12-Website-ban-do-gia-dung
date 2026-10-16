<?php
declare(strict_types=1);

// Truy vấn users/addresses qua PDO; không xử lý HTTP hay quyền.
class UserModel
{
    private const USER_COLUMNS = 'id, full_name, email, phone, birth_date, avatar_url, password_hash, role, status, failed_login_count, locked_until';
    private const ADDRESS_COLUMNS = 'id, recipient_name, phone, address_line, province, district, ward, is_default';

    public function __construct(private PDO $pdo) {}

    // Chạy callback trong một transaction, rollback khi có lỗi.
    public function transaction(callable $work): mixed
    {
        $this->pdo->beginTransaction();
        try {
            $result = $work();
            $this->pdo->commit();
            return $result;
        } catch (Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
    }

    public function findUser(int $id, bool $lock = false): ?array
    {
        $stmt = $this->pdo->prepare('SELECT ' . self::USER_COLUMNS . ' FROM users WHERE id = ? AND is_deleted = 0' . ($lock ? ' FOR UPDATE' : ''));
        $stmt->execute([$id]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    // Email chứa @, còn lại là số điện thoại đã chuẩn hóa; cả hai đều unique.
    public function findContact(string $contact): ?array
    {
        $column = str_contains($contact, '@') ? 'email' : 'phone';
        $stmt = $this->pdo->prepare('SELECT ' . self::USER_COLUMNS . " FROM users WHERE $column = ? AND is_deleted = 0 LIMIT 1");
        $stmt->execute([$contact]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    public function createCustomer(array $values, string $passwordHash): int
    {
        $stmt = $this->pdo->prepare("INSERT INTO users (full_name, email, phone, password_hash, role, status) VALUES (?, ?, ?, ?, 'CUSTOMER', 'ACTIVE')");
        $stmt->execute([$values['fullName'], $values['email'], $values['phone'] ?: null, $passwordHash]);
        return (int) $this->pdo->lastInsertId();
    }

    public function updateProfile(int $id, array $values): void
    {
        $stmt = $this->pdo->prepare('UPDATE users SET full_name = ?, phone = ?, birth_date = ?, avatar_url = ? WHERE id = ? AND is_deleted = 0');
        $stmt->execute([$values['fullName'], $values['phone'] ?: null, $values['birthDate'] ?: null, $values['avatarUrl'] ?: null, $id]);
    }

    public function updateEmail(int $id, string $email): void
    {
        $this->pdo->prepare('UPDATE users SET email = ? WHERE id = ? AND is_deleted = 0')->execute([$email, $id]);
    }

    public function recordLoginAttempt(string $ip, ?int $userId, bool $succeeded): void
    {
        $this->pdo->prepare('INSERT INTO auth_login_attempts (ip_address, user_id, succeeded, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())')->execute([$ip, $userId, (int) $succeeded]);
    }

    // Số lần đăng nhập sai từ một IP trong 15 phút, dùng index (ip_address, created_at).
    public function recentFailedLogins(string $ip): int
    {
        $stmt = $this->pdo->prepare('SELECT COUNT(*) FROM auth_login_attempts WHERE ip_address = ? AND created_at > UTC_TIMESTAMP() - INTERVAL 15 MINUTE AND succeeded = 0');
        $stmt->execute([$ip]);
        return (int) $stmt->fetchColumn();
    }

    // Đổi hash cũng reset bộ đếm sai; phiên cũ tự hết hiệu lực vì dấu hash đổi.
    public function updatePassword(int $id, string $passwordHash): void
    {
        $this->pdo->prepare('UPDATE users SET password_hash = ?, failed_login_count = 0, locked_until = NULL WHERE id = ?')->execute([$passwordHash, $id]);
    }

    // Sai 5 lần liên tiếp khóa đăng nhập 15 phút; cập nhật có điều kiện nên request đồng thời vẫn đếm đúng.
    public function recordLoginFailure(int $id): void
    {
        $this->pdo->prepare('UPDATE users SET failed_login_count = LEAST(failed_login_count + 1, 255), locked_until = IF(failed_login_count >= 5, UTC_TIMESTAMP() + INTERVAL 15 MINUTE, locked_until) WHERE id = ?')->execute([$id]);
    }

    public function resetLoginFailures(int $id): void
    {
        $this->pdo->prepare('UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = ? AND (failed_login_count > 0 OR locked_until IS NOT NULL)')->execute([$id]);
    }

    public function addresses(int $userId): array
    {
        $stmt = $this->pdo->prepare('SELECT ' . self::ADDRESS_COLUMNS . ' FROM addresses WHERE user_id = ? AND is_deleted = 0 ORDER BY id');
        $stmt->execute([$userId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    public function insertAddress(int $userId, array $values): void
    {
        $stmt = $this->pdo->prepare('INSERT INTO addresses (user_id, recipient_name, phone, address_line, province, district, ward, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        $stmt->execute([$userId, $values['recipientName'], $values['phone'], $values['addressLine'], $values['province'], $values['district'] ?: null, $values['ward'] ?: null, (int) $values['isDefault']]);
    }

    public function updateAddress(int $userId, int $id, array $values): void
    {
        $stmt = $this->pdo->prepare('UPDATE addresses SET recipient_name = ?, phone = ?, address_line = ?, province = ?, district = ?, ward = ?, is_default = ? WHERE id = ? AND user_id = ? AND is_deleted = 0');
        $stmt->execute([$values['recipientName'], $values['phone'], $values['addressLine'], $values['province'], $values['district'] ?: null, $values['ward'] ?: null, (int) $values['isDefault'], $id, $userId]);
    }

    public function softDeleteAddress(int $userId, int $id): void
    {
        $this->pdo->prepare('UPDATE addresses SET is_deleted = 1, is_default = 0 WHERE id = ? AND user_id = ?')->execute([$id, $userId]);
    }

    public function setDefaultAddress(int $userId, ?int $id): void
    {
        $this->pdo->prepare('UPDATE addresses SET is_default = (id <=> ?) WHERE user_id = ? AND is_deleted = 0')->execute([$id, $userId]);
    }

    public static function publicUser(array $user): array
    {
        return ['id' => (string) $user['id'], 'fullName' => $user['full_name'], 'email' => $user['email'], 'phone' => $user['phone'] ?? '', 'birthDate' => $user['birth_date'] ?? '', 'avatarUrl' => $user['avatar_url'] ?? '', 'role' => $user['role']];
    }

    public static function publicAddress(array $address): array
    {
        return ['id' => (string) $address['id'], 'recipientName' => $address['recipient_name'], 'phone' => $address['phone'], 'addressLine' => $address['address_line'], 'province' => $address['province'], 'district' => $address['district'] ?? '', 'ward' => $address['ward'] ?? '', 'isDefault' => (bool) $address['is_default']];
    }
}
