<?php
declare(strict_types=1);
require_once __DIR__ . '/audit-model.php';

// HOME-01/FIT-01: mọi truy vấn hồ sơ phòng đều lọc theo chủ sở hữu; tên cột chỉ đến từ whitelist của service.
class RoomFitModel
{
    private const ROOM_COLUMNS = 'id, name, placement_width_mm, placement_depth_mm, placement_height_mm, door_width_mm, floor_area_m2, occupant_count, power_available, water_supply, drainage, is_default, created_at, updated_at';

    public function __construct(private PDO $pdo) {}

    public function rooms(int $userId): array
    {
        $query = $this->pdo->prepare('SELECT ' . self::ROOM_COLUMNS . ' FROM room_profiles WHERE user_id = ? AND is_deleted = 0 ORDER BY is_default DESC, id DESC');
        $query->execute([$userId]);
        return $query->fetchAll();
    }

    public function room(int $id, int $userId): ?array
    {
        $query = $this->pdo->prepare('SELECT ' . self::ROOM_COLUMNS . ' FROM room_profiles WHERE id = ? AND user_id = ? AND is_deleted = 0');
        $query->execute([$id, $userId]);
        return $query->fetch() ?: null;
    }

    public function createRoom(int $userId, array $values): int
    {
        $columns = array_keys($values);
        $query = $this->pdo->prepare('INSERT INTO room_profiles (user_id, ' . implode(', ', $columns) . ') VALUES (?' . str_repeat(', ?', count($columns)) . ')');
        $query->execute([$userId, ...array_values($values)]);
        return (int) $this->pdo->lastInsertId();
    }

    public function updateRoom(int $id, int $userId, array $values): void
    {
        $assignments = implode(', ', array_map(static fn (string $column): string => "$column = ?", array_keys($values)));
        $this->pdo->prepare("UPDATE room_profiles SET $assignments WHERE id = ? AND user_id = ? AND is_deleted = 0")->execute([...array_values($values), $id, $userId]);
    }

    public function deleteRoom(int $id, int $userId): void
    {
        $this->pdo->prepare('UPDATE room_profiles SET is_deleted = 1 WHERE id = ? AND user_id = ?')->execute([$id, $userId]);
    }

    public function activeProductCategory(int $productId): ?int
    {
        $query = $this->pdo->prepare('SELECT p.category_id FROM products p JOIN categories c ON c.id = p.category_id AND c.is_active = 1 AND c.is_deleted = 0 JOIN brands b ON b.id = p.brand_id AND b.is_active = 1 AND b.is_deleted = 0 WHERE p.id = ? AND p.is_active = 1 AND p.is_deleted = 0');
        $query->execute([$productId]);
        $value = $query->fetchColumn();
        return $value === false ? null : (int) $value;
    }

    public function activeRules(int $productId, int $categoryId): array
    {
        $query = $this->pdo->prepare("SELECT * FROM fit_rules WHERE status = 'ACTIVE' AND (product_id = ? OR category_id = ?) ORDER BY id");
        $query->execute([$productId, $categoryId]);
        return $query->fetchAll();
    }

    public function attributeValues(int $productId): array
    {
        $query = $this->pdo->prepare('SELECT a.attribute_key, a.data_type, a.unit, v.value_number, v.value_boolean FROM product_attribute_values v JOIN product_attributes a ON a.id = v.attribute_id WHERE v.product_id = ?');
        $query->execute([$productId]);
        return $query->fetchAll();
    }

    // Retry cùng requestKey không tăng lượt dùng trên dashboard và không nhân đôi audit; khác payload trả 409.
    public function recordFitCheck(string $requestKey, int $userId, string $result, ?int $productId = null, ?int $roomProfileId = null): void
    {
        $ownsTransaction = !$this->pdo->inTransaction();
        if ($ownsTransaction) $this->pdo->beginTransaction();

        try {
            $insert = $this->pdo->prepare("INSERT INTO decision_events (request_key, user_id, event_type, fit_result) VALUES (?, ?, 'FIT_CHECK', ?) ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)");
            $insert->execute([$requestKey, $userId, $result]);
            $created = $insert->rowCount() === 1;

            $lookup = $this->pdo->prepare('SELECT id, user_id, event_type, fit_result FROM decision_events WHERE request_key = ? FOR UPDATE');
            $lookup->execute([$requestKey]);
            $event = $lookup->fetch(PDO::FETCH_ASSOC);
            if (!$event) throw new RuntimeException('FitCheck decision event was not persisted.');

            $conflict = (int) $event['user_id'] !== $userId
                || $event['event_type'] !== 'FIT_CHECK'
                || $event['fit_result'] !== $result;

            if (!$created && !$conflict && $productId !== null && $roomProfileId !== null) {
                $auditLookup = $this->pdo->prepare("SELECT details FROM audit_logs WHERE action = 'FIT_CHECK_COMPLETED' AND entity_type = 'decision_event' AND entity_id = ? ORDER BY id LIMIT 1");
                $auditLookup->execute([(int) $event['id']]);
                $auditDetails = $auditLookup->fetchColumn();
                if ($auditDetails !== false) {
                    try {
                        $details = json_decode((string) $auditDetails, true, 32, JSON_THROW_ON_ERROR);
                        $conflict = !is_array($details)
                            || (int) ($details['productId'] ?? 0) !== $productId
                            || (int) ($details['roomProfileId'] ?? 0) !== $roomProfileId;
                    } catch (JsonException) {
                        $conflict = true;
                    }
                }
            }

            if ($conflict) {
                throw new ApiException('requestKey đã dùng cho yêu cầu khác. Hãy tạo mã mới.', 409, ['requestKey' => 'Hãy tạo requestKey mới.']);
            }

            if ($created) {
                (new AuditModel($this->pdo))->record(
                    $userId,
                    'CUSTOMER',
                    'FIT_CHECK_COMPLETED',
                    'decision_event',
                    (int) $event['id'],
                    ['requestKey' => $requestKey, 'productId' => $productId, 'roomProfileId' => $roomProfileId, 'result' => $result]
                );
            }

            if ($ownsTransaction) $this->pdo->commit();
        } catch (Throwable $error) {
            if ($ownsTransaction && $this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
    }
}
