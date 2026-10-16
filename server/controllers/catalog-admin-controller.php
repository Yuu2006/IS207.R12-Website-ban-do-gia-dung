<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../services/catalog-admin-service.php';

// Đọc JSON object; lỗi định dạng trả 400/422 qua ApiException để index xuất JSON thống nhất.
function catalogAdminInput(): array
{
    try { $decoded = json_decode(file_get_contents('php://input') ?: '{}', false, 32, JSON_THROW_ON_ERROR); }
    catch (JsonException) { throw new ApiException('JSON chưa hợp lệ.', 400); }
    if (!$decoded instanceof stdClass) throw new ApiException('Request phải là JSON object.', 422);
    return get_object_vars($decoded);
}

function catalogAdminController(string $action, int $id): void
{
    $service = new CatalogAdminService(new CatalogAdminModel(db()));
    $data = match ($action) {
        'variants' => $service->variants($id),
        'createVariant' => $service->createVariant($id, catalogAdminInput()),
        'updateVariant' => $service->updateVariant($id, catalogAdminInput()),
        'images' => $service->images($id),
        'addImage' => $service->addImage($id, catalogAdminInput()),
        'updateImage' => $service->updateImage($id, catalogAdminInput()),
        'deleteImage' => $service->deleteImage($id),
        'createAttribute' => $service->createAttribute($id, catalogAdminInput()),
        'banners' => $service->banners(),
    };
    respondJson($data, 'Thành công.', in_array($action, ['createVariant', 'createAttribute', 'addImage'], true) ? 201 : 200);
}
