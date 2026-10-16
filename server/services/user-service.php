<?php
declare(strict_types=1);
require_once __DIR__ . '/../models/user-model.php';
require_once __DIR__ . '/../middleware/role-middleware.php';
require_once __DIR__ . '/../middleware/validation-middleware.php';

// Hồ sơ và địa chỉ của chính principal (CUS-04, CUS-05); không nhận user ID từ request.
class UserService
{
    public function __construct(private UserModel $model) {}

    private function user(?array $principal, array $roles = AUTH_ROLES): array
    {
        $principal = requireRole($principal, $roles);
        $user = $this->model->findUser((int) $principal['id']);
        if (!$user || $user['status'] !== 'ACTIVE') throw new ApiException('Tài khoản không còn khả dụng.', 401);
        return $user;
    }

    public function profile(?array $principal): array
    {
        return UserModel::publicUser($this->user($principal));
    }

    public function updateProfile(?array $principal, array $input): array
    {
        $user = $this->user($principal);
        $values = validateProfile($input, UserModel::publicUser($user));
        try {
            $this->model->updateProfile((int) $user['id'], $values);
        } catch (PDOException $error) {
            if ($error->getCode() === '23000') throw new ApiException('Số điện thoại đã được sử dụng.', 409, ['phone' => 'Số điện thoại đã được sử dụng.']);
            throw $error;
        }
        return $this->profile($principal);
    }

    public function addresses(?array $principal): array
    {
        $user = $this->user($principal, ['CUSTOMER']);
        return array_map([UserModel::class, 'publicAddress'], $this->model->addresses((int) $user['id']));
    }

    // Khóa dòng user để các request đồng thời không tạo hai địa chỉ mặc định.
    private function mutateAddresses(?array $principal, callable $change): array
    {
        $userId = (int) $this->user($principal, ['CUSTOMER'])['id'];
        $this->model->transaction(function () use ($userId, $change) {
            $this->model->findUser($userId, true);
            $change($userId, array_map([UserModel::class, 'publicAddress'], $this->model->addresses($userId)));
        });
        return $this->addresses($principal);
    }

    private static function find(array $addresses, string $id): array
    {
        foreach ($addresses as $address) if ($address['id'] === $id) return $address;
        throw new ApiException('Không tìm thấy địa chỉ.', 404);
    }

    // Địa chỉ đầu tiên luôn mặc định; đổi mặc định bỏ cờ cũ; không tự bỏ cờ mặc định hiện tại.
    public function saveAddress(?array $principal, ?string $id, array $input): array
    {
        return $this->mutateAddresses($principal, function (int $userId, array $addresses) use ($id, $input) {
            $current = $id === null ? [] : self::find($addresses, $id);
            $values = validateAddress($input, $current);
            if (($current['isDefault'] ?? false) && !$values['isDefault']) throw new ApiException('Hãy chọn địa chỉ khác làm mặc định trước.', 422, ['isDefault' => 'Cần giữ một địa chỉ mặc định.']);
            if (!$addresses) $values['isDefault'] = true;
            if ($values['isDefault']) $this->model->setDefaultAddress($userId, null);
            if ($id === null) $this->model->insertAddress($userId, $values);
            else $this->model->updateAddress($userId, (int) $id, $values);
        });
    }

    // Xóa mềm để đơn cũ giữ tham chiếu; xóa mặc định thì địa chỉ tạo sớm nhất còn lại thành mặc định.
    public function deleteAddress(?array $principal, string $id): array
    {
        return $this->mutateAddresses($principal, function (int $userId, array $addresses) use ($id) {
            $address = self::find($addresses, $id);
            $this->model->softDeleteAddress($userId, (int) $id);
            $rest = array_values(array_filter($addresses, fn ($item) => $item['id'] !== $id));
            if ($address['isDefault'] && $rest) $this->model->setDefaultAddress($userId, (int) $rest[0]['id']);
        });
    }
}
