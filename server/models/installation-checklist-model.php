<?php
declare(strict_types=1);

// Customer-owned FIT-02 progress and immutable submission snapshots; no installation conclusion is inferred.
final class InstallationChecklistModel
{
    public function __construct(private PDO $pdo) {}

    // Recheck active public catalog data and room ownership against persistent records.
    public function assertScope(int $customerId, int $productId, ?int $roomId): void
    {
        $q = $this->pdo->prepare("SELECT id FROM users WHERE id = ? AND role = 'CUSTOMER' AND status = 'ACTIVE' AND is_deleted = 0");
        $q->execute([$customerId]);
        if (!$q->fetchColumn()) throw new ApiException('Phiên khách hàng không còn hợp lệ.', 401);
        $q = $this->pdo->prepare('SELECT p.id FROM products p JOIN categories c ON c.id = p.category_id JOIN brands b ON b.id = p.brand_id WHERE p.id = ? AND p.is_active = 1 AND p.is_deleted = 0 AND c.is_active = 1 AND c.is_deleted = 0 AND b.is_active = 1 AND b.is_deleted = 0');
        $q->execute([$productId]);
        if (!$q->fetchColumn()) throw new ApiException('Không tìm thấy sản phẩm đang bán.', 404);
        if ($roomId !== null) {
            $q = $this->pdo->prepare('SELECT id FROM room_profiles WHERE id = ? AND user_id = ? AND is_deleted = 0');
            $q->execute([$roomId, $customerId]);
            if (!$q->fetchColumn()) throw new ApiException('Không tìm thấy hồ sơ phòng.', 404);
        }
    }

    // A missing room uses the generated zero scope without sharing another customer's record.
    public function read(int $customerId, int $productId, ?int $roomId): ?array
    {
        $q = $this->pdo->prepare('SELECT * FROM installation_checklists WHERE customer_id = ? AND product_id = ? AND room_scope = ?');
        $q->execute([$customerId, $productId, $roomId ?? 0]);
        return $q->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    // Same request replays the saved response; stale versions or changed payload roll back all writes.
    public function save(int $customerId, array $input, array $emptyChecks): array
    {
        $hash = hash('sha256', json_encode($input, JSON_THROW_ON_ERROR));
        $this->pdo->beginTransaction();
        try {
            $q = $this->pdo->prepare('INSERT INTO installation_checklist_events (customer_id, request_key, request_hash) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)');
            $q->execute([$customerId, $input['requestKey'], $hash]);
            $q = $this->pdo->prepare('SELECT id, request_hash, response_json FROM installation_checklist_events WHERE customer_id = ? AND request_key = ? FOR UPDATE');
            $q->execute([$customerId, $input['requestKey']]); $event = $q->fetch(PDO::FETCH_ASSOC);
            if (!hash_equals($event['request_hash'], $hash)) throw new ApiException('requestKey đã dùng cho nội dung khác.', 409);
            if ($event['response_json'] !== null) {
                $result = json_decode($event['response_json'], true, 32, JSON_THROW_ON_ERROR);
            } else {
                $q = $this->pdo->prepare('INSERT INTO installation_checklists (customer_id, product_id, room_profile_id, checks_json) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)');
                $q->execute([$customerId, $input['productId'], $input['roomProfileId'], json_encode($emptyChecks, JSON_THROW_ON_ERROR)]);
                $id = $this->pdo->lastInsertId();
                $q = $this->pdo->prepare('SELECT version FROM installation_checklists WHERE id = ? FOR UPDATE');
                $q->execute([$id]);
                if ((int) $q->fetchColumn() !== $input['expectedVersion']) throw new ApiException('Checklist đã thay đổi. Hãy tải lại trước khi lưu.', 409);
                $completed = !in_array(false, $input['checks'], true);
                $q = $this->pdo->prepare('UPDATE installation_checklists SET checks_json = ?, reference_photo_url = ?, version = version + 1, first_completed_at = CASE WHEN ? = 1 THEN COALESCE(first_completed_at, UTC_TIMESTAMP()) ELSE first_completed_at END, updated_at = UTC_TIMESTAMP() WHERE id = ?');
                $q->execute([json_encode($input['checks'], JSON_THROW_ON_ERROR), $input['referencePhotoUrl'], (int) $completed, $id]);
                $result = $this->read($customerId, $input['productId'], $input['roomProfileId']);
                $this->pdo->prepare('UPDATE installation_checklist_events SET checklist_id = ?, response_json = ?, created_at = UTC_TIMESTAMP() WHERE id = ?')->execute([$id, json_encode($result, JSON_THROW_ON_ERROR), $event['id']]);
            }
            $this->pdo->commit();
            return $result;
        } catch (Throwable $error) { if ($this->pdo->inTransaction()) $this->pdo->rollBack(); throw $error; }
    }

    // Read bounded snapshots rather than reconstructing history from the mutable current row.
    public function history(int $customerId, int $checklistId): array
    {
        $q = $this->pdo->prepare('SELECT response_json, created_at FROM installation_checklist_events WHERE customer_id = ? AND checklist_id = ? AND response_json IS NOT NULL ORDER BY id DESC LIMIT 20');
        $q->execute([$customerId, $checklistId]);
        return array_map(static function (array $row): array {
            $snapshot = json_decode($row['response_json'], true, 32, JSON_THROW_ON_ERROR);
            return ['version' => (int) $snapshot['version'], 'checks' => json_decode($snapshot['checks_json'], true, 8, JSON_THROW_ON_ERROR), 'referencePhotoUrl' => $snapshot['reference_photo_url'] ?? null, 'savedAt' => str_replace(' ', 'T', $row['created_at']) . 'Z'];
        }, $q->fetchAll(PDO::FETCH_ASSOC));
    }
}
