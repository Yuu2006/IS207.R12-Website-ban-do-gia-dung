<?php
declare(strict_types=1);

// Chỉ chạy trên database cô lập do runner tạo, tuyệt đối không nhận DB đồ án.
if (getenv('DB_NAME') !== 'fit_rule_isolated') throw new RuntimeException('Chỉ chạy trên fit_rule_isolated.');
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../services/fit-rule-service.php';
require_once __DIR__ . '/../middleware/role-middleware.php';
require_once __DIR__ . '/../routes/fit-rule-routes.php';

$catalogSeed = (string) file_get_contents(__DIR__ . '/../db/seeds/003_catalog_appliances.sql');
preg_match_all("/INSERT INTO product_attributes[^;]*?SELECT c\.id, '[^']*', '([^']+)', '(number|boolean)', (NULL|'[^']+')/u", $catalogSeed, $specRows, PREG_SET_ORDER);
expectFit(count($specRows) >= 12, 'TV4 catalog seed fields could not be read');
foreach ($specRows as $row) {
    $expected = specFieldMap()[$row[1]] ?? null;
    $catalogUnit = $row[3] === 'NULL' ? null : trim($row[3], "'");
    expectFit($expected && $expected['type'] === $row[2] && $expected['catalogUnit'] === $catalogUnit, "Spec mismatch for {$row[1]}");
}

function expectFit(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

function expectApiError(callable $run, int $status): void
{
    try { $run(); }
    catch (ApiException $error) { expectFit($error->status === $status, "HTTP {$error->status}, expected $status"); return; }
    throw new RuntimeException("Expected HTTP $status");
}

$pdo = db();
$baseline = $pdo->query("SELECT action, version, snapshot FROM fit_rule_versions WHERE rule_id = 1")->fetch();
expectFit($baseline && $baseline['action'] === 'BASELINE' && (int) $baseline['version'] === 1, 'Existing rule was not backfilled');
expectFit(json_decode($baseline['snapshot'], true)['rule_key'] === 'existing_width', 'Backfill snapshot incorrect');
$pdo->exec("INSERT INTO users (full_name, email, password_hash, role) VALUES ('Rule Admin', 'rule-admin@example.test', 'test', 'ADMIN')");
$actor = (int) $pdo->lastInsertId();
$pdo->exec("INSERT INTO categories (name, slug) VALUES ('Tủ lạnh test', 'tu-lanh-test')");
$category = (int) $pdo->lastInsertId();
$pdo->exec("INSERT INTO brands (name) VALUES ('Brand test')");
$brand = (int) $pdo->lastInsertId();
$productInsert = $pdo->prepare("INSERT INTO products (category_id, brand_id, product_code, name, slug) VALUES (?, ?, 'RULE-TEST', 'Tủ lạnh test', 'rule-test')");
$productInsert->execute([$category, $brand]);
$product = (int) $pdo->lastInsertId();
$attribute = $pdo->prepare("INSERT INTO product_attributes (category_id, name, attribute_key, data_type, unit) VALUES (?, 'Chiều rộng', 'width_mm', 'number', 'mm')");
$attribute->execute([$category]);
$model = new FitRuleModel($pdo);
$service = new FitRuleService($model);

$input = [
    'categoryId' => $category, 'productId' => null, 'ruleKey' => 'width_clearance', 'title' => 'Chiều rộng',
    'leftSource' => 'PRODUCT_ATTRIBUTE', 'leftKey' => 'width_mm', 'operator' => 'LTE',
    'rightSource' => 'ROOM_FIELD', 'rightKey' => 'placement_width_mm', 'rightValue' => null,
    'marginValue' => '20', 'unit' => 'mm', 'severity' => 'BLOCK', 'status' => 'ACTIVE',
    'passMessage' => 'Vừa chỗ.', 'failMessage' => 'Không vừa.', 'missingMessage' => 'Thiếu chiều rộng.',
];
$created = $service->create($input, $actor);
expectFit($created['version'] === 1 && $created['updatedBy'] === $actor, 'Create/version/actor failed');
expectFit(str_ends_with($created['updatedAt'], 'Z'), 'Timestamp is not UTC ISO 8601');
expectFit(count($model->versions($created['id'])) === 1, 'Create audit missing');
expectApiError(fn () => $service->create($input, $actor), 409);
expectApiError(fn () => requireRole(['id' => (string) $actor, 'role' => 'CUSTOMER', 'status' => 'ACTIVE', 'expiresAt' => time() + 60], ['ADMIN']), 403);

$edited = $service->update($created['id'], [...$input, 'marginValue' => '30', 'expectedVersion' => 1], $actor);
expectFit($edited['version'] === 2 && (float) $edited['marginValue'] === 30.0, 'Update/version failed');
$versions = $model->versions($created['id']);
expectFit(count($versions) === 2, 'Update audit missing');
expectFit((float) json_decode($versions[1]['snapshot'], true)['margin_value'] === 20.0, 'Old snapshot changed');
expectFit((float) json_decode($versions[0]['snapshot'], true)['margin_value'] === 30.0, 'New snapshot incorrect');
expectApiError(fn () => $service->update($created['id'], [...$input, 'expectedVersion' => 1], $actor), 409);
expectFit(count($model->versions($created['id'])) === 2, 'Stale update added history');

expectApiError(fn () => $service->create([...$input, 'ruleKey' => 'unsafe_rule', 'leftKey' => 'width_mm + 1'], $actor), 422);
$pdo->exec("UPDATE product_attributes SET unit = 'cm' WHERE category_id = $category AND attribute_key = 'width_mm'");
expectApiError(fn () => $service->create([...$input, 'ruleKey' => 'wrong_unit'], $actor), 422);
expectFit($service->options($category)['productFields'] === [], 'Mismatched TV4 metadata was exposed');
$pdo->exec("UPDATE product_attributes SET unit = 'mm' WHERE category_id = $category AND attribute_key = 'width_mm'");
$pdo->prepare("INSERT INTO product_attributes (category_id, name, attribute_key, data_type, unit) VALUES (?, 'Diện tích', 'room_area_max_m2', 'number', 'm²')")->execute([$category]);
expectFit($service->options($category)['productFields']['room_area_max_m2']['unit'] === 'm2', 'm² was not normalized to m2');
$area = [...$input, 'ruleKey' => 'room_area', 'leftSource' => 'ROOM_FIELD', 'leftKey' => 'floor_area_m2', 'rightSource' => 'PRODUCT_ATTRIBUTE', 'rightKey' => 'room_area_max_m2', 'unit' => 'm2'];
expectApiError(fn () => $service->create($area, $actor), 422);
expectFit($service->create([...$area, 'marginValue' => '0'], $actor)['unit'] === 'm2', 'm2 rule failed');

$productRule = $service->create([...$input, 'categoryId' => null, 'productId' => $product], $actor);
expectFit($productRule['productId'] === $product, 'Product scope failed');
$disabled = $service->deactivate($created['id'], $actor);
expectFit($disabled['status'] === 'INACTIVE' && $disabled['version'] === 3, 'Deactivate/version failed');
expectFit(count($model->versions($created['id'])) === 3, 'Deactivate audit missing');
expectFit((float) json_decode($model->versions($created['id'])[2]['snapshot'], true)['margin_value'] === 20.0, 'Original history changed after deactivate');
expectFit($service->deactivate($created['id'], $actor)['version'] === 3, 'Repeated deactivate must be idempotent');

$_SESSION = [];
expectApiError(fn () => handleFitRuleRoutes('GET', '/api/admin/fit-rules'), 401);
$_SESSION['principal'] = ['id' => (string) $actor, 'role' => 'CUSTOMER', 'status' => 'ACTIVE', 'expiresAt' => time() + 60];
expectApiError(fn () => handleFitRuleRoutes('GET', '/api/admin/fit-rules'), 403);
$_SESSION['principal']['role'] = 'ADMIN';
ob_start();
expectFit(handleFitRuleRoutes('GET', '/api/admin/fit-rules'), 'Admin GET route not matched');
$response = json_decode((string) ob_get_clean(), true, 32, JSON_THROW_ON_ERROR);
expectFit($response['success'] === true && $response['data']['total'] >= 2, 'Admin GET route failed');

echo "PASS: CRUD/version/audit, immutable snapshots, role guard, stale version, unsafe key, TV4 unit, product scope\n";
