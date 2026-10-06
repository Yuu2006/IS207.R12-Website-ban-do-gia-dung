<?php
declare(strict_types=1);

// Lỗi nghiệp vụ có status và lỗi theo trường; không gửi exception hệ thống ra client.
class ApiException extends RuntimeException
{
    public function __construct(string $message, public int $status = 422, public array $errors = [])
    {
        parent::__construct($message);
    }
}

function respondJson(mixed $data, string $message = 'Thành công.', int $status = 200): void
{
    http_response_code($status);
    echo json_encode(['success' => true, 'message' => $message, 'data' => $data], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
}
