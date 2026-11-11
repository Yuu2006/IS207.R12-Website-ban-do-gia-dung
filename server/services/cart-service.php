<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

interface CartServiceInterface
{
    public function getCart(array $principal): array;

    public function replaceCart(
        array $principal,
        array $input,
        string $key
    ): array;
}

final class CartService implements CartServiceInterface
{
    private ?CartModel $model;

    public function __construct(?CartModel $model = null)
    {
        $this->model = $model;
    }

    private function ready(array $principal): CartModel
    {
        if ($this->model === null) {
            throw new ApiException(
                503,
                'SERVICE_UNAVAILABLE',
                'Dịch vụ giỏ hàng chưa sẵn sàng.'
            );
        }

        $this->model->requireCustomer($principal);

        return $this->model;
    }

    public function getCart(array $principal): array
    {
        return $this->ready($principal)->get($principal);
    }

    public function replaceCart(
        array $principal,
        array $input,
        string $key
    ): array {
        orderIdempotencyKey([
            'idempotency-key' => $key
        ]);

        return $this->ready($principal)->replace(
            $principal,
            $input,
            $key
        );
    }
}
