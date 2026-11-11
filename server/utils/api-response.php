<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class ApiException extends \RuntimeException
{
    public int $status;
    public string $errorCode;
    public array $fields;

    public function __construct(
        int $status,
        string $errorCode,
        string $message,
        array $fields = []
    ) {
        $this->status = $status;
        $this->errorCode = $errorCode;
        $this->fields = $fields;

        parent::__construct($message);
    }
}

function apiSuccess(array $data, string $message = 'Thành công.', int $status = 200): array
{
    return [
        'status' => $status,
        'headers' => [],
        'body' => [
            'success' => true,
            'message' => $message,
            'data' => $data,
        ],
    ];
}

function apiFailure(ApiException $error): array
{
    return [
        'status' => $error->status,
        'headers' => [],
        'body' => [
            'success' => false,
            'message' => $error->getMessage(),
            'errors' => [
                'code' => $error->errorCode,
                'fields' => (object) $error->fields,
            ],
        ],
    ];
}
