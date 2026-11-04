<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

// Keep response formatting out of the cart service and HTTP router.
final class CartController
{
    public function __construct(private readonly CartServiceInterface $service) {}

    // Return the authenticated customer's current cart contract.
    public function getCart(array $request): array
    {
        return apiSuccess($this->service->getCart($request['principal']));
    }
}
