<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

interface CartServiceInterface
{
    public function getCart(array $principal): array;
    public function addItem(array $principal, array $input, string $key): array;
    public function updateItem(array $principal, string $variantId, array $input, string $key): array;
    public function removeItem(array $principal, string $variantId, array $input, string $key): array;
}

// Expose the signed-in customer's server cart through the same catalog/checkout adapter.
final class CartService implements CartServiceInterface
{
    public function __construct(private readonly ?OrderModel $orders = null, private readonly ?MysqlCheckoutDependencies $dependencies = null) {}

    // Read only this active CUSTOMER's cart; do not fabricate data or create rows on GET.
    public function getCart(array $principal): array
    {
        if ($this->orders === null || $this->dependencies === null) throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Dịch vụ giỏ hàng chưa sẵn sàng.');
        $this->orders->requireActor($principal, ['CUSTOMER']);
        return $this->dependencies->getCart($this->orders->pdo, $principal);
    }

    // Deduplicate repeated clicks and commit the SKU merge under the same cart transaction.
    public function addItem(array $principal, array $input, string $key): array
    {
        if ($this->orders === null || $this->dependencies === null) throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Dịch vụ giỏ hàng chưa sẵn sàng.');
        $this->orders->requireActor($principal, ['CUSTOMER']);
        return (new OrderIdempotencyModel($this->orders->pdo))->run($principal, 'cart:add-item', $key, $input, fn () => $this->dependencies->addCartItem($this->orders->pdo, $principal, $input));
    }

    // Change one cart line idempotently without reserving inventory or trusting client stock values.
    public function updateItem(array $principal, string $variantId, array $input, string $key): array
    {
        if ($this->orders === null || $this->dependencies === null) throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Dịch vụ giỏ hàng chưa sẵn sàng.');
        $this->orders->requireActor($principal, ['CUSTOMER']);
        $variantId = orderDatabaseId($variantId, 'variantId');
        $input = validateCartUpdate($input);
        return (new OrderIdempotencyModel($this->orders->pdo))->run(
            $principal,
            'cart:update-item:' . $variantId,
            $key,
            $input,
            fn () => $this->dependencies->updateCartItem($this->orders->pdo, $principal, $variantId, $input),
        );
    }

    // Remove one owned SKU line even when its catalog item is no longer sellable.
    public function removeItem(array $principal, string $variantId, array $input, string $key): array
    {
        if ($this->orders === null || $this->dependencies === null) throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Dịch vụ giỏ hàng chưa sẵn sàng.');
        $this->orders->requireActor($principal, ['CUSTOMER']);
        $variantId = orderDatabaseId($variantId, 'variantId');
        $input = validateCartRemove($input);
        return (new OrderIdempotencyModel($this->orders->pdo))->run(
            $principal,
            'cart:remove-item:' . $variantId,
            $key,
            $input,
            fn () => $this->dependencies->removeCartItem($this->orders->pdo, $principal, $variantId, $input),
        );
    }
}
