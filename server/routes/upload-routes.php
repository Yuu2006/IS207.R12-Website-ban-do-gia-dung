<?php

require_once __DIR__ . '/../controllers/upload-controller.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

function handleUploadRoutes(string $method, string $path): bool
{
    if ($path === '/api/uploads/images' && $method === 'POST') {
        requireAdmin();
        uploadImage();
        return true;
    }

    return false;
}
