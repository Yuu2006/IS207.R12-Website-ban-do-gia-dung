<?php

require_once __DIR__ . '/../controllers/banner-controller.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

function handleBannerRoutes(string $method, string $path): bool
{
    if ($path === '/api/banners' && $method === 'GET') {
        listBanners();
        return true;
    }

    if ($path === '/api/banners' && $method === 'POST') {
        requireAdmin();
        createBanner();
        return true;
    }

    if (preg_match('#^/api/banners/(\d+)$#', $path, $matches)) {
        $id = (int) $matches[1];

        if ($method === 'GET') {
            showBanner($id);
            return true;
        }

        if ($method === 'PUT') {
            requireAdmin();
            updateBanner($id);
            return true;
        }

        if ($method === 'DELETE') {
            requireAdmin();
            deleteBanner($id);
            return true;
        }
    }

    return false;
}
