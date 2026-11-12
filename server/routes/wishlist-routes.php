<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

function wishlistRoutes(): array
{
    return [
        [
            'method' => 'GET',
            'path' => '/wishlist',
            'pattern' => '~^/wishlist$~D',
            'roles' => ['CUSTOMER'],
            'controller' => 'wishlist',
            'action' => 'getWishlist',
            'schema' => 'wishlist-read'
        ],
        [
            'method' => 'POST',
            'path' => '/wishlist',
            'pattern' => '~^/wishlist$~D',
            'roles' => ['CUSTOMER'],
            'controller' => 'wishlist',
            'action' => 'add',
            'schema' => 'wishlist-add'
        ],
        [
            'method' => 'DELETE',
            'path' => '/wishlist/{productId}',
            'pattern' => '~^/wishlist/([1-9][0-9]*)$~D',
            'roles' => ['CUSTOMER'],
            'controller' => 'wishlist',
            'action' => 'remove',
            'schema' => 'wishlist-delete'
        ],
        [
            'method' => 'POST',
            'path' => '/wishlist/{productId}/move-to-cart',
            'pattern' => '~^/wishlist/([1-9][0-9]*)/move-to-cart$~D',
            'roles' => ['CUSTOMER'],
            'controller' => 'wishlist',
            'action' => 'moveToCart',
            'schema' => 'wishlist-move'
        ]
    ];
}
