<?php
declare(strict_types=1);

require_once __DIR__ . '/../controllers/review-controller.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

function handleReviewRoutes(string $method, string $path): bool
{
    if (preg_match('#^/api/products/(\d+)/reviews$#', $path, $match)) {
        if ($method !== 'GET') throw new ApiException('HTTP method không hỗ trợ.', 405);
        reviewPublicList((int) $match[1], $_GET);
        return true;
    }

    if ($path === '/api/reviews/eligible' && $method === 'GET') {
        $actor = requireSessionRole(['CUSTOMER']);
        reviewEligible($actor, $_GET);
        return true;
    }
    if ($path === '/api/reviews' && $method === 'POST') {
        $actor = requireSessionRole(['CUSTOMER']);
        reviewCreate($actor, reviewRequestBody());
        return true;
    }
    if (preg_match('#^/api/reviews/(\d+)/followups$#', $path, $match)) {
        $actor = requireSessionRole(['CUSTOMER']);
        if ($method !== 'POST') throw new ApiException('HTTP method không hỗ trợ.', 405);
        reviewCreateFollowup($actor, (int) $match[1], reviewRequestBody());
        return true;
    }
    if ($path === '/api/admin/reviews' && $method === 'GET') {
        requireAdmin();
        reviewAdminList($_GET);
        return true;
    }
    if (preg_match('#^/api/admin/reviews/(\d+)/visibility$#', $path, $match)) {
        $actor = requireAdmin();
        if ($method !== 'PATCH') throw new ApiException('HTTP method không hỗ trợ.', 405);
        reviewSetVisibility($actor, (int) $match[1], reviewRequestBody());
        return true;
    }

    return false;
}
