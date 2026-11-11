<?php
declare(strict_types=1);

// Chỉ lớp model ghi fit_rules; mỗi thay đổi và snapshot được commit cùng transaction.
class FitRuleModel
{
    private const COLUMNS = 'id, category_id, product_id, rule_key, title, left_source, left_key, operator, right_source, right_key, right_value, margin_value, unit, severity, pass_message, fail_message, missing_message, status, version, updated_by, created_at, updated_at';

    public function __construct(private PDO $pdo) {}

    public function scopes(): array
    {
        return [
            'categories' => $this->pdo->query('SELECT id, name FROM categories WHERE is_deleted = 0 ORDER BY name, id')->fetchAll(),
            'products' => $this->pdo->query('SELECT id, category_id, name FROM products WHERE is_deleted = 0 ORDER BY name, id')->fetchAll(),
        ];
    }

    public function categoryExists(int $id): bool
    {
        $query = $this->pdo->prepare('SELECT 1 FROM categories WHERE id = ? AND is_deleted = 0');
        $query->execute([$id]);
        return (bool) $query->fetchColumn();
    }

    public function productCategory(int $id): ?int
    {
        $query = $this->pdo->prepare('SELECT category_id FROM products WHERE id = ? AND is_deleted = 0');
        $query->execute([$id]);
        $value = $query->fetchColumn();
        return $value === false ? null : (int) $value;
    }

    public function attributes(int $categoryId): array
    {
        $query = $this->pdo->prepare('SELECT attribute_key, name, data_type, unit FROM product_attributes WHERE category_id = ? ORDER BY id');
        $query->execute([$categoryId]);
        return $query->fetchAll();
    }

    public function rules(?int $categoryId, ?int $productId, ?string $status, int $page): array
    {
        $conditions = [];
        $params = [];
        if ($categoryId !== null) { $conditions[] = 'r.category_id = ?'; $params[] = $categoryId; }
        if ($productId !== null) { $conditions[] = 'r.product_id = ?'; $params[] = $productId; }
        if ($status !== null) { $conditions[] = 'r.status = ?'; $params[] = $status; }
        $where = $conditions ? ' WHERE ' . implode(' AND ', $conditions) : '';
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM fit_rules r' . $where);
        $count->execute($params);
        $query = $this->pdo->prepare('SELECT r.*, u.full_name AS updated_by_name FROM fit_rules r JOIN users u ON u.id = r.updated_by' . $where . ' ORDER BY r.id DESC LIMIT 50 OFFSET ?');
        foreach ($params as $index => $value) $query->bindValue($index + 1, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        $query->bindValue(count($params) + 1, ($page - 1) * 50, PDO::PARAM_INT);
        $query->execute();
        return ['items' => $query->fetchAll(), 'total' => (int) $count->fetchColumn(), 'page' => $page, 'pageSize' => 50];
    }

    public function rule(int $id): ?array
    {
        $query = $this->pdo->prepare('SELECT r.*, u.full_name AS updated_by_name FROM fit_rules r JOIN users u ON u.id = r.updated_by WHERE r.id = ?');
        $query->execute([$id]);
        return $query->fetch() ?: null;
    }

    public function versions(int $id): array
    {
        $query = $this->pdo->prepare('SELECT v.version, v.action, v.snapshot, v.changed_by, u.full_name AS changed_by_name, v.changed_at FROM fit_rule_versions v JOIN users u ON u.id = v.changed_by WHERE v.rule_id = ? ORDER BY v.version DESC');
        $query->execute([$id]);
        return $query->fetchAll();
    }

    // Tạo rule và bản snapshot đầu tiên trong cùng transaction.
    public function create(array $values, int $actorId): array
    {
        $this->pdo->beginTransaction();
        try {
            $columns = array_keys($values);
            $query = $this->pdo->prepare('INSERT INTO fit_rules (' . implode(', ', $columns) . ', updated_by) VALUES (' . implode(', ', array_fill(0, count($columns) + 1, '?')) . ')');
            $query->execute([...array_values($values), $actorId]);
            $id = (int) $this->pdo->lastInsertId();
            $row = $this->rule($id);
            $this->insertVersion($row, 'CREATE', $actorId);
            $this->pdo->commit();
            return $row;
        } catch (Throwable $error) {
            $this->pdo->rollBack();
            throw $error;
        }
    }

    // SELECT FOR UPDATE + expectedVersion chặn ghi đè đồng thời; lịch sử cũ không được UPDATE.
    public function update(int $id, array $values, int $expectedVersion, int $actorId, string $action = 'UPDATE'): array
    {
        $this->pdo->beginTransaction();
        try {
            $query = $this->pdo->prepare('SELECT version, status FROM fit_rules WHERE id = ? FOR UPDATE');
            $query->execute([$id]);
            $current = $query->fetch();
            if (!$current) throw new ApiException('Không tìm thấy quy tắc.', 404);
            if ((int) $current['version'] !== $expectedVersion) throw new ApiException('Quy tắc đã được sửa ở phiên khác. Hãy tải lại.', 409);
            $sets = array_map(fn ($column) => $column . ' = ?', array_keys($values));
            $update = $this->pdo->prepare('UPDATE fit_rules SET ' . implode(', ', $sets) . ', version = version + 1, updated_by = ? WHERE id = ?');
            $update->execute([...array_values($values), $actorId, $id]);
            $row = $this->rule($id);
            $this->insertVersion($row, $action, $actorId);
            $this->pdo->commit();
            return $row;
        } catch (Throwable $error) {
            $this->pdo->rollBack();
            throw $error;
        }
    }

    private function insertVersion(array $row, string $action, int $actorId): void
    {
        $snapshot = array_intersect_key($row, array_flip(explode(', ', self::COLUMNS)));
        $query = $this->pdo->prepare('INSERT INTO fit_rule_versions (rule_id, version, action, snapshot, changed_by) VALUES (?, ?, ?, ?, ?)');
        $query->execute([(int) $row['id'], (int) $row['version'], $action, json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), $actorId]);
    }
}
