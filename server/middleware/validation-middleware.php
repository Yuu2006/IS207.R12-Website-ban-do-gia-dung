<?php
declare(strict_types=1);
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

function validateProfile(array $input, array $current = []): array
{
    onlyFields($input, ['fullName', 'email', 'phone']);
    $values = array_merge(['fullName' => '', 'email' => '', 'phone' => ''], $current, $input);
    $errors = [];
    $result = [
        'fullName' => textValue($values['fullName'], 'fullName', 150, true, $errors),
        'email' => normalizeContact(textValue($values['email'], 'email', 255, false, $errors)),
        'phone' => normalizeContact(textValue($values['phone'], 'phone', 20, false, $errors)),
    ];
    if ($result['email'] && !preg_match('/^[^\s@]+@[^\s@]+\.[^\s@]+$/', $result['email'])) $errors['email'] = 'Email chưa hợp lệ.';
    if ($result['phone'] && !preg_match('/^0\d{9}$/', $result['phone'])) $errors['phone'] = 'Số điện thoại chưa hợp lệ.';
    if (!$result['email'] && !$result['phone']) $errors['email'] = 'Cần ít nhất email hoặc số điện thoại.';
    if ($errors) throw new ApiException('Hãy kiểm tra thông tin hồ sơ.', 422, $errors);
    return $result;
}

function validateAddress(array $input, array $current = []): array
{
    onlyFields($input, ['recipientName', 'phone', 'addressLine', 'province', 'district', 'ward', 'isDefault']);
    $values = array_merge(['recipientName' => '', 'phone' => '', 'addressLine' => '', 'province' => '', 'district' => '', 'ward' => '', 'isDefault' => false], $current, $input);
    $errors = [];
    $result = [];
    foreach (['recipientName' => 150, 'phone' => 20, 'addressLine' => 255, 'province' => 100, 'district' => 100, 'ward' => 100] as $field => $limit) {
        $result[$field] = textValue($values[$field], $field, $limit, !in_array($field, ['district', 'ward'], true), $errors);
    }
    $result['phone'] = normalizeContact($result['phone']);
    if (!preg_match('/^0\d{9}$/', $result['phone'])) $errors['phone'] = 'Số điện thoại chưa hợp lệ.';
    if (!is_bool($values['isDefault'])) $errors['isDefault'] = 'Giá trị mặc định phải là boolean.';
    $result['isDefault'] = $values['isDefault'];
    if ($errors) throw new ApiException('Hãy kiểm tra thông tin địa chỉ.', 422, $errors);
    return $result;
}
