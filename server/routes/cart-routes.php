<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

function cartRoutes(): array
{
    return [
        [
            'method' => 'GET',
            'path' => '/cart',
            'pattern' => '~^/cart$~D',
            'roles' => ['CUSTOMER'],
            'controller' => 'cart',
            'action' => 'getCart',
            'schema' => 'cart-read'
        ],
        [
            'method' => 'PUT',
            'path' => '/cart',
            'pattern' => '~^/cart$~D',
            'roles' => ['CUSTOMER'],
            'controller' => 'cart',
            'action' => 'replaceCart',
            'schema' => 'cart-replace'
        ]
    ];
}
