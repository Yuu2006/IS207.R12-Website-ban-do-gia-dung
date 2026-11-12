<?php
declare(strict_types=1);

require_once __DIR__ . '/../services/care-service.php';

// HTTP controller for the care API; all ownership and business checks stay in CareService.
final class CareController
{
    public function __construct(private CareService $service) {}

    public function listDevices(array $principal, array $query): void { respondJson($this->service->listOwnedDevices($principal, $query)); }
    public function getDevice(array $principal, string $id): void { respondJson($this->service->getOwnedDevice($principal, $id)); }
    public function updateDevice(array $principal, string $id, array $input): void { respondJson($this->service->updateOwnedDevice($principal, $id, $input)); }
    public function listDeviceTasks(array $principal, string $id): void { respondJson($this->service->listOwnedCareTasks($principal, $id)); }
    public function completeTask(array $principal, string $id): void { respondJson($this->service->completeCareTask($principal, $id), 'Đã hoàn thành chu kỳ bảo trì.'); }
    public function postponeTask(array $principal, string $id, array $input): void { respondJson($this->service->postponeCareTask($principal, $id, $input), 'Đã cập nhật ngày bảo trì.'); }
    public function listRules(array $principal): void { respondJson($this->service->listCareRules($principal)); }
    public function listSupplyOptions(array $principal, array $query): void { respondJson($this->service->listSupplyOptions($principal, $query)); }
    public function createRule(array $principal, array $input): void { respondJson($this->service->createCareRule($principal, $input), 'Đã tạo chu kỳ bảo trì.', 201); }
    public function updateRule(array $principal, string $id, array $input): void { respondJson($this->service->updateCareRule($principal, $id, $input)); }
}
