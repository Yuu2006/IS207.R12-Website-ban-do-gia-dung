<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class WishlistService
{
    private \PDO $pdo;
    private WishlistModel $wishlistModel;
    private CartServiceInterface $cartService;

    public function __construct(
        \PDO $pdo,
        WishlistModel $wishlistModel,
        CartServiceInterface $cartService
    ) {
        $this->pdo = $pdo;
        $this->wishlistModel = $wishlistModel;
        $this->cartService = $cartService;
    }

    // Kiểm tra quyền CUSTOMER.
    private function requireCustomer(array $principal): int
    {
        (new OrderModel($this->pdo))->requireActor(
            $principal,
            ['CUSTOMER']
        );

        $userId = (int) ($principal['id'] ?? 0);

        if ($userId <= 0) {
            throw new ApiException(
                401,
                'UNAUTHORIZED',
                'Không xác định được khách hàng.'
            );
        }

        return $userId;
    }

    // Lấy danh sách yêu thích.
    public function getWishlist(array $principal): array
    {
        $userId = $this->requireCustomer($principal);

        return $this->wishlistModel->getByUserId($userId);
    }

    // Thêm sản phẩm vào wishlist.
    public function add(
        array $principal,
        int $productId
    ): array {
        $userId = $this->requireCustomer($principal);

        if ($productId <= 0) {
            throw new ApiException(
                422,
                'INVALID_PRODUCT',
                'Mã sản phẩm không hợp lệ.'
            );
        }

        if (!$this->wishlistModel->add($userId, $productId)) {
            throw new ApiException(
                500,
                'WISHLIST_ADD_FAILED',
                'Không thể thêm sản phẩm vào yêu thích.'
            );
        }

        return [
            'success' => true,
            'productId' => $productId
        ];
    }

    // Xóa sản phẩm khỏi wishlist.
    public function remove(
        array $principal,
        int $productId
    ): array {
        $userId = $this->requireCustomer($principal);

        if ($productId <= 0) {
            throw new ApiException(
                422,
                'INVALID_PRODUCT',
                'Mã sản phẩm không hợp lệ.'
            );
        }

        $this->wishlistModel->remove($userId, $productId);

        return [
            'success' => true,
            'productId' => $productId
        ];
    }

    // Chuyển sản phẩm yêu thích sang giỏ hàng.
    public function moveToCart(
        array $principal,
        int $productId,
        int $skuId,
        int $quantity,
        string $idempotencyKey
    ): array {
        $userId = $this->requireCustomer($principal);

        if (
            $productId <= 0 ||
            $skuId <= 0 ||
            $quantity <= 0
        ) {
            throw new ApiException(
                422,
                'INVALID_CART_ITEM',
                'Thông tin sản phẩm chuyển sang giỏ hàng không hợp lệ.'
            );
        }

        if (!$this->wishlistModel->exists($userId, $productId)) {
            throw new ApiException(
                404,
                'WISHLIST_ITEM_NOT_FOUND',
                'Sản phẩm không có trong danh sách yêu thích.'
            );
        }

        // Lấy giỏ hàng hiện tại.
        $cart = $this->cartService->getCart($principal);

        $items = [];

        foreach ($cart['items'] as $item) {
            $items[] = [
                'skuId' => (int) $item['skuId'],
                'quantity' => (int) $item['quantity']
            ];
        }

        // Nếu SKU đã tồn tại thì cộng số lượng.
        $found = false;

        foreach ($items as &$item) {
            if ($item['skuId'] === $skuId) {
                $item['quantity'] += $quantity;
                $found = true;
                break;
            }
        }

        unset($item);

        if (!$found) {
            $items[] = [
                'skuId' => $skuId,
                'quantity' => $quantity
            ];
        }

        // Backend kiểm tra lại giá và tồn kho khi cập nhật giỏ.
        $updatedCart = $this->cartService->replaceCart(
    $principal,
    [
        'expectedCartVersion' => $cart['cartVersion'],
        'items' => $items,
    ],
    $idempotencyKey
);

        return [
            'success' => true,
            'cart' => $updatedCart
        ];
    }
}
