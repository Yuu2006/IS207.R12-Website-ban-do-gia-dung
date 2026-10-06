<?php
declare(strict_types=1);
require_once __DIR__ . '/../models/user-model.php';
require_once __DIR__ . '/../middleware/role-middleware.php';
require_once __DIR__ . '/../middleware/validation-middleware.php';

class UserService
{
    public function __construct(private UserModel $model) {}

    // Bảo vệ hồ sơ tự quản lý, không nhận user ID từ request làm chủ sở hữu.
    public function profile(?array $principal): array
    {
        $principal = requireRole($principal, AUTH_ROLES);
        $user = $this->model->findUser($principal['id']);
        if (!$user || $user['status'] !== 'ACTIVE') throw new ApiException('Tài khoản không còn khả dụng.', 401);
        return UserModel::publicUser($user);
    }

    public function updateProfile(?array $principal, array $input): array
    {
        $current = $this->profile($principal);
        $values = validateProfile($input, $current);
        foreach ($this->model->users() as $user) {
            if ($user['id'] !== $current['id'] && (($values['email'] !== '' && $user['email'] === $values['email']) || ($values['phone'] !== '' && $user['phone'] === $values['phone']))) throw new ApiException('Email hoặc số điện thoại đã được sử dụng.', 409);
        }
        $user = array_merge($this->model->findUser($current['id']), $values);
        $this->model->saveUser($user);
        return UserModel::publicUser($user);
    }

    public function addresses(?array $principal): array
    {
        $principal = requireRole($principal, ['CUSTOMER']);
        return array_map(function ($address) { unset($address['userId'], $address['isDeleted']); return $address; }, $this->model->addresses($principal['id']));
    }

    // Mặc định duy nhất: địa chỉ đầu tiên luôn mặc định, đổi mặc định bỏ cờ cũ.
    public function saveAddress(?array $principal, ?string $id, array $input): array
    {
        $principal = requireRole($principal, ['CUSTOMER']);
        $addresses = $this->model->addresses($principal['id']);
        $index = null;
        foreach ($addresses as $key => $address) if ($address['id'] === $id) $index = $key;
        if ($id !== null && $index === null) throw new ApiException('Không tìm thấy địa chỉ.', 404);
        $current = $index !== null ? $addresses[$index] : [];
        $values = validateAddress($input, $current);
        if (($current['isDefault'] ?? false) && !$values['isDefault']) throw new ApiException('Hãy chọn địa chỉ khác làm mặc định trước.', 422, ['isDefault' => 'Cần giữ một địa chỉ mặc định.']);
        if (!$addresses) $values['isDefault'] = true;
        if ($values['isDefault']) foreach ($addresses as &$address) $address['isDefault'] = false;
        unset($address);
        $updated = array_merge($values, ['id' => $id ?? bin2hex(random_bytes(16)), 'userId' => $principal['id'], 'isDeleted' => false]);
        if ($index !== null) $addresses[$index] = $updated;
        else $addresses[] = $updated;
        $this->model->saveAddresses($principal['id'], $addresses);
        return $this->addresses($principal);
    }

    // Xóa mềm; nếu xóa mặc định, chọn địa chỉ còn lại đầu tiên làm thay thế.
    public function deleteAddress(?array $principal, string $id): array
    {
        $principal = requireRole($principal, ['CUSTOMER']);
        $addresses = $this->model->addresses($principal['id']);
        $index = null;
        foreach ($addresses as $key => $address) if ($address['id'] === $id) $index = $key;
        if ($index === null) throw new ApiException('Không tìm thấy địa chỉ.', 404);
        $wasDefault = $addresses[$index]['isDefault'];
        $addresses[$index]['isDeleted'] = true;
        $addresses[$index]['isDefault'] = false;
        if ($wasDefault) foreach ($addresses as &$address) {
            if (!$address['isDeleted']) { $address['isDefault'] = true; break; }
        }
        unset($address);
        $this->model->saveAddresses($principal['id'], $addresses);
        return $this->addresses($principal);
    }
}
