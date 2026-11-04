<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

interface CartServiceInterface
{
    public function getCart(array $principal): array;
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
}
