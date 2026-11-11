<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class CartController
{
    private CartServiceInterface $service;

    public function __construct(CartServiceInterface $service)
    {
        $this->service = $service;
    }

    // GET /cart
    public function getCart(array $request): array
    {
        return apiSuccess(
            $this->service->getCart($request['principal'])
        );
    }

    // PUT /cart
    public function replaceCart(array $request): array
    {
        return apiSuccess(
            $this->service->replaceCart(
                $request['principal'],
                $request['input'],
                $request['idempotencyKey']
            )
        );
    }
}
