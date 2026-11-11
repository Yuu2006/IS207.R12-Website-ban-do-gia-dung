<?php
declare(strict_types=1);

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
        $query = $this->pdo->prepare('SELECT category_id FROM products WHERE id = ? AND is_active = 1 AND is_deleted = 0');
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

    // Retry cùng requestKey không tăng lượt dùng trên dashboard.
    public function recordFitCheck(string $requestKey, int $userId, string $result): void
    {
        $this->pdo->prepare("INSERT INTO decision_events (request_key, user_id, event_type, fit_result) VALUES (?, ?, 'FIT_CHECK', ?) ON DUPLICATE KEY UPDATE request_key = request_key")->execute([$requestKey, $userId, $result]);
    }
}
