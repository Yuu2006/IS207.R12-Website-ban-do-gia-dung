<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

// Customer-only cart endpoints consumed by storefront and checkout.
function cartRoutes(): array
{
    return [
        ['method' => 'GET', 'path' => '/cart', 'pattern' => '~^/cart$~D', 'roles' => ['CUSTOMER'], 'controller' => 'cart', 'action' => 'getCart', 'schema' => 'cart'],
        ['method' => 'POST', 'path' => '/cart/items', 'pattern' => '~^/cart/items$~D', 'roles' => ['CUSTOMER'], 'controller' => 'cart', 'action' => 'addItem', 'schema' => 'cart-add'],
        ['method' => 'PATCH', 'path' => '/cart/items/{variantId}', 'pattern' => '~^/cart/items/([^/]+)$~D', 'roles' => ['CUSTOMER'], 'controller' => 'cart', 'action' => 'updateItem', 'schema' => 'cart-update'],
        ['method' => 'DELETE', 'path' => '/cart/items/{variantId}', 'pattern' => '~^/cart/items/([^/]+)$~D', 'roles' => ['CUSTOMER'], 'controller' => 'cart', 'action' => 'removeItem', 'schema' => 'cart-remove'],
    ];
}
