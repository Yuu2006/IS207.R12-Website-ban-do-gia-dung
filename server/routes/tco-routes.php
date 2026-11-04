<?php
declare(strict_types=1);

require_once __DIR__ . '/../controllers/tco-controller.php';

/** Routes TCO requests; anonymous visitors and signed-in users may calculate public product estimates. */
function handleTcoRoutes(string $method, string $path): bool
{
    if ($method === 'POST' && $path === '/api/tco/calculate') {
        calculateTcoRequest();
        return true;
    }

    return false;
}
