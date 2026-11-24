<?php
declare(strict_types=1);
require_once __DIR__ . '/../services/installation-checklist-service.php';

// Input is already bounded and session/CSRF checked by the shared catalog router.
function installationChecklistController(string $method, array $actor, array $input): void
{
    $service = new InstallationChecklistService(new InstallationChecklistModel(db()));
    respondJson($method === 'GET' ? $service->get($actor, $input) : $service->save($actor, $input), $method === 'GET' ? 'Đã tải checklist giao/lắp.' : 'Đã lưu checklist giao/lắp.');
}
