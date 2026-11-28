<?php
declare(strict_types=1);

require_once __DIR__ . '/../services/review-service.php';
require_once __DIR__ . '/../models/review-model.php';

function reviewRequestBody(): array
{
    $raw = file_get_contents('php://input', false, null, 0, 65537);
    if ($raw === false || strlen($raw) > 65536) throw new ApiException('Request quá lớn.', 413);
    try { $decoded = json_decode($raw, false, 32, JSON_THROW_ON_ERROR); }
    catch (JsonException) { throw new ApiException('JSON chưa hợp lệ.', 400); }
    if (!$decoded instanceof stdClass) throw new ApiException('Request phải là JSON object.', 422);
    return get_object_vars($decoded);
}

function reviewService(): ReviewService
{
    return new ReviewService(new ReviewModel(db()));
}

function reviewPublicList(int $productId, array $query): void { respondJson(reviewService()->publicList($productId, $query)); }
function reviewEligible(array $actor, array $query): void { respondJson(reviewService()->eligible($actor, $query)); }
function reviewCreate(array $actor, array $input): void { respondJson(reviewService()->create($actor, $input), 'Đã gửi đánh giá.', 201); }
function reviewCreateFollowup(array $actor, int $reviewId, array $input): void { respondJson(reviewService()->createFollowup($actor, $reviewId, $input), 'Đã gửi cập nhật trải nghiệm.', 201); }
function reviewAdminList(array $query): void { respondJson(reviewService()->adminList($query)); }
function reviewSetVisibility(array $actor, int $reviewId, array $input): void { respondJson(reviewService()->setVisibility($actor, $reviewId, $input)); }
