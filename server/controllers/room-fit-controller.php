<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/fit-rule-controller.php';
require_once __DIR__ . '/../services/room-fit-service.php';

// Chủ sở hữu lấy từ phiên, không nhận user ID từ client.
function roomFitController(string $action, int $id, array $actor): void
{
    $service = new RoomFitService(new RoomFitModel(db()));
    $userId = (int) $actor['id'];
    $data = match ($action) {
        'list' => $service->list($userId),
        'create' => $service->create($userId, fitRuleInput()),
        'update' => $service->update($id, $userId, fitRuleInput()),
        'delete' => $service->delete($id, $userId),
        'check' => $service->check($userId, fitRuleInput()),
    };
    respondJson($data, 'Thành công.', $action === 'create' ? 201 : 200);
}
