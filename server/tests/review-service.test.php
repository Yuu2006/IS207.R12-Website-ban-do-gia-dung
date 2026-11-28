<?php
declare(strict_types=1);

require_once __DIR__ . '/../utils/response.php';
require_once __DIR__ . '/../models/review-model.php';
require_once __DIR__ . '/../services/review-service.php';

final class ReviewServiceStub extends ReviewModel
{
    public array $created = [];
    public array $followup = [];
    public function __construct() {}
    public function listPublic(int $productId, array $filters, int $page, int $pageSize): array { return ['items' => [], 'pagination' => compact('page', 'pageSize')]; }
    public function eligibleItems(int $customerId, int $productId): array { return []; }
    public function createReview(int $customerId, array $review, array $photos): array { $this->created = compact('customerId', 'review', 'photos'); return ['id' => 4]; }
    public function createFollowup(int $customerId, int $reviewId, int $milestone, array $context): array { $this->followup = compact('customerId', 'reviewId', 'milestone', 'context'); return ['reviewId' => $reviewId]; }
    public function listAdmin(array $filters, int $page, int $pageSize): array { return ['items' => [], 'pagination' => compact('page', 'pageSize')]; }
}

function reviewTest(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
function reviewRejected(callable $callback, int $status, string $message): void
{
    try { $callback(); } catch (ApiException $error) { reviewTest($error->status === $status, $message . ' (wrong status)'); return; }
    throw new RuntimeException($message . ' (request accepted)');
}

$model = new ReviewServiceStub(); $service = new ReviewService($model); $customer = ['id' => 27, 'role' => 'CUSTOMER'];
$service->create($customer, ['orderItemId' => '10', 'rating' => 5, 'content' => 'Dùng tốt, lắp đặt thuận tiện.', 'photos' => ['/uploads/reviews/' . str_repeat('a', 32) . '.png'], 'context' => ['roomAreaM2' => 20.5, 'householdSize' => 4]]);
reviewTest($model->created['customerId'] === 27 && $model->created['review']['rating'] === 5 && count($model->created['photos']) === 1, 'Review input should normalize and delegate for the authenticated customer.');
reviewRejected(fn() => $service->create($customer, ['orderItemId' => 10, 'rating' => 6, 'content' => 'Good', 'photos' => [], 'context' => []]), 422, 'Rating outside 1–5 must fail');
reviewRejected(fn() => $service->create($customer, ['orderItemId' => 10, 'rating' => 5, 'content' => 'Good', 'photos' => ['/uploads/products/' . str_repeat('a', 32) . '.png'], 'context' => []]), 422, 'Catalog photo URLs must not be accepted as review uploads');
reviewRejected(fn() => $service->createFollowup($customer, 9, ['milestoneDays' => 45, 'context' => []]), 422, 'Unsupported follow-up milestone must fail');
reviewRejected(fn() => $service->createFollowup($customer, 9, ['milestoneDays' => 90, 'context' => ['householdSize' => 3]]), 422, 'REV-03 requires all context fields');
$service->createFollowup($customer, 9, ['milestoneDays' => 30, 'context' => ['roomAreaM2' => 22, 'householdSize' => 3, 'usageFrequency' => 'DAILY', 'noisePerception' => 'QUIET', 'consumptionPerception' => 'AS_EXPECTED', 'cleaningEase' => 'EASY']]);
reviewTest($model->followup['customerId'] === 27 && $model->followup['reviewId'] === 9 && $model->followup['milestone'] === 30, 'Valid REV-03 context should delegate without editing the original review.');
reviewRejected(fn() => $service->setVisibility(['id' => 3], 2, ['isVisible' => false, 'reason' => '  ']), 422, 'Moderation requires a reason');
echo "PASS review-service validation and dispatch\n";
