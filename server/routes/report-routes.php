<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

function reportRoutes(): array
{
    return [
        ['method' => 'GET', 'path' => '/admin/reports/revenue.csv', 'pattern' => '~^/admin/reports/revenue\.csv$~D', 'roles' => ['ADMIN'], 'controller' => 'report', 'action' => 'revenueCsv', 'schema' => 'report-range'],
    ];
}
