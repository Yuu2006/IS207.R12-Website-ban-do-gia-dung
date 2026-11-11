<?php
declare(strict_types=1);
require_once __DIR__ . '/../config/spec-fields.php';
require_once __DIR__ . '/../models/fit-rule-model.php';

// Chỉ chọn key catalog đã được TV4 khai báo đúng kiểu/đơn vị; không nhận biểu thức để eval.
class FitRuleService
{
    private const INPUT_FIELDS = ['categoryId', 'productId', 'ruleKey', 'title', 'leftSource', 'leftKey', 'operator', 'rightSource', 'rightKey', 'rightValue', 'marginValue', 'unit', 'severity', 'passMessage', 'failMessage', 'missingMessage', 'status'];
    private const SOURCES = ['ROOM_FIELD', 'PRODUCT_ATTRIBUTE'];
    private const OPERATORS = ['LT', 'LTE', 'EQ', 'GTE', 'GT'];

    public function __construct(private FitRuleModel $model) {}

    public function options(?int $categoryId): array
    {
        $scopes = $this->model->scopes();
        return ['categories' => $scopes['categories'], 'products' => $scopes['products'], 'roomFields' => roomSpecFieldMap(), 'productFields' => $categoryId ? $this->productFields($categoryId) : []];
    }

    public function list(?int $categoryId, ?int $productId, mixed $status, int $page): array
    {
        if ($status !== null && (!is_string($status) || !in_array($status, ['ACTIVE', 'INACTIVE'], true))) throw new ApiException('Trạng thái không hợp lệ.', 422);
        $result = $this->model->rules($categoryId, $productId, $status, $page);
        $result['items'] = array_map([$this, 'toApi'], $result['items']);
        return $result;
    }

    public function get(int $id): array
    {
        $row = $this->model->rule($id);
        if (!$row) throw new ApiException('Không tìm thấy quy tắc.', 404);
        return $this->toApi($row);
    }

    public function versions(int $id): array
    {
        $this->get($id);
        return ['items' => array_map(static fn (array $row): array => [
            'version' => (int) $row['version'], 'action' => $row['action'],
            'snapshot' => json_decode($row['snapshot'], true, 32, JSON_THROW_ON_ERROR),
            'changedBy' => (int) $row['changed_by'], 'changedByName' => $row['changed_by_name'],
            'changedAt' => (new DateTimeImmutable($row['changed_at'], new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s.u\Z'),
        ], $this->model->versions($id))];
    }

    public function create(array $input, int $actorId): array
    {
        $values = $this->validate($input);
        try { return $this->toApi($this->model->create($values, $actorId)); }
        catch (PDOException $error) { $this->rethrowDatabaseError($error); }
    }

    public function update(int $id, array $input, int $actorId): array
    {
        $expected = $this->positiveId($input['expectedVersion'] ?? null, 'expectedVersion');
        $values = $this->validate($input, true);
        try { return $this->toApi($this->model->update($id, $values, $expected, $actorId)); }
        catch (PDOException $error) { $this->rethrowDatabaseError($error); }
    }

    public function deactivate(int $id, int $actorId): array
    {
        $current = $this->get($id);
        if ($current['status'] === 'INACTIVE') return $current;
        return $this->toApi($this->model->update($id, ['status' => 'INACTIVE'], $current['version'], $actorId, 'DEACTIVATE'));
    }

    // Trả field catalog đúng metadata, bỏ field chưa thống nhất thay vì đoán đơn vị.
    private function productFields(int $categoryId): array
    {
        if (!$this->model->categoryExists($categoryId)) throw new ApiException('Không tìm thấy danh mục.', 404);
        $map = specFieldMap();
        $fields = [];
        foreach ($this->model->attributes($categoryId) as $attribute) {
            $key = $attribute['attribute_key'];
            $spec = $map[$key] ?? null;
            if (!$spec || !$spec['fit'] || $attribute['data_type'] !== $spec['type'] || $attribute['unit'] !== $spec['catalogUnit']) continue;
            $fields[$key] = ['label' => $attribute['name'], 'unit' => $spec['unit']];
        }
        return $fields;
    }

    private function validate(array $input, bool $updating = false): array
    {
        $allowed = $updating ? [...self::INPUT_FIELDS, 'expectedVersion'] : self::INPUT_FIELDS;
        if (array_diff(array_keys($input), $allowed)) throw new ApiException('Request có trường không được phép.', 422);
        foreach (self::INPUT_FIELDS as $field) {
            if (!array_key_exists($field, $input)) throw new ApiException('Thiếu trường quy tắc.', 422, [$field => 'Bắt buộc.']);
        }
        $categoryId = $input['categoryId'] === null ? null : $this->positiveId($input['categoryId'], 'categoryId');
        $productId = $input['productId'] === null ? null : $this->positiveId($input['productId'], 'productId');
        if (($categoryId === null) === ($productId === null)) throw new ApiException('Chọn đúng một phạm vi: danh mục hoặc sản phẩm.', 422);
        if ($productId !== null) {
            $categoryIdForFields = $this->model->productCategory($productId);
            if ($categoryIdForFields === null) throw new ApiException('Không tìm thấy sản phẩm.', 404);
        } else {
            $categoryIdForFields = $categoryId;
        }
        $productFields = $this->productFields($categoryIdForFields);
        $rooms = roomSpecFieldMap();
        $leftSource = $input['leftSource'];
        $rightSource = $input['rightSource'];
        if (!in_array($leftSource, self::SOURCES, true) || !in_array($rightSource, [...self::SOURCES, 'CONSTANT'], true)) throw new ApiException('Nguồn dữ liệu không hợp lệ.', 422);
        $leftUnit = $this->fieldUnit($leftSource, $input['leftKey'], $rooms, $productFields);
        $rightUnit = $rightSource === 'CONSTANT' ? $leftUnit : $this->fieldUnit($rightSource, $input['rightKey'], $rooms, $productFields);
        $unit = $input['unit'];
        if ($unit !== $leftUnit || $unit !== $rightUnit) throw new ApiException('Đơn vị không khớp metadata của catalog/phòng.', 422, ['unit' => 'Kiểm tra lại field và đơn vị với TV4.']);
        if (!in_array($input['operator'], self::OPERATORS, true) || ($unit === 'boolean' && $input['operator'] !== 'EQ')) throw new ApiException('Toán tử không phù hợp với kiểu dữ liệu.', 422);
        if (!in_array($input['severity'], ['BLOCK', 'WARN'], true) || !in_array($input['status'], ['ACTIVE', 'INACTIVE'], true)) throw new ApiException('Mức cảnh báo hoặc trạng thái không hợp lệ.', 422);
        $rightValue = $rightSource === 'CONSTANT' ? $this->decimal($input['rightValue'], 'rightValue') : null;
        if (($rightSource === 'CONSTANT' && $input['rightKey'] !== null) || ($rightSource !== 'CONSTANT' && $input['rightValue'] !== null)) throw new ApiException('Chỉ dùng rightValue cho hằng số.', 422);
        if ($unit === 'boolean' && $rightValue !== null && !in_array($rightValue, ['0', '1'], true)) throw new ApiException('Giá trị boolean phải là 0 hoặc 1.', 422);
        $margin = $this->decimal($input['marginValue'], 'marginValue');
        if ((float) $margin < 0 || ($unit !== 'mm' && (float) $margin !== 0.0)) throw new ApiException('Khoảng hở chỉ dùng cho mm và không được âm.', 422);
        $key = trim((string) $input['ruleKey']);
        if (!preg_match('/^[a-z][a-z0-9_]{1,79}$/', $key)) throw new ApiException('Mã quy tắc phải có 2–80 ký tự a-z, số hoặc gạch dưới.', 422);
        $title = $this->text($input['title'], 'title', 150);
        return [
            'category_id' => $categoryId, 'product_id' => $productId, 'rule_key' => $key,
            'title' => $title, 'left_source' => $leftSource, 'left_key' => $input['leftKey'],
            'operator' => $input['operator'], 'right_source' => $rightSource,
            'right_key' => $rightSource === 'CONSTANT' ? null : $input['rightKey'],
            'right_value' => $rightValue, 'margin_value' => $margin, 'unit' => $unit,
            'severity' => $input['severity'],
            'pass_message' => $this->text($input['passMessage'], 'passMessage', 255),
            'fail_message' => $this->text($input['failMessage'], 'failMessage', 255),
            'missing_message' => $this->text($input['missingMessage'], 'missingMessage', 255),
            'status' => $input['status'],
        ];
    }

    private function fieldUnit(string $source, mixed $key, array $rooms, array $products): string
    {
        if (!is_string($key) || !isset(($source === 'ROOM_FIELD' ? $rooms : $products)[$key])) throw new ApiException('Field chưa được TV4 khai báo đúng kiểu/đơn vị cho danh mục này.', 422);
        return ($source === 'ROOM_FIELD' ? $rooms : $products)[$key]['unit'];
    }

    private function positiveId(mixed $value, string $field): int
    {
        if (!is_int($value) && !(is_string($value) && ctype_digit($value))) throw new ApiException("$field phải là số nguyên dương.", 422);
        $id = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        if ($id === false) throw new ApiException("$field phải là số nguyên dương.", 422);
        return $id;
    }

    private function decimal(mixed $value, string $field): string
    {
        if (!is_int($value) && !is_float($value) && !is_string($value)) throw new ApiException("$field phải là số.", 422);
        $text = (string) $value;
        if (!preg_match('/^-?\d{1,11}(?:\.\d{1,4})?$/', $text)) throw new ApiException("$field phải là số thập phân tối đa bốn chữ số lẻ.", 422);
        return $text;
    }

    private function text(mixed $value, string $field, int $max): string
    {
        if (!is_string($value) || trim($value) === '' || strlen(trim($value)) > $max) throw new ApiException("$field phải có 1–$max byte.", 422);
        return trim($value);
    }

    private function rethrowDatabaseError(PDOException $error): never
    {
        if ($error->getCode() === '23000') throw new ApiException('Mã quy tắc đã tồn tại trong phạm vi này.', 409);
        throw $error;
    }

    public function toApi(array $row): array
    {
        $keys = [
            'id' => 'id', 'category_id' => 'categoryId', 'product_id' => 'productId', 'rule_key' => 'ruleKey',
            'title' => 'title', 'left_source' => 'leftSource', 'left_key' => 'leftKey', 'operator' => 'operator',
            'right_source' => 'rightSource', 'right_key' => 'rightKey', 'right_value' => 'rightValue',
            'margin_value' => 'marginValue', 'unit' => 'unit', 'severity' => 'severity',
            'pass_message' => 'passMessage', 'fail_message' => 'failMessage', 'missing_message' => 'missingMessage',
            'status' => 'status', 'version' => 'version', 'updated_by' => 'updatedBy',
            'updated_by_name' => 'updatedByName', 'created_at' => 'createdAt', 'updated_at' => 'updatedAt',
        ];
        $result = [];
        foreach ($keys as $column => $name) $result[$name] = $row[$column] ?? null;
        foreach (['id', 'categoryId', 'productId', 'version', 'updatedBy'] as $name) if ($result[$name] !== null) $result[$name] = (int) $result[$name];
        foreach (['createdAt', 'updatedAt'] as $name) if ($result[$name] !== null) $result[$name] = (new DateTimeImmutable($result[$name], new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s\Z');
        return $result;
    }
}
