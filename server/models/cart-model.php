<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class CartModel
{
private \PDO $pdo;

public function __construct(\PDO $pdo)
    {
        $this->pdo = $pdo;
    }

    // Kiểm tra người dùng có quyền CUSTOMER.
    public function requireCustomer(array $principal): void
    {
        (new OrderModel($this->pdo))->requireActor(
            $principal,
            ['CUSTOMER']
        );
    }

    // Lấy giỏ hàng của khách hàng.
    public function get(array $principal): array
    {
        $dependencies = new CatalogCheckoutDependencies();

        $cart = $dependencies->cart(
            $this->pdo,
            $principal
        );

        return $this->withTotals($cart);
    }

    // Tính tổng tiền dựa trên giá do backend truy vấn.
    private function withTotals(array $cart): array
    {
        $subtotal = 0;

        foreach ($cart['items'] as $item) {
            $subtotal += orderLineTotal(
                $item['unitPrice'],
                $item['quantity']
            );
        }

        $cart['totals'] = [
            'subtotal' => $subtotal,
            'discount' => 0,
            'shipping' => 0,
            'total' => $subtotal
        ];

        return $cart;
    }

    // Thay thế danh sách SKU trong giỏ hàng.
    public function replace(
        array $principal,
        array $input,
        string $key
    ): array {
        $dependencies = new CatalogCheckoutDependencies();

        $cart = $dependencies->replaceCart(
            $this->pdo,
            $principal,
            $input,
            $key
        );

        return $this->withTotals($cart);
    }
}
