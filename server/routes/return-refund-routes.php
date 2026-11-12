<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

// Return lifecycle endpoints use fixed project roles and server-side ownership.
function returnRefundRoutes(): array
{
    return [
        ['method' => 'GET', 'path' => '/returns', 'pattern' => '~^/returns$~D', 'roles' => ['SALES', 'ADMIN', 'WAREHOUSE'], 'controller' => 'return-refund', 'action' => 'list', 'schema' => 'return-list'],
        ['method' => 'GET', 'path' => '/returns/{returnId}', 'pattern' => '~^/returns/([^/]+)$~D', 'roles' => ['SALES', 'ADMIN', 'WAREHOUSE'], 'controller' => 'return-refund', 'action' => 'detail', 'schema' => 'return-detail'],
        ['method' => 'POST', 'path' => '/sales/returns/{returnId}/triage', 'pattern' => '~^/sales/returns/([^/]+)/triage$~D', 'roles' => ['SALES'], 'controller' => 'return-refund', 'action' => 'triage', 'schema' => 'return-triage'],
        ['method' => 'POST', 'path' => '/admin/returns/{returnId}/decision', 'pattern' => '~^/admin/returns/([^/]+)/decision$~D', 'roles' => ['ADMIN'], 'controller' => 'return-refund', 'action' => 'decide', 'schema' => 'return-decision'],
        ['method' => 'POST', 'path' => '/warehouse/returns/{returnId}/receive', 'pattern' => '~^/warehouse/returns/([^/]+)/receive$~D', 'roles' => ['WAREHOUSE'], 'controller' => 'return-refund', 'action' => 'receive', 'schema' => 'return-receive'],
    ];
}
