<?php
declare(strict_types=1);

require_once __DIR__ . '/../services/tco-service.php';

/** Handles POST /api/tco/calculate and delegates all pricing/calculation work to the service layer. */
function calculateTcoRequest(): void
{
    $raw = file_get_contents('php://input', false, null, 0, 65537);
    if (!is_string($raw) || strlen($raw) > 65536) {
        throw new ApiException('Request quá lớn.', 413);
    }

    try {
        $input = json_decode($raw, true, 32, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new ApiException('JSON chưa hợp lệ.', 400);
    }
    if (!is_array($input) || array_is_list($input)) {
        throw new ApiException('Request phải là JSON object.', 422);
    }

    $service = new TcoService(new TcoModel(db()));
    $result = $service->calculate($input, currentPrincipal());
    respondJson($result, 'Đã tính chi phí sở hữu.');
}
