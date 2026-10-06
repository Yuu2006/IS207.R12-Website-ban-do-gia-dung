<?php
declare(strict_types=1);
require_once __DIR__ . '/../services/user-service.php';

function userController(string $action, ?array $principal, array $input, ?string $id, UserService $service): void
{
    $data = match ($action) {
        'profile' => $service->profile($principal),
        'updateProfile' => $service->updateProfile($principal, $input),
        'addresses' => $service->addresses($principal),
        'createAddress' => $service->saveAddress($principal, null, $input),
        'updateAddress' => $service->saveAddress($principal, $id, $input),
        'deleteAddress' => $service->deleteAddress($principal, $id),
    };
    respondJson($data, 'Thành công.', $action === 'createAddress' ? 201 : 200);
}
