<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

// Khách chỉ đi endpoint khách; SALES/ADMIN có endpoint và role guard riêng.
function orderRoutes(): array
{
    return [
        ['method' => 'GET', 'path' => '/orders', 'pattern' => '~^/orders$~D', 'roles' => ['CUSTOMER'], 'controller' => 'order', 'action' => 'listCustomerOrders', 'schema' => 'list'],
        ['method' => 'GET', 'path' => '/orders/{orderId}', 'pattern' => '~^/orders/([^/]+)$~D', 'roles' => ['CUSTOMER'], 'controller' => 'order', 'action' => 'getCustomerOrder', 'schema' => 'detail'],
        ['method' => 'POST', 'path' => '/orders/{orderId}/cancel', 'pattern' => '~^/orders/([^/]+)/cancel$~D', 'roles' => ['CUSTOMER'], 'controller' => 'order', 'action' => 'cancelOrder', 'schema' => 'cancel'],
        ['method' => 'POST', 'path' => '/orders/{orderId}/reorder', 'pattern' => '~^/orders/([^/]+)/reorder$~D', 'roles' => ['CUSTOMER'], 'controller' => 'order', 'action' => 'reorder', 'schema' => 'reorder'],
        ['method' => 'POST', 'path' => '/orders/{orderId}/returns', 'pattern' => '~^/orders/([^/]+)/returns$~D', 'roles' => ['CUSTOMER'], 'controller' => 'order', 'action' => 'createReturnRequest', 'schema' => 'return'],
        ['method' => 'GET', 'path' => '/sales/orders', 'pattern' => '~^/sales/orders$~D', 'roles' => ['SALES', 'ADMIN'], 'controller' => 'order', 'action' => 'listSalesOrders', 'schema' => 'sales-list'],
        ['method' => 'GET', 'path' => '/sales/orders/{orderId}', 'pattern' => '~^/sales/orders/([^/]+)$~D', 'roles' => ['SALES', 'ADMIN'], 'controller' => 'order', 'action' => 'getSalesOrder', 'schema' => 'detail'],
        ['method' => 'PATCH', 'path' => '/sales/orders/{orderId}/status', 'pattern' => '~^/sales/orders/([^/]+)/status$~D', 'roles' => ['SALES', 'ADMIN'], 'controller' => 'order', 'action' => 'updateSalesStatus', 'schema' => 'status'],
    ];
}
