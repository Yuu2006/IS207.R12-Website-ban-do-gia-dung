<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

function paymentRoutes(): array
{
    return [
        ['method' => 'GET', 'path' => '/payments/vnpay/attempts/{paymentCode}', 'pattern' => '~^/payments/vnpay/attempts/([^/]+)$~D', 'roles' => ['CUSTOMER'], 'controller' => 'payment', 'action' => 'getAttempt', 'schema' => 'payment-attempt'],
    ];
}
