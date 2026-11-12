<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

// CUS-11 wishlist for the signed-in CUSTOMER; cart writes go through the shared CartService (stock, version, idempotency).
final class WishlistService
{
    public function __construct(
        private readonly \PDO $pdo,
        private readonly WishlistModel $wishlistModel,
        private readonly CartServiceInterface $cartService,
    ) {}

    private function requireCustomer(array $principal): int
    {
        (new OrderModel($this->pdo))->requireActor($principal, ['CUSTOMER']);
        return (int) $principal['id'];
    }

    public function getWishlist(array $principal): array
    {
        return $this->wishlistModel->getByUserId($this->requireCustomer($principal));
    }

    public function add(array $principal, int $productId): array
    {
        $userId = $this->requireCustomer($principal);
        if (!$this->wishlistModel->activeProductExists($productId)) throw new ApiException(404, 'PRODUCT_NOT_FOUND', 'Sản phẩm không tồn tại hoặc đã ngừng bán.');
        $this->wishlistModel->add($userId, $productId);
        return ['productId' => (string) $productId, 'saved' => true];
    }

    // Removing an item that is not saved is a no-op, so retries stay safe.
    public function remove(array $principal, int $productId): array
    {
        $this->wishlistModel->remove($this->requireCustomer($principal), $productId);
        return ['productId' => (string) $productId, 'saved' => false];
    }

    public function moveToCart(array $principal, int $productId, int $skuId, int $quantity, string $idempotencyKey): array
    {
        $userId = $this->requireCustomer($principal);
        if (!$this->wishlistModel->exists($userId, $productId)) throw new ApiException(404, 'WISHLIST_ITEM_NOT_FOUND', 'Sản phẩm không có trong danh sách yêu thích.');
        if (!$this->wishlistModel->skuBelongsToProduct($skuId, $productId)) throw new ApiException(422, 'SKU_PRODUCT_MISMATCH', 'Phiên bản không thuộc sản phẩm này.', ['skuId' => 'Hãy chọn phiên bản của sản phẩm đã lưu.']);
        $cart = $this->cartService->getCart($principal);
        $updated = $this->cartService->addItem($principal, ['variantId' => (string) $skuId, 'quantity' => $quantity, 'expectedCartVersion' => (int) $cart['cartVersion']], $idempotencyKey);
        return ['productId' => (string) $productId, 'cart' => $updated];
    }
}
