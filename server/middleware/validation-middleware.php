<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

const ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'shipping', 'delivered', 'completed', 'cancelled'];
const MAX_ORDER_BODY_BYTES = 16384;

// Dừng validation bằng lỗi 422 có field để frontend hiển thị chính xác.
function invalidOrderInput(string $field, string $message, string $code = 'INVALID_INPUT'): never
{
    throw new ApiException(422, $code, $message, [$field => $message]);
}

// JSON bắt buộc object; phân biệt parse error 400, type/schema error 422 và size 413.
function parseOrderJson(string $raw, array $headers): array
{
    if (strlen($raw) > MAX_ORDER_BODY_BYTES) {
        throw new ApiException(413, 'REQUEST_BODY_TOO_LARGE', 'Nội dung yêu cầu quá lớn.');
    }
    $contentType = $headers['content-type'] ?? '';
    if (!is_string($contentType) || strtolower(trim(explode(';', $contentType)[0])) !== 'application/json') {
        throw new ApiException(415, 'UNSUPPORTED_MEDIA_TYPE', 'Yêu cầu phải dùng application/json.');
    }
    try {
        $decoded = json_decode($raw, false, 32, JSON_THROW_ON_ERROR);
    } catch (\JsonException) {
        throw new ApiException(400, 'MALFORMED_JSON', 'Nội dung JSON không hợp lệ.');
    }
    if (!$decoded instanceof \stdClass) {
        invalidOrderInput('body', 'Nội dung yêu cầu phải là JSON object.');
    }
    return get_object_vars($decoded);
}

// Không âm thầm bỏ actor/role/price/total do client gửi để tránh hiểu nhầm contract.
function allowOrderFields(array $input, array $allowed): void
{
    foreach (array_keys($input) as $field) {
        if (!in_array($field, $allowed, true)) {
            invalidOrderInput((string) $field, 'Yêu cầu chứa trường không được hỗ trợ.');
        }
    }
}

// Chỉ nhận integer JSON dương; không ép kiểu số thập phân hoặc numeric string.
function orderPositiveInteger(mixed $value, string $field): int
{
    if (!is_int($value) || $value < 1) {
        invalidOrderInput($field, 'Giá trị phải là số nguyên dương.');
    }
    return $value;
}

// ID dùng chuỗi số dương để tránh mất độ chính xác trên frontend.
function orderDatabaseId(mixed $value, string $field): string
{
    if (!is_string($value) || preg_match('/^[1-9][0-9]*$/D', $value) !== 1) {
        invalidOrderInput($field, 'ID database phải là chuỗi số nguyên dương.');
    }
    return $value;
}

// Đếm Unicode không bắt buộc mbstring; input JSON đã được xác minh UTF-8.
function orderText(mixed $value, string $field, int $minimum, int $maximum): string
{
    if (!is_string($value)) {
        invalidOrderInput($field, 'Giá trị phải là chuỗi.');
    }
    $text = trim($value);
    $length = preg_match_all('/./us', $text);
    if ($length === false || $length < $minimum || $length > $maximum) {
        invalidOrderInput($field, "Nội dung cần từ {$minimum} đến {$maximum} ký tự.", $field === 'reason' && $length === 0 ? 'REASON_REQUIRED' : 'INVALID_INPUT');
    }
    return $text;
}

// Xác minh định dạng key; replay/uniqueness sẽ do transaction service thực hiện.
function orderIdempotencyKey(array $headers): string
{
    $value = $headers['idempotency-key'] ?? null;
    if (!is_string($value) || preg_match('/^[A-Za-z0-9._:-]{16,128}$/D', $value) !== 1) {
        invalidOrderInput('Idempotency-Key', 'Cần mã chống gửi lặp hợp lệ dài 16–128 ký tự.', 'IDEMPOTENCY_KEY_REQUIRED');
    }
    return $value;
}

// Filter được chuẩn hóa trước khi service phân trang; không nhận customerId/role.
function validateOrderList(array $query, bool $sales = false): array
{
    allowOrderFields($query, $sales ? ['status', 'page', 'pageSize', 'search'] : ['status', 'page', 'pageSize']);
    $result = [];
    foreach (['page' => 1, 'pageSize' => 10] as $field => $default) {
        $raw = $query[$field] ?? (string) $default;
        if (!is_string($raw) || preg_match('/^[1-9][0-9]*$/D', $raw) !== 1) {
            invalidOrderInput($field, 'Tham số phân trang phải là số nguyên dương.');
        }
        $value = filter_var($raw, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => $field === 'pageSize' ? 50 : PHP_INT_MAX]]);
        if ($value === false) {
            invalidOrderInput($field, 'Tham số phân trang ngoài giới hạn.');
        }
        $result[$field] = $value;
    }
    $result['statuses'] = [];
    if (array_key_exists('status', $query)) {
        if (!is_string($query['status'])) {
            invalidOrderInput('status', 'Bộ lọc trạng thái phải là chuỗi CSV.');
        }
        $values = array_map('trim', explode(',', $query['status']));
        if (count($values) > 7 || array_diff($values, ORDER_STATUSES) !== []) {
            invalidOrderInput('status', 'Bộ lọc chứa trạng thái không hợp lệ.');
        }
        $result['statuses'] = array_values(array_unique($values));
    }
    if ($sales) {
        $result['search'] = orderText($query['search'] ?? '', 'search', 0, 100);
    }
    return $result;
}

// Chuẩn hóa quote/create, loại đầu vào giá/tồn/actor không thuộc contract.
function validateCheckoutInput(array $input, bool $create = false): array
{
    allowOrderFields($input, $create ? ['cartVersion', 'addressId', 'paymentMethod', 'voucherCode', 'quoteFingerprint', 'note'] : ['cartVersion', 'addressId', 'paymentMethod', 'voucherCode']);
    $method = $input['paymentMethod'] ?? null;
    if (!in_array($method, ['COD', 'VNPAY'], true)) {
        invalidOrderInput('paymentMethod', 'Phương thức thanh toán không hợp lệ.');
    }
    $result = [
        'cartVersion' => orderPositiveInteger($input['cartVersion'] ?? null, 'cartVersion'),
        'addressId' => orderDatabaseId($input['addressId'] ?? null, 'addressId'),
        'paymentMethod' => $method,
        'voucherCode' => ($input['voucherCode'] ?? null) === null ? null : orderText($input['voucherCode'], 'voucherCode', 1, 50),
    ];
    if ($create) {
        $result['quoteFingerprint'] = orderText($input['quoteFingerprint'] ?? null, 'quoteFingerprint', 1, MAX_ORDER_BODY_BYTES);
        $result['note'] = orderText($input['note'] ?? '', 'note', 0, 500);
    }
    return $result;
}

// Chuẩn hóa payload ghi; state/owner/version thật phải kiểm tra lại từ database.
function validateOrderMutation(array $input, string $operation): array
{
    if ($operation === 'reorder') {
        allowOrderFields($input, ['expectedCartVersion']);
        return ['expectedCartVersion' => orderPositiveInteger($input['expectedCartVersion'] ?? null, 'expectedCartVersion')];
    }
    allowOrderFields($input, $operation === 'cancel' ? ['expectedVersion', 'reason'] : ['expectedVersion', 'toStatus', 'reason', 'codCollected']);
    $result = ['expectedVersion' => orderPositiveInteger($input['expectedVersion'] ?? null, 'expectedVersion')];
    $to = $operation === 'cancel' ? 'cancelled' : ($input['toStatus'] ?? null);
    if (!in_array($to, ORDER_STATUSES, true)) {
        invalidOrderInput('toStatus', 'Trạng thái đích không hợp lệ.');
    }
    if ($operation !== 'cancel') {
        $result['toStatus'] = $to;
    }
    if ($to === 'cancelled' || array_key_exists('reason', $input)) {
        $result['reason'] = orderText($input['reason'] ?? '', 'reason', 1, 500);
    }
    if (array_key_exists('codCollected', $input)) {
        if ($to !== 'delivered' || !is_bool($input['codCollected'])) {
            invalidOrderInput('codCollected', 'Xác nhận COD chỉ dùng tại bước đã giao và phải là boolean.');
        }
        $result['codCollected'] = $input['codCollected'];
    }
    return $result;
}
