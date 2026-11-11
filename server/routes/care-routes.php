<?php
declare(strict_types=1);

require_once __DIR__ . '/../controllers/care-controller.php';
require_once __DIR__ . '/../models/care-model.php';
require_once __DIR__ . '/../middleware/role-middleware.php';
require_once __DIR__ . '/../config/database.php';

// Dispatches customer-owned care routes and ADMIN maintenance-rule routes with fixed role allowlists.
function handleCareRoutes(string $method, string $path): bool
{
    $action = null;
    $id = null;
    $roles = [];
    $mutating = !in_array($method, ['GET', 'HEAD'], true);

    if ($path === '/api/owned-devices' && $method === 'GET') { $action = 'listDevices'; $roles = ['CUSTOMER']; }
    elseif (preg_match('#^/api/owned-devices/(\d+)/care-tasks$#D', $path, $matches) && $method === 'GET') { $action = 'listDeviceTasks'; $id = $matches[1]; $roles = ['CUSTOMER']; }
    elseif (preg_match('#^/api/owned-devices/(\d+)$#D', $path, $matches)) {
        $id = $matches[1]; $roles = ['CUSTOMER'];
        if ($method === 'GET') $action = 'getDevice';
        elseif ($method === 'PATCH') $action = 'updateDevice';
    } elseif (preg_match('#^/api/care-tasks/(\d+)/(complete|postpone)$#D', $path, $matches) && $method === 'POST') {
        $id = $matches[1]; $action = $matches[2] === 'complete' ? 'completeTask' : 'postponeTask'; $roles = ['CUSTOMER'];
    } elseif ($path === '/api/admin/care-rules' && in_array($method, ['GET', 'POST'], true)) {
        $action = $method === 'GET' ? 'listRules' : 'createRule'; $roles = ['ADMIN'];
    } elseif (preg_match('#^/api/admin/care-rules/(\d+)$#D', $path, $matches) && $method === 'PATCH') {
        $id = $matches[1]; $action = 'updateRule'; $roles = ['ADMIN'];
    } elseif ($path === '/api/admin/care-supply-options' && $method === 'GET') {
        $action = 'listSupplyOptions'; $roles = ['ADMIN'];
    }

    if ($action === null) return false;
    $principal = requireSessionRole($roles);
    $controller = new CareController(new CareService(new CareModel(db())));
    $input = $mutating ? careRequestBody() : [];
    switch ($action) {
        case 'listDevices': $controller->listDevices($principal, $_GET); break;
        case 'getDevice': $controller->getDevice($principal, $id); break;
        case 'updateDevice': $controller->updateDevice($principal, $id, $input); break;
        case 'listDeviceTasks': $controller->listDeviceTasks($principal, $id); break;
        case 'completeTask': $controller->completeTask($principal, $id); break;
        case 'postponeTask': $controller->postponeTask($principal, $id, $input); break;
        case 'listRules': $controller->listRules($principal); break;
        case 'listSupplyOptions': $controller->listSupplyOptions($principal, $_GET); break;
        case 'createRule': $controller->createRule($principal, $input); break;
        case 'updateRule': $controller->updateRule($principal, $id, $input); break;
    }
    return true;
}

// Read one bounded JSON object after the router has enforced session, role and CSRF.
function careRequestBody(): array
{
    $contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
    if ($contentType !== 'application/json') throw new ApiException('Yêu cầu phải dùng application/json.', 415);
    $raw = file_get_contents('php://input', false, null, 0, 65537);
    if ($raw === false || strlen($raw) > 65536) throw new ApiException('Request quá lớn.', 413);
    try { $body = json_decode($raw === '' ? '{}' : $raw, false, 32, JSON_THROW_ON_ERROR); }
    catch (JsonException) { throw new ApiException('JSON chưa hợp lệ.', 400); }
    if (!$body instanceof stdClass) throw new ApiException('Request phải là JSON object.', 422);
    return get_object_vars($body);
}
