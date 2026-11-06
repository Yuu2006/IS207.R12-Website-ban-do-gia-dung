<?php
declare(strict_types=1);

// Order API guard (Tấn Vĩ) dùng namespace; auth/hồ sơ/catalog dùng global scope.
namespace HomeCare\OrderApi {

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
    if (!is_int($value) || $value < 1 || $value > 9007199254740991) {
        invalidOrderInput($field, 'Giá trị phải là số nguyên dương.');
    }
    return $value;
}

// ID dùng chuỗi số dương để tránh mất độ chính xác trên frontend.
function orderDatabaseId(mixed $value, string $field): string
{
    if (!is_string($value) || preg_match('/^[1-9][0-9]*$/D', $value) !== 1 || strlen($value) > 20 || (strlen($value) === 20 && strcmp($value, '18446744073709551615') > 0)) {
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

// Return desk filters are fixed allowlists; unknown query input cannot change ownership or staff role.
function validateReturnList(array $query): array
{
    allowOrderFields($query, ['status', 'severity', 'search', 'page', 'pageSize']);
    $pagination = validateOrderList(array_intersect_key($query, array_flip(['page', 'pageSize'])));
    $statuses = ['requested', 'pending_manager', 'approved', 'rejected', 'refunded'];
    $severities = ['minor', 'major', 'critical'];
    $status = $query['status'] ?? '';
    $severity = $query['severity'] ?? '';
    if (!is_string($status) || ($status !== '' && !in_array($status, $statuses, true))) invalidOrderInput('status', 'Trạng thái yêu cầu trả hàng không hợp lệ.');
    if (!is_string($severity) || ($severity !== '' && !in_array($severity, $severities, true))) invalidOrderInput('severity', 'Mức độ sự cố không hợp lệ.');
    return ['page' => $pagination['page'], 'pageSize' => $pagination['pageSize'], 'status' => $status, 'severity' => $severity, 'search' => orderText($query['search'] ?? '', 'search', 0, 100)];
}

// Revenue dates are inclusive local calendar dates and are converted to UTC by the report model.
function validateRevenueRange(array $query): array
{
    allowOrderFields($query, ['from', 'to']);
    $result = [];
    foreach (['from', 'to'] as $field) {
        $value = $query[$field] ?? null;
        if (!is_string($value) || preg_match('/^\d{4}-\d{2}-\d{2}$/D', $value) !== 1) invalidOrderInput($field, 'Ngày phải theo định dạng YYYY-MM-DD.');
        $date = \DateTimeImmutable::createFromFormat('!Y-m-d', $value, new \DateTimeZone('Asia/Ho_Chi_Minh'));
        $errors = \DateTimeImmutable::getLastErrors();
        if (!$date || ($errors !== false && ($errors['warning_count'] > 0 || $errors['error_count'] > 0)) || $date->format('Y-m-d') !== $value) invalidOrderInput($field, 'Ngày không hợp lệ.');
        $result[$field] = $value;
    }
    $start = new \DateTimeImmutable($result['from'], new \DateTimeZone('Asia/Ho_Chi_Minh'));
    $end = new \DateTimeImmutable($result['to'], new \DateTimeZone('Asia/Ho_Chi_Minh'));
    if ($end < $start) invalidOrderInput('to', 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.');
    if ((int) $start->diff($end)->format('%a') > 365) invalidOrderInput('to', 'Khoảng báo cáo tối đa là 366 ngày.');
    return $result;
}

// Staff actions record a required rationale and accept only the MVP severity/decision values.
function validateReturnMutation(array $input, string $operation): array
{
    if ($operation === 'return-triage') {
        allowOrderFields($input, ['severity', 'note']);
        $severity = $input['severity'] ?? null;
        if (!is_string($severity) || !in_array($severity, ['MINOR', 'MAJOR', 'CRITICAL'], true)) invalidOrderInput('severity', 'Mức độ phải là MINOR, MAJOR hoặc CRITICAL.');
        return ['severity' => $severity, 'note' => orderText($input['note'] ?? '', 'note', 1, 500)];
    }
    if ($operation === 'return-decision') {
        allowOrderFields($input, ['decision', 'reason']);
        $decision = $input['decision'] ?? null;
        if (!is_string($decision) || !in_array($decision, ['APPROVE', 'REJECT'], true)) invalidOrderInput('decision', 'Quyết định phải là APPROVE hoặc REJECT.');
        return ['decision' => $decision, 'reason' => orderText($input['reason'] ?? '', 'reason', 1, 500)];
    }
    allowOrderFields($input, ['checklist']);
    $checklist = $input['checklist'] ?? null;
    if (!$checklist instanceof \stdClass) invalidOrderInput('checklist', 'Checklist nhận hàng không hợp lệ.');
    $values = get_object_vars($checklist);
    allowOrderFields($values, ['packageReceived', 'orderMatched', 'allItemsPresent', 'conditionAssessed', 'notes']);
    foreach (['packageReceived', 'orderMatched', 'allItemsPresent', 'conditionAssessed'] as $field) {
        if (!array_key_exists($field, $values) || !is_bool($values[$field])) invalidOrderInput('checklist.' . $field, 'Mỗi mục checklist phải được xác nhận rõ ràng.');
    }
    return ['checklist' => [
        'packageReceived' => $values['packageReceived'], 'orderMatched' => $values['orderMatched'],
        'allItemsPresent' => $values['allItemsPresent'], 'conditionAssessed' => $values['conditionAssessed'],
        'notes' => orderText($values['notes'] ?? '', 'checklist.notes', 1, 500),
    ]];
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

// Validate an add-to-cart request; price, stock, customer and cart state remain server-owned.
function validateCartAdd(array $input): array
{
    allowOrderFields($input, ['variantId', 'quantity', 'expectedCartVersion']);
    $quantity = orderPositiveInteger($input['quantity'] ?? null, 'quantity');
    if ($quantity > 4294967295) invalidOrderInput('quantity', 'Số lượng vượt giới hạn lưu trữ.');
    return [
        'variantId' => orderDatabaseId($input['variantId'] ?? null, 'variantId'),
        'quantity' => $quantity,
        'expectedCartVersion' => orderPositiveInteger($input['expectedCartVersion'] ?? null, 'expectedCartVersion'),
    ];
}

// Validate an absolute quantity update; cart ownership/version and available stock stay server-owned.
function validateCartUpdate(array $input): array
{
    allowOrderFields($input, ['quantity', 'expectedCartVersion']);
    $quantity = orderPositiveInteger($input['quantity'] ?? null, 'quantity');
    if ($quantity > 4294967295) invalidOrderInput('quantity', 'Số lượng vượt giới hạn lưu trữ.');
    return [
        'quantity' => $quantity,
        'expectedCartVersion' => orderPositiveInteger($input['expectedCartVersion'] ?? null, 'expectedCartVersion'),
    ];
}

// Chuẩn hóa payload ghi; state/owner/version thật phải kiểm tra lại từ database.
function validateOrderMutation(array $input, string $operation): array
{
    if ($operation === 'return') {
        allowOrderFields($input, ['expectedVersion', 'issueCategory', 'reason']);
        $category = $input['issueCategory'] ?? null;
        $categories = ['SAFETY_HAZARD', 'DEFECTIVE', 'TRANSIT_DAMAGE', 'WRONG_ITEM', 'MISSING_COMPONENT', 'SPEC_MISMATCH', 'COSMETIC_DAMAGE', 'PACKAGING_ONLY', 'BUYER_REMORSE', 'CUSTOMER_MISUSE', 'OTHER'];
        if (!is_string($category) || !in_array($category, $categories, true)) invalidOrderInput('issueCategory', 'Hãy chọn nhóm vấn đề phù hợp.');
        return [
            'expectedVersion' => orderPositiveInteger($input['expectedVersion'] ?? null, 'expectedVersion'),
            'issueCategory' => $category,
            'reason' => orderText($input['reason'] ?? '', 'reason', 1, 500),
        ];
    }
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

}

namespace {

require_once __DIR__ . '/../utils/response.php';

// Whitelist bảo vệ ID, role và chủ sở hữu khỏi mass assignment.
function onlyFields(array $input, array $fields): void
{
    if (array_diff(array_keys($input), $fields)) {
        throw new ApiException('Request có trường không được phép.', 422);
    }
}

function normalizeContact(string $value): string
{
    $value = trim($value);
    if (str_contains($value, '@')) return strtolower($value);
    return preg_replace('/^\+84/', '0', preg_replace('/[\s.\-]/', '', $value));
}

// Đếm ký tự UTF-8 theo schema VARCHAR, không cần extension bổ sung.
function textValue(mixed $value, string $field, int $max, bool $required, array &$errors): string
{
    if (!is_string($value)) {
        $errors[$field] = 'Giá trị phải là chuỗi.';
        return '';
    }
    $value = trim($value);
    $length = preg_match_all('/./us', $value);
    if ($length === false || $length > $max || ($required && $value === '')) $errors[$field] = "Trường bắt buộc hoặc vượt quá $max ký tự.";
    return $value;
}

// Độ mạnh tối thiểu CUS-01: 8–200 ký tự, có chữ và số.
function passwordValue(mixed $value, string $field, array &$errors): string
{
    if (!is_string($value) || strlen($value) < 8 || strlen($value) > 200 || !preg_match('/\pL/u', $value) || !preg_match('/\d/', $value)) {
        $errors[$field] = 'Mật khẩu cần 8–200 ký tự, gồm cả chữ và số.';
        return '';
    }
    return $value;
}

function phoneValue(mixed $value, string $field, bool $required, array &$errors): string
{
    $phone = normalizeContact(textValue($value, $field, 20, $required, $errors));
    if (($phone !== '' || $required) && !preg_match('/^0\d{9}$/', $phone)) $errors[$field] = 'Số điện thoại chưa hợp lệ.';
    return $phone;
}

function validateRegistration(array $input): array
{
    onlyFields($input, ['fullName', 'email', 'phone', 'password']);
    $errors = [];
    $result = [
        'fullName' => textValue($input['fullName'] ?? '', 'fullName', 150, true, $errors),
        'email' => normalizeContact(textValue($input['email'] ?? '', 'email', 255, true, $errors)),
        'phone' => phoneValue($input['phone'] ?? '', 'phone', false, $errors),
        'password' => passwordValue($input['password'] ?? null, 'password', $errors),
    ];
    if (!isset($errors['email']) && !preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $result['email'])) $errors['email'] = 'Email chưa hợp lệ.';
    if ($errors) throw new ApiException('Hãy kiểm tra thông tin đăng ký.', 422, $errors);
    return $result;
}

// Email đăng nhập không đổi qua PATCH (cần xác minh riêng theo CUS-04).
function validateProfile(array $input, array $current): array
{
    onlyFields($input, ['fullName', 'phone', 'birthDate', 'avatarUrl']);
    $values = array_merge($current, $input);
    $errors = [];
    $result = [
        'fullName' => textValue($values['fullName'], 'fullName', 150, true, $errors),
        'phone' => phoneValue($values['phone'], 'phone', false, $errors),
        'birthDate' => textValue($values['birthDate'], 'birthDate', 10, false, $errors),
        'avatarUrl' => textValue($values['avatarUrl'] ?? '', 'avatarUrl', 500, false, $errors),
    ];
    // Ảnh đại diện chỉ nhận file do /api/uploads/images (type=avatars) sinh ra, không nhận URL ngoài.
    if ($result['avatarUrl'] !== '' && !uploadedImageUrl($result['avatarUrl'], 'avatars')) $errors['avatarUrl'] = 'Ảnh đại diện phải được tải lên qua hệ thống.';
    if ($result['birthDate'] !== '') {
        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $result['birthDate']);
        if (!$date || $date->format('Y-m-d') !== $result['birthDate'] || $date > new DateTimeImmutable('today') || $date->format('Y') < 1900) $errors['birthDate'] = 'Ngày sinh chưa hợp lệ.';
    }
    if ($errors) throw new ApiException('Hãy kiểm tra thông tin hồ sơ.', 422, $errors);
    return $result;
}

// URL http(s) trỏ tới ảnh tên ngẫu nhiên trong uploads/<folder>, đúng định dạng upload-controller tạo ra.
function uploadedImageUrl(mixed $url, string $folder): bool
{
    if (!is_string($url) || strlen($url) > 500 || !in_array(parse_url($url, PHP_URL_SCHEME), ['http', 'https'], true)) return false;
    return (bool) preg_match('#^/uploads/' . $folder . '/[a-f0-9]{32}\.(jpg|png|webp)$#', (string) parse_url($url, PHP_URL_PATH));
}

function validateAddress(array $input, array $current = []): array
{
    onlyFields($input, ['recipientName', 'phone', 'addressLine', 'province', 'district', 'ward', 'isDefault']);
    $values = array_merge(['recipientName' => '', 'phone' => '', 'addressLine' => '', 'province' => '', 'district' => '', 'ward' => '', 'isDefault' => false], $current, $input);
    $errors = [];
    $result = [];
    foreach (['recipientName' => 150, 'addressLine' => 255, 'province' => 100, 'district' => 100, 'ward' => 100] as $field => $limit) {
        $result[$field] = textValue($values[$field], $field, $limit, !in_array($field, ['district', 'ward'], true), $errors);
    }
    $result['phone'] = phoneValue($values['phone'], 'phone', true, $errors);
    if (!is_bool($values['isDefault'])) $errors['isDefault'] = 'Giá trị mặc định phải là boolean.';
    $result['isDefault'] = $values['isDefault'];
    if ($errors) throw new ApiException('Hãy kiểm tra thông tin địa chỉ.', 422, $errors);
    return $result;
}

}
