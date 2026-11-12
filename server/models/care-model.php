<?php
declare(strict_types=1);

// MySQL access for owned devices, care schedules and their catalog-linked supplies.
final class CareModel
{
    public function __construct(private PDO $pdo) {}

    // Revalidate the session actor against the current account role and status.
    public function requireActor(array $principal, array $roles): void
    {
        requireRole($principal, $roles);
        $statement = $this->pdo->prepare('SELECT role FROM users WHERE id = ? AND status = ? AND is_deleted = 0');
        $statement->execute([$principal['id'], 'ACTIVE']);
        $role = $statement->fetchColumn();
        if ($role === false) throw new ApiException('Tài khoản không còn hoạt động.', 401);
        if ($role !== $principal['role']) throw new ApiException('Quyền tài khoản đã thay đổi. Vui lòng đăng nhập lại.', 403);
    }

    // Page only the current owner's devices; status is an allowlisted enum from the service.
    public function ownedDevices(string $customerId, string $status, int $page, int $pageSize): array
    {
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM owned_devices WHERE customer_id = ? AND status = ?');
        $count->execute([$customerId, $status]);
        $total = (int) $count->fetchColumn();
        $statement = $this->pdo->prepare("SELECT d.id, d.order_item_id, d.unit_number, d.product_id, d.variant_id,
                d.product_name_snapshot, d.sku_snapshot, d.purchased_at, d.completed_at,
                d.warranty_months_snapshot, d.warranty_start_date, d.serial_number, d.manual_url, d.status,
                p.category_id, c.name AS category_name,
                (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = d.product_id AND pi.is_primary = 1 AND pi.is_deleted = 0 ORDER BY pi.id DESC LIMIT 1) AS image_url
            FROM owned_devices d
            LEFT JOIN products p ON p.id = d.product_id
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE d.customer_id = ? AND d.status = ?
            ORDER BY d.completed_at DESC, d.id DESC LIMIT ? OFFSET ?");
        $statement->bindValue(1, $customerId, PDO::PARAM_STR);
        $statement->bindValue(2, $status, PDO::PARAM_STR);
        $statement->bindValue(3, $pageSize, PDO::PARAM_INT);
        $statement->bindValue(4, ($page - 1) * $pageSize, PDO::PARAM_INT);
        $statement->execute();
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        $tasks = $this->careTasksForDevices($customerId, array_column($rows, 'id'));
        return [
            'items' => array_map(fn (array $row): array => $this->deviceDto($row, $tasks[(string) $row['id']] ?? []), $rows),
            'pagination' => ['page' => $page, 'pageSize' => $pageSize, 'totalItems' => $total, 'totalPages' => (int) ceil($total / $pageSize)],
        ];
    }

    // Read one owner-scoped device; archived records remain available to their owner.
    public function ownedDevice(string $customerId, string $deviceId): array
    {
        $statement = $this->pdo->prepare("SELECT d.id, d.order_item_id, d.unit_number, d.product_id, d.variant_id,
                d.product_name_snapshot, d.sku_snapshot, d.purchased_at, d.completed_at,
                d.warranty_months_snapshot, d.warranty_start_date, d.serial_number, d.manual_url, d.status,
                p.category_id, c.name AS category_name,
                (SELECT pi.image_url FROM product_images pi WHERE pi.product_id = d.product_id AND pi.is_primary = 1 AND pi.is_deleted = 0 ORDER BY pi.id DESC LIMIT 1) AS image_url
            FROM owned_devices d
            LEFT JOIN products p ON p.id = d.product_id
            LEFT JOIN categories c ON c.id = p.category_id
            WHERE d.id = ? AND d.customer_id = ?");
        $statement->execute([$deviceId, $customerId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$row) throw new ApiException('Không tìm thấy thiết bị.', 404);
        $tasks = $this->careTasksForDevices($customerId, [$row['id']]);
        return $this->deviceDto($row, $tasks[(string) $row['id']] ?? []);
    }

    // Update only owner-editable serial/archive fields under a row lock.
    public function updateOwnedDevice(string $customerId, string $deviceId, array $values): array
    {
        return $this->transaction(function () use ($customerId, $deviceId, $values): array {
            $statement = $this->pdo->prepare('SELECT id, serial_number, status FROM owned_devices WHERE id = ? AND customer_id = ? FOR UPDATE');
            $statement->execute([$deviceId, $customerId]);
            $current = $statement->fetch(PDO::FETCH_ASSOC);
            if (!$current) throw new ApiException('Không tìm thấy thiết bị.', 404);
            $serialNumber = array_key_exists('serialNumber', $values) ? $values['serialNumber'] : $current['serial_number'];
            $status = array_key_exists('status', $values) ? $values['status'] : $current['status'];
            $this->pdo->prepare('UPDATE owned_devices SET serial_number = ?, status = ?, updated_at = UTC_TIMESTAMP() WHERE id = ? AND customer_id = ?')
                ->execute([$serialNumber, $status, $deviceId, $customerId]);
            return $this->ownedDevice($customerId, $deviceId);
        });
    }

    // Return maintenance cycles only for devices owned by the authenticated customer.
    public function ownedCareTasks(string $customerId, string $deviceId): array
    {
        $device = $this->pdo->prepare('SELECT id FROM owned_devices WHERE id = ? AND customer_id = ?');
        $device->execute([$deviceId, $customerId]);
        if (!$device->fetchColumn()) throw new ApiException('Không tìm thấy thiết bị.', 404);
        $rows = $this->careTasksForDevices($customerId, [$deviceId])[$deviceId] ?? [];
        return ['items' => $rows];
    }

    // Complete a cycle and create one successor in the same transaction; status and unique cycle key make retries safe.
    public function completeCareTask(string $customerId, string $actorId, string $taskId): array
    {
        return $this->transaction(function () use ($customerId, $actorId, $taskId): array {
            $task = $this->lockCareTask($customerId, $taskId);
            if ($task['device_status'] !== 'ACTIVE') throw new ApiException('Thiết bị đã lưu trữ nên không thể cập nhật lịch.', 409);
            if ($task['status'] === 'COMPLETED') return $this->ownedCareTask($customerId, $taskId);
            if (!in_array($task['status'], ['DUE', 'POSTPONED'], true)) throw new ApiException('Trạng thái lịch bảo trì không hợp lệ.', 409);
            if ((int) $task['cycle_number'] >= 4294967295) throw new ApiException('Chu kỳ bảo trì đã vượt giới hạn.', 409);

            $this->pdo->prepare("UPDATE care_tasks SET status = 'COMPLETED', completed_at = UTC_TIMESTAMP(), updated_by = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?")
                ->execute([$actorId, $taskId]);
            if ($task['rule_status'] === 'ACTIVE') {
                $nextCycle = (int) $task['cycle_number'] + 1;
                $nextDate = (new DateTimeImmutable('today', new DateTimeZone('Asia/Ho_Chi_Minh')))->modify('+' . (int) $task['interval_days'] . ' days')->format('Y-m-d');
                $insert = $this->pdo->prepare("INSERT INTO care_tasks (owned_device_id, care_rule_id, cycle_number, original_due_date, due_date, status)
                    VALUES (?, ?, ?, ?, ?, 'DUE') ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)");
                $insert->execute([$task['owned_device_id'], $task['care_rule_id'], $nextCycle, $nextDate, $nextDate]);
            }
            return $this->ownedCareTask($customerId, $taskId);
        });
    }

    // Reschedule without changing the original due date; a repeated identical request is a stable no-op.
    public function postponeCareTask(string $customerId, string $actorId, string $taskId, string $newDueDate, string $reason): array
    {
        return $this->transaction(function () use ($customerId, $actorId, $taskId, $newDueDate, $reason): array {
            $task = $this->lockCareTask($customerId, $taskId);
            if ($task['device_status'] !== 'ACTIVE') throw new ApiException('Thiết bị đã lưu trữ nên không thể cập nhật lịch.', 409);
            if ($task['status'] === 'COMPLETED') throw new ApiException('Lịch đã hoàn thành nên không thể hoãn.', 409);
            if ($task['status'] === 'POSTPONED' && $task['due_date'] === $newDueDate && $task['postpone_reason'] === $reason) {
                return $this->ownedCareTask($customerId, $taskId);
            }
            $this->pdo->prepare("UPDATE care_tasks SET status = 'POSTPONED', due_date = ?, postpone_reason = ?, updated_by = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?")
                ->execute([$newDueDate, $reason, $actorId, $taskId]);
            return $this->ownedCareTask($customerId, $taskId);
        });
    }

    // List category/product maintenance rules with linked current SKU details for the ADMIN workspace.
    public function careRules(): array
    {
        $rows = $this->pdo->query("SELECT r.id, r.category_id, r.product_id, r.rule_key, r.title, r.instructions,
                r.first_due_days, r.interval_days, r.status, r.version, r.updated_by, r.updated_at,
                c.name AS category_name, p.name AS product_name
            FROM care_rules r
            LEFT JOIN categories c ON c.id = r.category_id
            LEFT JOIN products p ON p.id = r.product_id
            ORDER BY r.status = 'ACTIVE' DESC, COALESCE(c.name, p.name), r.title, r.id")->fetchAll(PDO::FETCH_ASSOC);
        $supplies = $this->careRuleSupplyMap(array_column($rows, 'id'));
        return ['items' => array_map(fn (array $row): array => $this->careRuleDto($row, $supplies[(string) $row['id']] ?? []), $rows)];
    }

    // Search only active catalog SKUs; stock and price come from the current variant row.
    public function careSupplyOptions(string $query): array
    {
        $sql = "SELECT v.id AS variant_id, v.product_id, v.sku, v.variant_name, v.stock_quantity,
                CASE WHEN v.sale_price IS NOT NULL AND (v.sale_starts_at IS NULL OR v.sale_starts_at <= UTC_TIMESTAMP())
                    AND (v.sale_ends_at IS NULL OR v.sale_ends_at >= UTC_TIMESTAMP()) AND v.sale_price < v.price THEN v.sale_price ELSE v.price END AS effective_price,
                p.name AS product_name, p.category_id, c.name AS category_name
            FROM product_variants v
            INNER JOIN products p ON p.id = v.product_id AND p.is_active = 1 AND p.is_deleted = 0
            INNER JOIN categories c ON c.id = p.category_id AND c.is_active = 1 AND c.is_deleted = 0
            INNER JOIN brands b ON b.id = p.brand_id AND b.is_active = 1 AND b.is_deleted = 0
            WHERE v.is_active = 1 AND v.is_deleted = 0";
        $params = [];
        if ($query !== '') {
            $pattern = '%' . strtr($query, ['=' => '==', '%' => '=%', '_' => '=_']) . '%';
            $sql .= " AND (p.name LIKE ? ESCAPE '=' OR v.sku LIKE ? ESCAPE '=' OR v.variant_name LIKE ? ESCAPE '=')";
            array_push($params, $pattern, $pattern, $pattern);
        }
        $sql .= ' ORDER BY (v.stock_quantity > 0) DESC, p.name, v.id LIMIT 40';
        $statement = $this->pdo->prepare($sql);
        $statement->execute($params);
        return array_map(static fn (array $row): array => [
            'variantId' => (string) $row['variant_id'], 'productId' => (string) $row['product_id'],
            'productName' => $row['product_name'], 'categoryId' => (string) $row['category_id'],
            'categoryName' => $row['category_name'], 'sku' => $row['sku'], 'variantName' => $row['variant_name'],
            'currentPrice' => (string) $row['effective_price'], 'stockQuantity' => (int) $row['stock_quantity'],
        ], $statement->fetchAll(PDO::FETCH_ASSOC));
    }

    // Insert a rule and its optional SKU links atomically.
    public function createCareRule(array $values, string $actorId): array
    {
        return $this->transaction(function () use ($values, $actorId): array {
            $this->assertRuleScope($values);
            $statement = $this->pdo->prepare('INSERT INTO care_rules (category_id, product_id, rule_key, title, instructions, first_due_days, interval_days, status, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
            $statement->execute([$values['categoryId'], $values['productId'], $values['ruleKey'], $values['title'], $values['instructions'], $values['firstDueDays'], $values['intervalDays'], $values['status'], $actorId]);
            $id = (string) $this->pdo->lastInsertId();
            $this->replaceRuleSupplies($id, $values['supplyVariantIds']);
            return $this->careRuleById($id);
        });
    }

    // Update configuration without rewriting care tasks that already exist.
    public function updateCareRule(string $ruleId, array $values, string $actorId): array
    {
        return $this->transaction(function () use ($ruleId, $values, $actorId): array {
            $statement = $this->pdo->prepare('SELECT id FROM care_rules WHERE id = ? FOR UPDATE');
            $statement->execute([$ruleId]);
            if (!$statement->fetchColumn()) throw new ApiException('Không tìm thấy quy tắc bảo trì.', 404);
            $this->assertRuleScope($values);
            $update = $this->pdo->prepare('UPDATE care_rules SET category_id = ?, product_id = ?, rule_key = ?, title = ?, instructions = ?, first_due_days = ?, interval_days = ?, status = ?, version = version + 1, updated_by = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?');
            $update->execute([$values['categoryId'], $values['productId'], $values['ruleKey'], $values['title'], $values['instructions'], $values['firstDueDays'], $values['intervalDays'], $values['status'], $actorId, $ruleId]);
            $this->replaceRuleSupplies($ruleId, $values['supplyVariantIds']);
            return $this->careRuleById($ruleId);
        });
    }

    private function assertRuleScope(array $values): void
    {
        if ($values['categoryId'] !== null) {
            $statement = $this->pdo->prepare('SELECT 1 FROM categories WHERE id = ? AND is_active = 1 AND is_deleted = 0');
            $statement->execute([$values['categoryId']]);
        } else {
            $statement = $this->pdo->prepare('SELECT 1 FROM products p JOIN categories c ON c.id = p.category_id JOIN brands b ON b.id = p.brand_id WHERE p.id = ? AND p.is_active = 1 AND p.is_deleted = 0 AND c.is_active = 1 AND c.is_deleted = 0 AND b.is_active = 1 AND b.is_deleted = 0');
            $statement->execute([$values['productId']]);
        }
        if (!$statement->fetchColumn()) throw new ApiException('Danh mục hoặc sản phẩm cấu hình không còn tồn tại.', 404);
        foreach ($values['supplyVariantIds'] as $variantId) {
            $statement = $this->pdo->prepare("SELECT 1 FROM product_variants v JOIN products p ON p.id = v.product_id
                JOIN categories c ON c.id = p.category_id JOIN brands b ON b.id = p.brand_id
                WHERE v.id = ? AND v.is_active = 1 AND v.is_deleted = 0 AND p.is_active = 1 AND p.is_deleted = 0
                AND c.is_active = 1 AND c.is_deleted = 0 AND b.is_active = 1 AND b.is_deleted = 0");
            $statement->execute([$variantId]);
            if (!$statement->fetchColumn()) throw new ApiException('SKU vật tư không còn được bán.', 422);
        }
    }

    private function replaceRuleSupplies(string $ruleId, array $variantIds): void
    {
        $this->pdo->prepare('DELETE FROM care_rule_supplies WHERE care_rule_id = ?')->execute([$ruleId]);
        $insert = $this->pdo->prepare('INSERT INTO care_rule_supplies (care_rule_id, variant_id, sort_order) VALUES (?, ?, ?)');
        foreach ($variantIds as $index => $variantId) $insert->execute([$ruleId, $variantId, $index]);
    }

    private function careRuleById(string $id): array
    {
        $statement = $this->pdo->prepare("SELECT r.id, r.category_id, r.product_id, r.rule_key, r.title, r.instructions,
                r.first_due_days, r.interval_days, r.status, r.version, r.updated_by, r.updated_at,
                c.name AS category_name, p.name AS product_name FROM care_rules r
            LEFT JOIN categories c ON c.id = r.category_id LEFT JOIN products p ON p.id = r.product_id WHERE r.id = ?");
        $statement->execute([$id]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$row) throw new ApiException('Không tìm thấy quy tắc bảo trì.', 404);
        $supplies = $this->careRuleSupplyMap([$id]);
        return $this->careRuleDto($row, $supplies[$id] ?? []);
    }

    private function careRuleSupplyMap(array $ruleIds): array
    {
        if ($ruleIds === []) return [];
        $sql = "SELECT crs.care_rule_id, v.id AS variant_id, v.product_id, v.sku, v.variant_name, v.stock_quantity,
                CASE WHEN v.sale_price IS NOT NULL AND (v.sale_starts_at IS NULL OR v.sale_starts_at <= UTC_TIMESTAMP())
                    AND (v.sale_ends_at IS NULL OR v.sale_ends_at >= UTC_TIMESTAMP()) AND v.sale_price < v.price THEN v.sale_price ELSE v.price END AS effective_price,
                p.name AS product_name FROM care_rule_supplies crs JOIN product_variants v ON v.id = crs.variant_id
            JOIN products p ON p.id = v.product_id JOIN categories c ON c.id = p.category_id
            JOIN brands b ON b.id = p.brand_id WHERE crs.care_rule_id IN (" . implode(',', array_fill(0, count($ruleIds), '?')) . ")
            AND v.is_active = 1 AND v.is_deleted = 0 AND p.is_active = 1 AND p.is_deleted = 0
            AND c.is_active = 1 AND c.is_deleted = 0 AND b.is_active = 1 AND b.is_deleted = 0 ORDER BY crs.sort_order, v.id";
        $statement = $this->pdo->prepare($sql);
        $statement->execute($ruleIds);
        $result = [];
        foreach ($statement->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $result[(string) $row['care_rule_id']][] = [
                'variantId' => (string) $row['variant_id'], 'productId' => (string) $row['product_id'],
                'productName' => $row['product_name'], 'sku' => $row['sku'], 'variantName' => $row['variant_name'],
                'currentPrice' => (string) $row['effective_price'], 'stockQuantity' => (int) $row['stock_quantity'],
                'available' => (int) $row['stock_quantity'] > 0,
                'href' => '/catalog/products/' . rawurlencode((string) $row['product_id']) . '?variantId=' . rawurlencode((string) $row['variant_id']),
            ];
        }
        return $result;
    }

    private function careTasksForDevices(string $customerId, array $deviceIds): array
    {
        if ($deviceIds === []) return [];
        $sql = "SELECT ct.id, ct.owned_device_id, ct.care_rule_id, ct.cycle_number, ct.original_due_date, ct.due_date,
                ct.status, ct.completed_at, ct.postpone_reason, ct.updated_by, ct.updated_at,
                cr.rule_key, cr.title, cr.instructions, cr.interval_days
            FROM care_tasks ct JOIN owned_devices od ON od.id = ct.owned_device_id
            JOIN care_rules cr ON cr.id = ct.care_rule_id
            WHERE od.customer_id = ? AND od.id IN (" . implode(',', array_fill(0, count($deviceIds), '?')) . ")
            ORDER BY ct.due_date, ct.id";
        $statement = $this->pdo->prepare($sql);
        $statement->execute(array_merge([$customerId], $deviceIds));
        $rows = $statement->fetchAll(PDO::FETCH_ASSOC);
        $supplies = $this->careRuleSupplyMap(array_values(array_unique(array_column($rows, 'care_rule_id'))));
        $result = [];
        foreach ($rows as $row) {
            $result[(string) $row['owned_device_id']][] = $this->careTaskDto($row, $supplies[(string) $row['care_rule_id']] ?? []);
        }
        return $result;
    }

    private function lockCareTask(string $customerId, string $taskId): array
    {
        $statement = $this->pdo->prepare("SELECT ct.id, ct.owned_device_id, ct.care_rule_id, ct.cycle_number, ct.original_due_date,
                ct.due_date, ct.status, ct.completed_at, ct.postpone_reason, od.status AS device_status, cr.interval_days, cr.status AS rule_status
            FROM care_tasks ct JOIN owned_devices od ON od.id = ct.owned_device_id
            JOIN care_rules cr ON cr.id = ct.care_rule_id
            WHERE ct.id = ? AND od.customer_id = ? FOR UPDATE");
        $statement->execute([$taskId, $customerId]);
        $task = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$task) throw new ApiException('Không tìm thấy lịch bảo trì.', 404);
        return $task;
    }

    private function ownedCareTask(string $customerId, string $taskId): array
    {
        $statement = $this->pdo->prepare("SELECT ct.id, ct.owned_device_id, ct.care_rule_id, ct.cycle_number, ct.original_due_date,
                ct.due_date, ct.status, ct.completed_at, ct.postpone_reason, ct.updated_at,
                cr.rule_key, cr.title, cr.instructions, cr.interval_days
            FROM care_tasks ct JOIN owned_devices od ON od.id = ct.owned_device_id
            JOIN care_rules cr ON cr.id = ct.care_rule_id WHERE ct.id = ? AND od.customer_id = ?");
        $statement->execute([$taskId, $customerId]);
        $row = $statement->fetch(PDO::FETCH_ASSOC);
        if (!$row) throw new ApiException('Không tìm thấy lịch bảo trì.', 404);
        $supplies = $this->careRuleSupplyMap([$row['care_rule_id']]);
        return $this->careTaskDto($row, $supplies[(string) $row['care_rule_id']] ?? []);
    }

    private function deviceDto(array $row, array $tasks): array
    {
        return [
            'id' => (string) $row['id'], 'orderItemId' => (string) $row['order_item_id'],
            'unitNumber' => (int) $row['unit_number'], 'productId' => (string) $row['product_id'],
            'variantId' => (string) $row['variant_id'], 'productName' => $row['product_name_snapshot'],
            'sku' => $row['sku_snapshot'], 'categoryId' => $row['category_id'] === null ? null : (string) $row['category_id'],
            'categoryName' => $row['category_name'], 'imageUrl' => $row['image_url'],
            'purchasedAt' => $this->utcIso($row['purchased_at']), 'completedAt' => $this->utcIso($row['completed_at']),
            'warrantyMonths' => (int) $row['warranty_months_snapshot'], 'warrantyStartDate' => $row['warranty_start_date'],
            'warrantyStartConfirmed' => $row['warranty_start_date'] !== null, 'serialNumber' => $row['serial_number'],
            'manualUrl' => $row['manual_url'], 'status' => $row['status'], 'careTasks' => $tasks,
        ];
    }

    private function careTaskDto(array $row, array $supplies): array
    {
        return [
            'id' => (string) $row['id'], 'deviceId' => (string) $row['owned_device_id'],
            'careRuleId' => (string) $row['care_rule_id'], 'ruleKey' => $row['rule_key'],
            'cycleNumber' => (int) $row['cycle_number'], 'title' => $row['title'],
            'instructions' => $row['instructions'], 'originalDueDate' => $row['original_due_date'],
            'dueDate' => $row['due_date'], 'status' => $row['status'],
            'completedAt' => $this->utcIso($row['completed_at'] ?? null), 'postponeReason' => $row['postpone_reason'] ?? null,
            'updatedAt' => $this->utcIso($row['updated_at'] ?? null), 'supplies' => $supplies,
        ];
    }

    private function careRuleDto(array $row, array $supplies): array
    {
        return [
            'id' => (string) $row['id'], 'categoryId' => $row['category_id'] === null ? null : (string) $row['category_id'],
            'categoryName' => $row['category_name'], 'productId' => $row['product_id'] === null ? null : (string) $row['product_id'],
            'productName' => $row['product_name'], 'ruleKey' => $row['rule_key'], 'title' => $row['title'],
            'instructions' => $row['instructions'], 'firstDueDays' => (int) $row['first_due_days'],
            'intervalDays' => (int) $row['interval_days'], 'status' => $row['status'],
            'version' => (int) $row['version'], 'updatedBy' => (string) $row['updated_by'],
            'updatedAt' => $this->utcIso($row['updated_at']), 'supplies' => $supplies,
        ];
    }

    // Serialize MySQL UTC timestamps consistently for the API contract.
    private function utcIso(?string $value): ?string
    {
        if ($value === null || $value === '') return null;
        return (new DateTimeImmutable($value, new DateTimeZone('UTC')))->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\\TH:i:s\\Z');
    }

    // Own a transaction only when the caller does not already have one.
    private function transaction(callable $work): mixed
    {
        $ownsTransaction = !$this->pdo->inTransaction();
        if ($ownsTransaction) $this->pdo->beginTransaction();
        try {
            $result = $work();
            if ($ownsTransaction) $this->pdo->commit();
            return $result;
        } catch (Throwable $error) {
            if ($ownsTransaction && $this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
    }
}
