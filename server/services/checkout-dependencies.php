<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

// Owner adapter must use THIS PDO, no nested commit/transaction, no HTTP inside transaction.
// These interfaces do not register auth/cart/address/voucher endpoints or assume team approval.
interface CheckoutDependencies
{
    // Return trusted quote inputs: cartVersion/items/shippingAddress/totals from server-owned data.
    public function quote(\PDO $pdo, array $principal, array $input): array;
    // Lock cart -> address -> voucher/usage -> SKU (ascending IDs), revalidate price/stock/usage.
    public function lockForCreate(\PDO $pdo, array $principal, array $input): array;
    // Conditional stock decrement + unique movements + voucher usage + clear/version cart, same TX.
    public function commitCheckout(\PDO $pdo, array $principal, array $quote, array $order): void;
    // Order/payment already locked; lock voucher/usage -> SKU and release only tracked reservations.
    public function release(\PDO $pdo, array $principal, array $order, array $items): void;
    // Order already locked; current cart and current active SKU prices/stock, never item snapshots.
    public function reorder(\PDO $pdo, array $principal, array $order, array $items, array $input): array;
}
