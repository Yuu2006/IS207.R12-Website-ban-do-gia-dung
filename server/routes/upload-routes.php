<?php

require_once __DIR__ . '/../controllers/upload-controller.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

function handleUploadRoutes(string $method, string $path): bool
{
    if ($path === '/api/uploads/images' && $method === 'POST') {
        // Ảnh đại diện, review và checklist thuộc khách/tài khoản đã đăng nhập; ảnh catalog/banner chỉ ADMIN.
        $type = $_POST['type'] ?? '';
        if ($type === 'avatars') requireSessionRole(AUTH_ROLES);
        elseif (in_array($type, ['reviews', 'checklists', 'returns'], true)) requireSessionRole(['CUSTOMER']);
        else requireAdmin();
        uploadImage();
        return true;
    }

    return false;
}
