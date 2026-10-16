<?php

require_once __DIR__ . '/../controllers/upload-controller.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

function handleUploadRoutes(string $method, string $path): bool
{
    if ($path === '/api/uploads/images' && $method === 'POST') {
        // Ảnh đại diện: mọi tài khoản đăng nhập (CUS-04); ảnh catalog/banner: chỉ ADMIN.
        ($_POST['type'] ?? '') === 'avatars' ? requireSessionRole(AUTH_ROLES) : requireAdmin();
        uploadImage();
        return true;
    }

    return false;
}
