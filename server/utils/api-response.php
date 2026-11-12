<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

// Lỗi public có mã/status; không serialize exception hoặc thông tin SQL.
final class ApiException extends \RuntimeException
{
    // Gắn HTTP status, mã lỗi và lỗi field vào exception public có kiểm soát.
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $fields = [],
    ) {
        parent::__construct($message);
    }
}

// Đóng dữ liệu service vào envelope thành công, không xuất HTTP trực tiếp.
function apiSuccess(array $data, string $message = 'Thành công.', int $status = 200): array
{
    return ['status' => $status, 'headers' => [], 'body' => [
        'success' => true, 'message' => $message, 'data' => $data,
    ]];
}

// Giữ fields là JSON object kể cả khi không có lỗi field.
function apiFailure(ApiException $error): array
{
    return ['status' => $error->status, 'headers' => [], 'body' => [
        'success' => false, 'message' => $error->getMessage(),
        'errors' => ['code' => $error->errorCode, 'fields' => (object) $error->fields],
    ]];
}
