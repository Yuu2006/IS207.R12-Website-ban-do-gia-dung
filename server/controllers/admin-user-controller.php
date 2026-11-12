<?php
declare(strict_types=1);
require_once __DIR__ . '/../services/admin-user-service.php';

// Translate the matched admin-user route action into a service call and JSON response.
function adminUserController(string $action, ?array $principal, array $input, string $id, AdminUserService $service): void
{
    $data = match ($action) {
        'list' => $service->list($principal, $input),
        'create' => $service->create($principal, $input),
        'update' => $service->update($principal, $id, $input),
        'changeStatus' => $service->changeStatus($principal, $id, $input),
    };
    respondJson($data, 'Thành công.', $action === 'create' ? 201 : 200);
}
