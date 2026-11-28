<?php
declare(strict_types=1);

require_once __DIR__ . '/../utils/response.php';

final class ReviewService
{
    private const USAGE = ['RARELY', 'FEW_TIMES_WEEK', 'DAILY', 'MULTIPLE_DAILY'];
    private const NOISE = ['QUIET', 'ACCEPTABLE', 'NOISY', 'VERY_NOISY'];
    private const CONSUMPTION = ['LOWER_THAN_EXPECTED', 'AS_EXPECTED', 'HIGHER_THAN_EXPECTED', 'UNKNOWN'];
    private const CLEANING = ['EASY', 'ACCEPTABLE', 'DIFFICULT', 'NOT_APPLICABLE'];
    private int $maxImages;

    public function __construct(private ReviewModel $model)
    {
        $configured = getenv('REVIEW_MAX_IMAGES');
        $this->maxImages = $configured !== false && ctype_digit($configured) ? max(0, min(10, (int) $configured)) : 5;
    }

    // Public reviews can be filtered by rating and non-identifying use context.
    public function publicList(int $productId, array $query): array
    {
        if ($productId < 1) throw new ApiException('ID sản phẩm không hợp lệ.', 422);
        $allowed = ['rating', 'usageFrequency', 'noisePerception', 'consumptionPerception', 'cleaningEase', 'minRoomAreaM2', 'maxRoomAreaM2', 'householdSize', 'page', 'pageSize'];
        $this->onlyKeys($query, $allowed);
        $filters = [];
        if (($query['rating'] ?? '') !== '') $filters['rating'] = $this->enumInt($query['rating'], 1, 5, 'rating');
        foreach (['usageFrequency' => self::USAGE, 'noisePerception' => self::NOISE, 'consumptionPerception' => self::CONSUMPTION, 'cleaningEase' => self::CLEANING] as $key => $options) if (($query[$key] ?? '') !== '') $filters[$key] = $this->enum($query[$key], $options, $key);
        foreach (['minRoomAreaM2', 'maxRoomAreaM2'] as $key) if (($query[$key] ?? '') !== '') $filters[$key] = $this->decimal($query[$key], 0.1, 1000, $key);
        if (($query['householdSize'] ?? '') !== '') $filters['householdSize'] = $this->enumInt($query['householdSize'], 1, 30, 'householdSize');
        if (isset($filters['minRoomAreaM2'], $filters['maxRoomAreaM2']) && $filters['minRoomAreaM2'] > $filters['maxRoomAreaM2']) throw new ApiException('Khoảng diện tích phòng không hợp lệ.', 422);
        return $this->model->listPublic($productId, $filters, $this->page($query['page'] ?? 1), $this->pageSize($query['pageSize'] ?? 10));
    }

    // Returns reviewable order lines plus due REV-03 reflection windows for this customer and product.
    public function eligible(array $actor, array $query): array
    {
        $this->onlyKeys($query, ['productId']);
        $productId = $this->positiveInt($query['productId'] ?? null, 'productId');
        return ['items' => $this->model->eligibleItems((int) $actor['id'], $productId), 'maxImages' => $this->maxImages];
    }

    // Initial review data is immutable after submission; later changes use the milestone context endpoint.
    public function create(array $actor, array $input): array
    {
        $this->onlyKeys($input, ['orderItemId', 'rating', 'content', 'photos', 'context']);
        $review = [
            'orderItemId' => $this->positiveInt($input['orderItemId'] ?? null, 'orderItemId'),
            'rating' => $this->enumInt($input['rating'] ?? null, 1, 5, 'rating'),
            'content' => $this->text($input['content'] ?? null, 1, 3000, 'content'),
            'context' => $this->context($input['context'] ?? [], false),
        ];
        return $this->model->createReview((int) $actor['id'], $review, $this->photos($input['photos'] ?? []));
    }

    // A customer may submit one context-only update in each valid 30/90-day window.
    public function createFollowup(array $actor, int $reviewId, array $input): array
    {
        $this->onlyKeys($input, ['milestoneDays', 'context']);
        $milestone = $this->enumInt($input['milestoneDays'] ?? null, 30, 90, 'milestoneDays');
        if (!in_array($milestone, [30, 90], true)) throw new ApiException('Mốc cập nhật chỉ có thể là 30 hoặc 90 ngày.', 422);
        return $this->model->createFollowup((int) $actor['id'], $reviewId, $milestone, $this->context($input['context'] ?? [], true));
    }

    // Moderation only changes visibility and always records a reason in the audit log.
    public function setVisibility(array $actor, int $reviewId, array $input): array
    {
        $this->onlyKeys($input, ['isVisible', 'reason']);
        if (!is_bool($input['isVisible'] ?? null)) throw new ApiException('isVisible phải là true hoặc false.', 422);
        return $this->model->setVisibility($reviewId, (int) $actor['id'], $input['isVisible'], $this->text($input['reason'] ?? null, 3, 500, 'reason'));
    }

    // Admin list supports visibility and rating filters without content-edit operations.
    public function adminList(array $query): array
    {
        $this->onlyKeys($query, ['visibility', 'rating', 'page', 'pageSize']);
        if (!in_array($query['visibility'] ?? '', ['', 'visible', 'hidden'], true)) throw new ApiException('visibility không hợp lệ.', 422);
        $filters = ['visibility' => $query['visibility'] ?? ''];
        if (($query['rating'] ?? '') !== '') $filters['rating'] = $this->enumInt($query['rating'], 1, 5, 'rating');
        return $this->model->listAdmin($filters, $this->page($query['page'] ?? 1), $this->pageSize($query['pageSize'] ?? 20));
    }

    private function context(mixed $value, bool $required): array
    {
        if ($value instanceof stdClass) $value = get_object_vars($value);
        if (!is_array($value) || (array_is_list($value) && $value !== [])) throw new ApiException('context phải là một object.', 422);
        $keys = ['roomAreaM2', 'householdSize', 'usageFrequency', 'noisePerception', 'consumptionPerception', 'cleaningEase'];
        $this->onlyKeys($value, $keys);
        $normalized = [];
        $normalized['roomAreaM2'] = $this->optionalDecimal($value['roomAreaM2'] ?? null, 0.1, 1000, 'roomAreaM2', $required);
        $normalized['householdSize'] = $this->optionalInt($value['householdSize'] ?? null, 1, 30, 'householdSize', $required);
        $normalized['usageFrequency'] = $this->optionalEnum($value['usageFrequency'] ?? null, self::USAGE, 'usageFrequency', $required);
        $normalized['noisePerception'] = $this->optionalEnum($value['noisePerception'] ?? null, self::NOISE, 'noisePerception', $required);
        $normalized['consumptionPerception'] = $this->optionalEnum($value['consumptionPerception'] ?? null, self::CONSUMPTION, 'consumptionPerception', $required);
        $normalized['cleaningEase'] = $this->optionalEnum($value['cleaningEase'] ?? null, self::CLEANING, 'cleaningEase', $required);
        return $normalized;
    }

    private function photos(mixed $value): array
    {
        if (!is_array($value) || (array_is_list($value) === false && $value !== [])) throw new ApiException('photos phải là danh sách URL ảnh.', 422);
        if (count($value) > $this->maxImages) throw new ApiException("Mỗi đánh giá được đính kèm tối đa {$this->maxImages} ảnh.", 422);
        $photos = [];
        foreach ($value as $url) {
            if (!is_string($url) || !preg_match('#^/uploads/reviews/[a-f0-9]{32}\.(jpg|png|webp)$#D', $url)) throw new ApiException('Ảnh đánh giá phải được tải lên HomeCare trước khi gửi.', 422);
            $photos[] = $url;
        }
        if (count(array_unique($photos)) !== count($photos)) throw new ApiException('Danh sách ảnh không được trùng.', 422);
        return $photos;
    }

    private function onlyKeys(array $input, array $keys): void { if (array_diff(array_keys($input), $keys)) throw new ApiException('Request chứa trường không được hỗ trợ.', 422); }
    private function positiveInt(mixed $value, string $field): int { $id = filter_var($value, FILTER_VALIDATE_INT); if ($id === false || $id < 1) throw new ApiException("{$field} phải là số nguyên dương.", 422); return $id; }
    private function enumInt(mixed $value, int $min, int $max, string $field): int { $n = filter_var($value, FILTER_VALIDATE_INT); if ($n === false || $n < $min || $n > $max) throw new ApiException("{$field} không hợp lệ.", 422); return $n; }
    private function enum(mixed $value, array $options, string $field): string { if (!is_string($value) || !in_array($value, $options, true)) throw new ApiException("{$field} không hợp lệ.", 422); return $value; }
    private function decimal(mixed $value, float $min, float $max, string $field): float { if (!is_numeric($value) || !is_finite((float) $value) || (float) $value < $min || (float) $value > $max) throw new ApiException("{$field} không hợp lệ.", 422); return (float) $value; }
    private function text(mixed $value, int $min, int $max, string $field): string { if (!is_string($value)) throw new ApiException("{$field} phải là văn bản.", 422); $text = trim($value); $length = mb_strlen($text); if ($length < $min || $length > $max) throw new ApiException("{$field} phải có từ {$min} đến {$max} ký tự.", 422); return $text; }
    private function page(mixed $value): int { $page = filter_var($value, FILTER_VALIDATE_INT); if ($page === false || $page < 1 || $page > 1000000) throw new ApiException('page không hợp lệ.', 422); return $page; }
    private function pageSize(mixed $value): int { $size = filter_var($value, FILTER_VALIDATE_INT); if ($size === false || $size < 1 || $size > 100) throw new ApiException('pageSize phải từ 1 đến 100.', 422); return $size; }
    private function optionalDecimal(mixed $value, float $min, float $max, string $field, bool $required): ?float { if ($value === null || $value === '') { if ($required) throw new ApiException("{$field} là bắt buộc trong cập nhật REV-03.", 422); return null; } return $this->decimal($value, $min, $max, $field); }
    private function optionalInt(mixed $value, int $min, int $max, string $field, bool $required): ?int { if ($value === null || $value === '') { if ($required) throw new ApiException("{$field} là bắt buộc trong cập nhật REV-03.", 422); return null; } return $this->enumInt($value, $min, $max, $field); }
    private function optionalEnum(mixed $value, array $options, string $field, bool $required): ?string { if ($value === null || $value === '') { if ($required) throw new ApiException("{$field} là bắt buộc trong cập nhật REV-03.", 422); return null; } return $this->enum($value, $options, $field); }
}
