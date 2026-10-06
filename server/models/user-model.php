<?php
declare(strict_types=1);

// Repository mock theo phiên PHP, không truy vấn hoặc sửa MySQL.
class UserModel
{
    private array $store;

    public function __construct(array &$store)
    {
        $this->store =& $store;
        if (!isset($this->store['users'])) {
            $this->store = ['users' => [], 'addresses' => []];
            foreach (['CUSTOMER' => 'Nguyễn Minh', 'ADMIN' => 'Quản trị viên demo', 'SALES' => 'Nhân viên bán hàng demo', 'WAREHOUSE' => 'Nhân viên kho demo'] as $role => $name) {
                $this->store['users'][] = ['id' => 'demo-' . strtolower($role), 'fullName' => $name, 'email' => strtolower($role) . '@example.test', 'phone' => $role === 'CUSTOMER' ? '0901234567' : '', 'role' => $role, 'status' => 'ACTIVE', 'passwordHash' => $role === 'CUSTOMER' ? null : password_hash('Demo@1234567890!', PASSWORD_DEFAULT)];
            }
        }
    }

    public function users(): array { return $this->store['users']; }

    public function findUser(string $id): ?array
    {
        foreach ($this->users() as $user) if ($user['id'] === $id) return $user;
        return null;
    }

    public function findContact(string $contact): ?array
    {
        foreach ($this->users() as $user) if (($user['email'] !== '' && $user['email'] === $contact) || ($user['phone'] !== '' && $user['phone'] === $contact)) return $user;
        return null;
    }

    public function saveUser(array $user): void
    {
        foreach ($this->store['users'] as $index => $current) {
            if ($current['id'] === $user['id']) { $this->store['users'][$index] = $user; return; }
        }
        $this->store['users'][] = $user;
    }

    public function addresses(string $userId): array
    {
        return array_values(array_filter($this->store['addresses'], fn ($item) => $item['userId'] === $userId && !$item['isDeleted']));
    }

    // Thay bộ địa chỉ của riêng người dùng, giữ nguyên dữ liệu của người khác.
    public function saveAddresses(string $userId, array $addresses): void
    {
        $others = array_filter($this->store['addresses'], fn ($item) => $item['userId'] !== $userId || $item['isDeleted']);
        $this->store['addresses'] = array_merge(array_values($others), $addresses);
    }

    public static function publicUser(array $user): array
    {
        return array_intersect_key($user, array_flip(['id', 'fullName', 'email', 'phone', 'role']));
    }
}
