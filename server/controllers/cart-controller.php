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

    // Add one selected SKU using the authenticated customer's cart version.
    public function addItem(array $request): array
    {
        return apiSuccess($this->service->addItem($request['principal'], $request['input'], $request['idempotencyKey']));
    }

    // Set one owned cart line to an absolute quantity; the service rechecks current stock and version.
    public function updateItem(array $request): array
    {
        return apiSuccess($this->service->updateItem($request['principal'], $request['variantId'], $request['input'], $request['idempotencyKey']));
    }

    // Remove one SKU line from the authenticated customer's cart.
    public function removeItem(array $request): array
    {
        return apiSuccess($this->service->removeItem($request['principal'], $request['variantId'], $request['input'], $request['idempotencyKey']));
    }
}
