<?php
declare(strict_types=1);

// Validates ownership, care-cycle mutations and ADMIN rule configuration before model calls.
final class CareService
{
    public function __construct(private CareModel $model) {}

    // Lists only devices owned by the authenticated customer and accepts bounded pagination.
    public function listOwnedDevices(array $principal, array $query): array
    {
        $this->model->requireActor($principal, ['CUSTOMER']);
        $this->onlyKeys($query, ['page', 'pageSize', 'status']);
        $page = $this->integer($query['page'] ?? 1, 'page', 1, 1000000);
        $pageSize = $this->integer($query['pageSize'] ?? 20, 'pageSize', 1, 50);
        $status = $query['status'] ?? 'ACTIVE';
        if (!in_array($status, ['ACTIVE', 'ARCHIVED'], true)) throw new ApiException('Trạng thái thiết bị không hợp lệ.', 422);
        return $this->model->ownedDevices($principal['id'], $status, $page, $pageSize);
    }

    // Reads a device by ID only after an owner-scoped database query.
    public function getOwnedDevice(array $principal, string $deviceId): array
    {
        $this->model->requireActor($principal, ['CUSTOMER']);
        return $this->model->ownedDevice($principal['id'], $this->id($deviceId, 'deviceId'));
    }

    // Allows customers to set an optional serial number and archive/unarchive their own device.
    public function updateOwnedDevice(array $principal, string $deviceId, array $input): array
    {
        $this->model->requireActor($principal, ['CUSTOMER']);
        $this->onlyKeys($input, ['serialNumber', 'status']);
        if ($input === []) throw new ApiException('Không có trường nào để cập nhật.', 422);
        $values = [];
        if (array_key_exists('serialNumber', $input)) {
            if ($input['serialNumber'] !== null && !is_string($input['serialNumber'])) throw new ApiException('Số serial không hợp lệ.', 422);
            $serial = trim((string) ($input['serialNumber'] ?? ''));
            if ($this->textLength($serial) > 100) throw new ApiException('Số serial tối đa 100 ký tự.', 422);
            $values['serialNumber'] = $serial === '' ? null : $serial;
        }
        if (array_key_exists('status', $input)) {
            if (!in_array($input['status'], ['ACTIVE', 'ARCHIVED'], true)) throw new ApiException('Trạng thái thiết bị không hợp lệ.', 422);
            $values['status'] = $input['status'];
        }
        return $this->model->updateOwnedDevice($principal['id'], $this->id($deviceId, 'deviceId'), $values);
    }

    // Lists the maintenance schedule for an owned device.
    public function listOwnedCareTasks(array $principal, string $deviceId): array
    {
        $this->model->requireActor($principal, ['CUSTOMER']);
        return $this->model->ownedCareTasks($principal['id'], $this->id($deviceId, 'deviceId'));
    }

    // Marks the current cycle done and relies on the database transaction to create its successor once.
    public function completeCareTask(array $principal, string $taskId): array
    {
        $this->model->requireActor($principal, ['CUSTOMER']);
        return $this->model->completeCareTask($principal['id'], $principal['id'], $this->id($taskId, 'taskId'));
    }

    // Postponement preserves the original due date and requires a future date and a short reason.
    public function postponeCareTask(array $principal, string $taskId, array $input): array
    {
        $this->model->requireActor($principal, ['CUSTOMER']);
        $this->onlyKeys($input, ['newDueDate', 'reason']);
        $date = $input['newDueDate'] ?? null;
        if (!is_string($date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date)) throw new ApiException('Ngày hoãn phải có định dạng YYYY-MM-DD.', 422);
        $localZone = new DateTimeZone('Asia/Ho_Chi_Minh');
        $parsed = DateTimeImmutable::createFromFormat('!Y-m-d', $date, $localZone);
        if (!$parsed || $parsed->format('Y-m-d') !== $date || $date <= (new DateTimeImmutable('today', $localZone))->format('Y-m-d')) throw new ApiException('Chọn ngày hoãn trong tương lai.', 422);
        $reason = $input['reason'] ?? null;
        if (!is_string($reason) || trim($reason) === '' || $this->textLength(trim($reason)) > 255) throw new ApiException('Lý do hoãn cần từ 1 đến 255 ký tự.', 422);
        return $this->model->postponeCareTask($principal['id'], $principal['id'], $this->id($taskId, 'taskId'), $date, trim($reason));
    }

    // Lists configured schedules and linked active catalog SKUs for ADMIN.
    public function listCareRules(array $principal): array
    {
        $this->model->requireActor($principal, ['ADMIN']);
        return $this->model->careRules();
    }

    // Searches current active SKUs for the care-rule material selector.
    public function listSupplyOptions(array $principal, array $query): array
    {
        $this->model->requireActor($principal, ['ADMIN']);
        $this->onlyKeys($query, ['q']);
        $rawSearch = $query['q'] ?? '';
        if (!is_string($rawSearch)) throw new ApiException('Từ khóa tìm SKU không hợp lệ.', 422);
        $search = trim($rawSearch);
        if ($this->textLength($search) > 100) throw new ApiException('Từ khóa tối đa 100 ký tự.', 422);
        return ['items' => $this->model->careSupplyOptions($search)];
    }

    // Creates a category- or product-scoped rule with explicit cadence and active SKU links.
    public function createCareRule(array $principal, array $input): array
    {
        $this->model->requireActor($principal, ['ADMIN']);
        try { return $this->model->createCareRule($this->careRuleInput($input), $principal['id']); }
        catch (PDOException $error) {
            if ($error->getCode() === '23000') throw new ApiException('Mã quy tắc đã tồn tại trong phạm vi này hoặc dữ liệu tham chiếu vừa thay đổi.', 409);
            throw $error;
        }
    }

    // Updates a rule in place; existing generated cycles keep their due dates.
    public function updateCareRule(array $principal, string $ruleId, array $input): array
    {
        $this->model->requireActor($principal, ['ADMIN']);
        try { return $this->model->updateCareRule($this->id($ruleId, 'ruleId'), $this->careRuleInput($input), $principal['id']); }
        catch (PDOException $error) {
            if ($error->getCode() === '23000') throw new ApiException('Mã quy tắc đã tồn tại trong phạm vi này hoặc dữ liệu tham chiếu vừa thay đổi.', 409);
            throw $error;
        }
    }

    private function careRuleInput(array $input): array
    {
        $this->onlyKeys($input, ['categoryId', 'productId', 'ruleKey', 'title', 'instructions', 'firstDueDays', 'intervalDays', 'status', 'supplyVariantIds']);
        $categoryId = $this->optionalId($input['categoryId'] ?? null, 'categoryId');
        $productId = $this->optionalId($input['productId'] ?? null, 'productId');
        if (($categoryId === null) === ($productId === null)) throw new ApiException('Chọn đúng một phạm vi: danh mục hoặc sản phẩm.', 422);

        $ruleKey = $input['ruleKey'] ?? null;
        if (!is_string($ruleKey) || preg_match('/^[a-z0-9][a-z0-9_-]{1,79}$/D', $ruleKey) !== 1) throw new ApiException('Mã quy tắc chỉ gồm chữ thường, số, gạch ngang hoặc gạch dưới.', 422);
        $title = $input['title'] ?? null;
        if (!is_string($title) || trim($title) === '' || $this->textLength(trim($title)) > 150) throw new ApiException('Tên chu kỳ cần từ 1 đến 150 ký tự.', 422);
        $instructions = $input['instructions'] ?? null;
        if (!is_string($instructions) || trim($instructions) === '' || $this->textLength(trim($instructions)) > 10000) throw new ApiException('Hướng dẫn cần từ 1 đến 10.000 ký tự.', 422);
        $status = $input['status'] ?? 'ACTIVE';
        if (!in_array($status, ['ACTIVE', 'INACTIVE'], true)) throw new ApiException('Trạng thái quy tắc không hợp lệ.', 422);

        $supplyIds = $input['supplyVariantIds'] ?? [];
        if (!is_array($supplyIds) || !array_is_list($supplyIds) || count($supplyIds) > 10) throw new ApiException('Chọn tối đa 10 SKU vật tư.', 422);
        $supplyIds = array_map(fn ($id): string => $this->id($id, 'supplyVariantIds'), $supplyIds);
        if (count(array_unique($supplyIds)) !== count($supplyIds)) throw new ApiException('SKU vật tư không được lặp.', 422);

        return [
            'categoryId' => $categoryId, 'productId' => $productId,
            'ruleKey' => $ruleKey, 'title' => trim($title), 'instructions' => trim($instructions),
            'firstDueDays' => $this->integer($input['firstDueDays'] ?? null, 'firstDueDays', 1, 3650),
            'intervalDays' => $this->integer($input['intervalDays'] ?? null, 'intervalDays', 1, 3650),
            'status' => $status, 'supplyVariantIds' => $supplyIds,
        ];
    }

    private function onlyKeys(array $input, array $allowed): void
    {
        foreach (array_keys($input) as $key) if (!in_array($key, $allowed, true)) throw new ApiException('Request chứa trường không được hỗ trợ.', 422);
    }

    private function optionalId(mixed $value, string $field): ?string
    {
        if ($value === null || $value === '') return null;
        return $this->id($value, $field);
    }

    private function id(mixed $value, string $field): string
    {
        if (!is_string($value) && !is_int($value)) throw new ApiException('ID không hợp lệ.', 422, [$field => 'ID không hợp lệ.']);
        $id = (string) $value;
        if (preg_match('/^[1-9][0-9]{0,19}$/D', $id) !== 1 || (strlen($id) === 20 && strcmp($id, '18446744073709551615') > 0)) throw new ApiException('ID không hợp lệ.', 422, [$field => 'ID không hợp lệ.']);
        return $id;
    }

    private function integer(mixed $value, string $field, int $minimum, int $maximum): int
    {
        if (filter_var($value, FILTER_VALIDATE_INT) === false || (int) $value < $minimum || (int) $value > $maximum) throw new ApiException('Giá trị số không hợp lệ.', 422, [$field => 'Giá trị nằm ngoài giới hạn.']);
        return (int) $value;
    }

    // Count Unicode code points without requiring the optional mbstring extension.
    private function textLength(string $value): int
    {
        $length = preg_match_all('/./us', $value);
        return $length === false ? PHP_INT_MAX : $length;
    }
}
