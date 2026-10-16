<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

// Hai route checkout dành cho CUSTOMER, dùng chung CSRF và validation dispatcher.
function checkoutRoutes(): array
{
    return [
        ['method' => 'POST', 'path' => '/checkout/quote', 'pattern' => '~^/checkout/quote$~D', 'roles' => ['CUSTOMER'], 'controller' => 'checkout', 'action' => 'quoteCheckout', 'schema' => 'quote'],
        ['method' => 'POST', 'path' => '/checkout/orders', 'pattern' => '~^/checkout/orders$~D', 'roles' => ['CUSTOMER'], 'controller' => 'checkout', 'action' => 'createOrder', 'schema' => 'create'],
    ];
}
