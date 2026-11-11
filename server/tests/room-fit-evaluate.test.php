<?php
declare(strict_types=1);

// FIT-01 evaluator là hàm thuần nên chạy không cần DB: php server/tests/room-fit-evaluate.test.php
require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../services/room-fit-service.php';

function fitRule(array $overrides = []): array
{
    return $overrides + [
        'id' => 1, 'version' => 1, 'category_id' => 2, 'product_id' => null, 'rule_key' => 'fit_width', 'title' => 'Chiều rộng',
        'left_source' => 'PRODUCT_ATTRIBUTE', 'left_key' => 'width_mm', 'operator' => 'LTE',
        'right_source' => 'ROOM_FIELD', 'right_key' => 'placement_width_mm', 'right_value' => null,
        'margin_value' => '20.0000', 'unit' => 'mm', 'severity' => 'BLOCK',
        'pass_message' => 'Đạt', 'fail_message' => 'Vi phạm', 'missing_message' => 'Thiếu',
    ];
}

function waterRule(string $severity = 'BLOCK'): array
{
    return fitRule(['id' => 2, 'rule_key' => 'need_water', 'left_source' => 'ROOM_FIELD', 'left_key' => 'water_supply', 'operator' => 'EQ', 'right_source' => 'CONSTANT', 'right_key' => null, 'right_value' => '1.0000', 'margin_value' => '0.0000', 'unit' => 'boolean', 'severity' => $severity]);
}

function expectResult(string $expected, array $rules, array $room, array $attributes, string $message): array
{
    $actual = RoomFitService::evaluate($rules, $room, $attributes);
    if ($actual['result'] !== $expected) throw new RuntimeException("$message: {$actual['result']} != $expected");
    return $actual;
}

$width = ['width_mm' => '680.0000'];
$room = ['placement_width_mm' => '700', 'water_supply' => 1];

$passed = expectResult('FIT', [fitRule()], $room, $width, 'Vừa đúng biên phải đạt');
if ($passed['checks'][0]['status'] !== 'PASS' || $passed['checks'][0]['explanation'] !== 'Đạt' || $passed['label'] !== 'Phù hợp') throw new RuntimeException('Sai giải thích khi đạt');
expectResult('NOT_FIT', [fitRule()], $room, ['width_mm' => '681'], 'Vượt 1 mm tính cả khoảng hở');
expectResult('NEEDS_CHECK', [fitRule(['severity' => 'WARN'])], $room, ['width_mm' => '681'], 'WARN chỉ cần kiểm tra thêm');
expectResult('NEEDS_CHECK', [fitRule()], ['placement_width_mm' => null], $width, 'Thiếu số đo phòng');
expectResult('NEEDS_CHECK', [fitRule()], $room, [], 'Thiếu thông số sản phẩm');
expectResult('NEEDS_CHECK', [], $room, $width, 'Không có quy tắc thì không được báo phù hợp');
expectResult('NOT_FIT', [fitRule(), waterRule()], ['placement_width_mm' => '100', 'water_supply' => null], $width, 'Lỗi chặn thắng dữ liệu thiếu');

expectResult('NOT_FIT', [waterRule()], ['water_supply' => 0], [], 'false là biết không có, khác null');
$missing = expectResult('NEEDS_CHECK', [waterRule()], ['water_supply' => null], [], 'null là chưa biết');
if ($missing['checks'][0]['status'] !== 'MISSING' || $missing['checks'][0]['explanation'] !== 'Thiếu') throw new RuntimeException('Sai trạng thái dữ liệu thiếu');

expectResult('FIT', [fitRule(['id' => 3, 'rule_key' => 'fit_area', 'left_source' => 'ROOM_FIELD', 'left_key' => 'floor_area_m2', 'right_source' => 'PRODUCT_ATTRIBUTE', 'right_key' => 'room_area_max_m2', 'margin_value' => '0', 'unit' => 'm2'])], ['floor_area_m2' => '18.20'], ['room_area_max_m2' => '18.2000'], 'So m2 đúng biên');
expectResult('NEEDS_CHECK', [fitRule(['left_source' => 'ROOM_FIELD', 'left_key' => 'password_hash'])], ['password_hash' => '1', 'placement_width_mm' => '700'], $width, 'Khóa ngoài whitelist là thiếu dữ liệu');

$category = fitRule();
$product = fitRule(['id' => 9, 'category_id' => null, 'product_id' => 7, 'margin_value' => '100']);
foreach ([[$category, $product], [$product, $category]] as $rules) {
    $override = expectResult('NOT_FIT', $rules, $room, $width, 'Quy tắc sản phẩm ghi đè danh mục');
    if (count($override['checks']) !== 1 || $override['checks'][0]['ruleId'] !== 9) throw new RuntimeException('Ghi đè phải giữ đúng một quy tắc');
}

echo "room-fit evaluate: OK\n";
