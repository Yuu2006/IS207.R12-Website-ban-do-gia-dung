<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../services/fit-rule-service.php';

// Giới hạn body và chỉ nhận JSON object; service kiểm tra quyền trường và metadata.
function fitRuleInput(): array
{
    $raw = file_get_contents('php://input', false, null, 0, 16385);
    if ($raw === false || strlen($raw) > 16384) throw new ApiException('Request quá lớn.', 413);
    try { $decoded = json_decode($raw, false, 32, JSON_THROW_ON_ERROR); }
    catch (JsonException) { throw new ApiException('JSON chưa hợp lệ.', 400); }
    if (!$decoded instanceof stdClass) throw new ApiException('Request phải là JSON object.', 422);
    return get_object_vars($decoded);
}

function fitRuleQueryId(string $key): ?int
{
    if (!isset($_GET[$key]) || $_GET[$key] === '') return null;
    $id = filter_var($_GET[$key], FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
    if ($id === false) throw new ApiException("$key phải là ID số nguyên dương.", 422);
    return $id;
}

// ADMIN đọc/cập nhật quy tắc; actor lấy từ phiên, không nhận updatedBy từ client.
function fitRuleController(string $action, int $id, array $actor): void
{
    $service = new FitRuleService(new FitRuleModel(db()));
    $data = match ($action) {
        'options' => $service->options(fitRuleQueryId('categoryId')),
        'list' => $service->list(fitRuleQueryId('categoryId'), fitRuleQueryId('productId'), $_GET['status'] ?? null, fitRuleQueryId('page') ?? 1),
        'get' => $service->get($id),
        'versions' => $service->versions($id),
        'create' => $service->create(fitRuleInput(), (int) $actor['id']),
        'update' => $service->update($id, fitRuleInput(), (int) $actor['id']),
        'deactivate' => $service->deactivate($id, (int) $actor['id']),
    };
    respondJson($data, 'Thành công.', $action === 'create' ? 201 : 200);
}
