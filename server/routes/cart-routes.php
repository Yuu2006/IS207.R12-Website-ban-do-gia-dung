<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

// Customer-only read endpoint consumed by the checkout service.
function cartRoutes(): array
{
    return [
        ['method' => 'GET', 'path' => '/cart', 'pattern' => '~^/cart$~D', 'roles' => ['CUSTOMER'], 'controller' => 'cart', 'action' => 'getCart', 'schema' => 'cart'],
    ];
}
