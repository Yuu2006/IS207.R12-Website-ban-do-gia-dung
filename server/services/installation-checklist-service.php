<?php
declare(strict_types=1);
require_once __DIR__ . '/../models/installation-checklist-model.php';

final class InstallationChecklistService
{
    // Generic preparation only: the product's official manual remains the source of installation requirements.
    public const ITEMS = [
        'spaceMeasured' => 'Đã đo vị trí đặt và đường vận chuyển, gồm cửa đi qua.',
        'manualReviewed' => 'Đã đối chiếu hướng dẫn lắp đặt chính thức của đúng model.',
        'utilitiesChecked' => 'Đã kiểm tra điện, nước và thoát nước theo yêu cầu của model (nếu áp dụng).',
        'deliveryConfirmed' => 'Đã xác nhận phương án giao/lắp với cửa hàng.',
    ];

    public function __construct(private InstallationChecklistModel $model) {}

    // Returns only the current customer's context and immutable recent revisions.
    public function get(array $actor, array $query): array
    {
        $this->onlyKeys($query, ['productId', 'roomProfileId']);
        [$userId, $productId, $roomId] = $this->scope($actor, $query);
        $row = $this->model->read($userId, $productId, $roomId);
        $result = $this->dto($row, $productId, $roomId);
        $result['history'] = $row ? $this->model->history($userId, (int) $row['id']) : [];
        return $result;
    }

    // Validates the complete template and version before entering the model transaction.
    public function save(array $actor, array $input): array
    {
        $this->onlyKeys($input, ['productId', 'roomProfileId', 'checks', 'expectedVersion', 'requestKey', 'referencePhotoUrl']);
        [$userId, $productId, $roomId] = $this->scope($actor, $input);
        $checks = $input['checks'] ?? null;
        if ($checks instanceof stdClass) $checks = get_object_vars($checks);
        if (!is_array($checks) || count($checks) !== count(self::ITEMS) || array_diff(array_keys($checks), array_keys(self::ITEMS))) throw new ApiException('Checklist phải có đúng các mục của mẫu.', 422);
        $normalized = [];
        foreach (self::ITEMS as $key => $_) {
            if (!is_bool($checks[$key] ?? null)) throw new ApiException('Mỗi mục checklist phải là true hoặc false.', 422);
            $normalized[$key] = $checks[$key];
        }
        if (!is_int($input['expectedVersion'] ?? null) || $input['expectedVersion'] < 0 || $input['expectedVersion'] > 4294967294) throw new ApiException('Version không hợp lệ.', 422);
        if (!is_string($input['requestKey'] ?? null) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iD', $input['requestKey'])) throw new ApiException('requestKey phải là UUID v4.', 422);
        $photo = $input['referencePhotoUrl'] ?? null;
        if ($photo !== null && (!is_string($photo) || !preg_match('#^/uploads/checklists/[a-f0-9]{32}\.(jpg|png|webp)$#D', $photo))) throw new ApiException('Ảnh tham khảo phải được tải lên HomeCare trước khi lưu.', 422);
        $row = $this->model->save($userId, ['productId' => $productId, 'roomProfileId' => $roomId, 'checks' => $normalized, 'expectedVersion' => $input['expectedVersion'], 'requestKey' => strtolower($input['requestKey']), 'referencePhotoUrl' => $photo], array_fill_keys(array_keys(self::ITEMS), false));
        $result = $this->dto($row, $productId, $roomId);
        $result['history'] = $this->model->history($userId, (int) $row['id']);
        return $result;
    }

    // Resolve IDs from the authenticated actor; client input never supplies ownership.
    private function scope(array $actor, array $input): array
    {
        if (!isset($actor['id'])) throw new ApiException('Yêu cầu đăng nhập.', 401);
        if (($actor['role'] ?? '') !== 'CUSTOMER') throw new ApiException('Chỉ khách hàng được lưu checklist của mình.', 403);
        $id = static function (mixed $value): int {
            if ((!is_string($value) && !is_int($value)) || !preg_match('/^[1-9][0-9]{0,17}$/D', (string) $value)) throw new ApiException('ID không hợp lệ.', 422);
            return (int) $value;
        };
        $userId = $id($actor['id']); $productId = $id($input['productId'] ?? null);
        $roomId = ($input['roomProfileId'] ?? null) === null || ($input['roomProfileId'] ?? null) === '' ? null : $id($input['roomProfileId']);
        $this->model->assertScope($userId, $productId, $roomId);
        return [$userId, $productId, $roomId];
    }

    // Reject unknown fields instead of silently accepting a client-side template.
    private function onlyKeys(array $input, array $keys): void
    {
        if (array_diff(array_keys($input), $keys)) throw new ApiException('Request chứa trường không được hỗ trợ.', 422);
    }

    // An unsaved context starts at version zero and never implies completion.
    private function dto(?array $row, int $productId, ?int $roomId): array
    {
        $checks = $row ? json_decode($row['checks_json'], true, 8, JSON_THROW_ON_ERROR) : array_fill_keys(array_keys(self::ITEMS), false);
        return ['id' => $row ? (int) $row['id'] : null, 'productId' => $productId, 'roomProfileId' => $roomId, 'version' => (int) ($row['version'] ?? 0), 'templateVersion' => 1, 'referencePhotoUrl' => $row['reference_photo_url'] ?? null,
            'items' => self::ITEMS, 'checks' => $checks, 'completed' => !in_array(false, $checks, true), 'firstCompletedAt' => empty($row['first_completed_at']) ? null : str_replace(' ', 'T', $row['first_completed_at']) . 'Z'];
    }
}
