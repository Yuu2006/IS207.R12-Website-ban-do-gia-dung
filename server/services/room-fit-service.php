<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/spec-fields.php';
require_once __DIR__ . '/../models/room-fit-model.php';

// HOME-01/FIT-01: CRUD hồ sơ phòng của chính khách và đánh giá quy tắc đã cấu hình, không dùng eval.
class RoomFitService
{
    private const FIELDS = [
        'name' => ['name', 'text', 0],
        'placementWidthMm' => ['placement_width_mm', 'int', 100000],
        'placementDepthMm' => ['placement_depth_mm', 'int', 100000],
        'placementHeightMm' => ['placement_height_mm', 'int', 100000],
        'doorWidthMm' => ['door_width_mm', 'int', 100000],
        'floorAreaM2' => ['floor_area_m2', 'area', 0],
        'occupantCount' => ['occupant_count', 'int', 100],
        'powerAvailable' => ['power_available', 'bool', 0],
        'waterSupply' => ['water_supply', 'bool', 0],
        'drainage' => ['drainage', 'bool', 0],
    ];
    private const LABELS = ['FIT' => 'Phù hợp', 'NEEDS_CHECK' => 'Cần kiểm tra thêm', 'NOT_FIT' => 'Không phù hợp'];

    public function __construct(private RoomFitModel $model) {}

    public function list(int $userId): array
    {
        return array_map([$this, 'toApi'], $this->model->rooms($userId));
    }

    public function create(int $userId, array $input): array
    {
        return $this->toApi($this->model->room($this->model->createRoom($userId, $this->validate($input, false)), $userId));
    }

    // Field vắng mặt giữ nguyên; field null xóa thông tin đã biết.
    public function update(int $id, int $userId, array $input): array
    {
        $this->ownedRoom($id, $userId);
        $values = $this->validate($input, true);
        if ($values) $this->model->updateRoom($id, $userId, $values);
        return $this->toApi($this->ownedRoom($id, $userId));
    }

    public function delete(int $id, int $userId): array
    {
        $this->ownedRoom($id, $userId);
        $this->model->deleteRoom($id, $userId);
        return ['id' => $id];
    }

    public function check(int $userId, array $input): array
    {
        if (array_diff(array_keys($input), ['productId', 'roomProfileId', 'requestKey'])) throw new ApiException('Request có trường không được phép.', 422);
        $productId = $this->positiveId($input['productId'] ?? null, 'productId');
        $roomId = $this->positiveId($input['roomProfileId'] ?? null, 'roomProfileId');
        $requestKey = $input['requestKey'] ?? null;
        if (!is_string($requestKey) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $requestKey)) throw new ApiException('requestKey phải là UUID.', 422, ['requestKey' => 'Không hợp lệ.']);
        $categoryId = $this->model->activeProductCategory($productId);
        if ($categoryId === null) throw new ApiException('Không tìm thấy sản phẩm đang bán.', 404);
        $room = $this->ownedRoom($roomId, $userId);
        $result = self::evaluate($this->model->activeRules($productId, $categoryId), $room, $this->fitAttributes($productId));
        $this->model->recordFitCheck(strtolower($requestKey), $userId, $result['result']);
        return ['productId' => $productId, 'roomProfileId' => $roomId] + $result + ['evaluatedAt' => gmdate('Y-m-d\TH:i:s\Z')];
    }

    // BLOCK sai → NOT_FIT; còn thiếu dữ liệu, WARN sai hoặc không có quy tắc → NEEDS_CHECK; tất cả đạt → FIT.
    public static function evaluate(array $rules, array $room, array $attributes): array
    {
        $effective = [];
        foreach ($rules as $rule) {
            if ($rule['product_id'] !== null || !isset($effective[$rule['rule_key']])) $effective[$rule['rule_key']] = $rule;
        }
        $checks = array_map(static fn (array $rule): array => self::evaluateRule($rule, $room, $attributes), array_values($effective));
        $statuses = array_column($checks, 'status');
        $blocked = array_filter($checks, static fn (array $check): bool => $check['status'] === 'FAIL' && $check['severity'] === 'BLOCK');
        $result = $blocked ? 'NOT_FIT' : (!$checks || in_array('MISSING', $statuses, true) || in_array('FAIL', $statuses, true) ? 'NEEDS_CHECK' : 'FIT');
        return ['result' => $result, 'label' => self::LABELS[$result], 'checks' => $checks];
    }

    private static function evaluateRule(array $rule, array $room, array $attributes): array
    {
        $left = self::operand($rule['left_source'], $rule['left_key'], $rule['right_value'], $room, $attributes);
        $right = self::operand($rule['right_source'], $rule['right_key'], $rule['right_value'], $room, $attributes);
        $margin = $rule['unit'] === 'mm' ? (float) $rule['margin_value'] : 0.0;
        if ($left === null || $right === null) {
            $status = 'MISSING';
        } else {
            // Làm tròn theo DECIMAL(15,4) để biên kích thước không lệch do số thực.
            $required = round($left + $margin, 4);
            $passed = match ($rule['operator']) {
                'LT' => $required < $right, 'LTE' => $required <= $right, 'EQ' => $required === $right,
                'GTE' => $required >= $right, 'GT' => $required > $right,
            };
            $status = $passed ? 'PASS' : 'FAIL';
        }
        return [
            'ruleId' => (int) $rule['id'], 'ruleVersion' => (int) $rule['version'], 'status' => $status, 'severity' => $rule['severity'],
            'title' => $rule['title'], 'actual' => $left, 'limit' => $right, 'margin' => $margin, 'unit' => $rule['unit'],
            'explanation' => $rule[['PASS' => 'pass_message', 'FAIL' => 'fail_message', 'MISSING' => 'missing_message'][$status]],
        ];
    }

    // null là chưa biết; khóa ngoài whitelist cũng coi như chưa biết thay vì đọc cột bất kỳ.
    private static function operand(string $source, ?string $key, mixed $constant, array $room, array $attributes): ?float
    {
        $value = match ($source) {
            'CONSTANT' => $constant,
            'ROOM_FIELD' => isset(roomSpecFieldMap()[$key]) ? ($room[$key] ?? null) : null,
            'PRODUCT_ATTRIBUTE' => $attributes[$key] ?? null,
        };
        return $value === null ? null : round((float) $value, 4);
    }

    // Chỉ đọc thuộc tính khớp đúng kiểu/đơn vị trong bảng chuẩn; lệch metadata thì coi như thiếu.
    private function fitAttributes(int $productId): array
    {
        $map = specFieldMap();
        $values = [];
        foreach ($this->model->attributeValues($productId) as $row) {
            $spec = $map[$row['attribute_key']] ?? null;
            if (!$spec || !$spec['fit'] || $row['data_type'] !== $spec['type'] || $row['unit'] !== $spec['catalogUnit']) continue;
            $values[$row['attribute_key']] = $spec['type'] === 'boolean' ? $row['value_boolean'] : $row['value_number'];
        }
        return $values;
    }

    // Hồ sơ của người khác trả 404 để không lộ sự tồn tại.
    private function ownedRoom(int $id, int $userId): array
    {
        $room = $this->model->room($id, $userId);
        if (!$room) throw new ApiException('Không tìm thấy hồ sơ phòng.', 404);
        return $room;
    }

    private function validate(array $input, bool $partial): array
    {
        if (array_diff(array_keys($input), array_keys(self::FIELDS))) throw new ApiException('Request có trường không được phép.', 422);
        $values = [];
        $errors = [];
        foreach (self::FIELDS as $field => [$column, $type, $max]) {
            if ($partial && !array_key_exists($field, $input)) continue;
            try { $values[$column] = $this->clean($type, $input[$field] ?? null, $max); }
            catch (ApiException $error) { $errors[$field] = $error->getMessage(); }
        }
        if ($errors) throw new ApiException('Thông tin hồ sơ phòng chưa hợp lệ.', 422, $errors);
        return $values;
    }

    private function clean(string $type, mixed $value, int $max): mixed
    {
        if ($type === 'text') {
            $text = is_string($value) ? trim($value) : '';
            if (!preg_match('/^.{1,120}$/su', $text)) throw new ApiException('Tên không gian phải có 1–120 ký tự.');
            return $text;
        }
        if ($value === null) return null;
        if ($type === 'bool') {
            if (!is_bool($value)) throw new ApiException('Chỉ nhận có, không hoặc chưa rõ.');
            return (int) $value;
        }
        if ($type === 'area') {
            $text = is_int($value) || is_float($value) || is_string($value) ? (string) $value : '';
            if (!preg_match('/^\d{1,8}(\.\d{1,2})?$/', $text) || (float) $text <= 0) throw new ApiException('Diện tích phải lớn hơn 0, tối đa 2 chữ số lẻ.');
            return $text;
        }
        if (!is_int($value) || $value <= 0 || $value > $max) throw new ApiException("Phải là số nguyên từ 1 đến $max.");
        return $value;
    }

    private function positiveId(mixed $value, string $field): int
    {
        if (!is_int($value) || $value <= 0) throw new ApiException("$field phải là số nguyên dương.", 422, [$field => 'Không hợp lệ.']);
        return $value;
    }

    private function toApi(array $row): array
    {
        $result = ['id' => (int) $row['id'], 'isDefault' => (bool) $row['is_default']];
        foreach (self::FIELDS as $field => [$column, $type]) {
            $value = $row[$column];
            $result[$field] = $value === null || $type === 'text' ? $value : match ($type) { 'int' => (int) $value, 'area' => (float) $value, 'bool' => (bool) $value };
        }
        foreach (['createdAt' => 'created_at', 'updatedAt' => 'updated_at'] as $field => $column) {
            $result[$field] = (new DateTimeImmutable($row[$column], new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s\Z');
        }
        return $result;
    }
}
