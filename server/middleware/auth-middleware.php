<?php
declare(strict_types=1);
require_once __DIR__ . '/../utils/response.php';

// Principal chỉ lấy từ phiên máy chủ hoặc truyền trực tiếp trong kiểm tra CLI.
function requirePrincipal(?array $principal): array
{
    if (!$principal || !is_string($principal['id'] ?? null) || $principal['id'] === '' ||
        ($principal['status'] ?? '') !== 'ACTIVE' || !is_int($principal['expiresAt'] ?? null) ||
        $principal['expiresAt'] <= time()) {
        throw new ApiException('Bạn cần đăng nhập hoặc phiên đã hết hạn.', 401);
    }
    return $principal;
}
