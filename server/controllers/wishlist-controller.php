<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class WishlistController
{
    private WishlistService $service;

    public function __construct(WishlistService $service)
    {
        $this->service = $service;
    }

    // GET /wishlist
    public function getWishlist(array $request): array
    {
        return apiSuccess(
            $this->service->getWishlist(
                $request['principal']
            )
        );
    }

    // POST /wishlist
    public function add(array $request): array
    {
        return apiSuccess(
            $this->service->add(
                $request['principal'],
                (int) $request['input']['productId']
            )
        );
    }

    // DELETE /wishlist/{productId}
    public function remove(array $request): array
    {
        return apiSuccess(
            $this->service->remove(
                $request['principal'],
                (int) $request['params']['productId']
            )
        );
    }

    // POST /wishlist/{productId}/move-to-cart
    public function moveToCart(array $request): array
    {
        return apiSuccess(
            $this->service->moveToCart(
                $request['principal'],
                (int) $request['params']['productId'],
                (int) $request['input']['skuId'],
                (int) $request['input']['quantity'],
                $request['idempotencyKey']
            )
        );
    }
}
