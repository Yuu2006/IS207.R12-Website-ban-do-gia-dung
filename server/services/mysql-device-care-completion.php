<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

// Creates the warranty snapshot and first maintenance cycles in the locked order transaction.
final class MysqlDeviceCareCompletion implements OrderCompletionDependencies
{
    public function createDevicesAndCare(\PDO $pdo, array $principal, array $order, array $items): void
    {
        if (!$pdo->inTransaction()) throw new \LogicException('Device/care creation must share the order transaction.');
        if (strtoupper((string) ($order['order_status'] ?? '')) !== 'COMPLETED') throw new \LogicException('Device/care creation requires a completed order.');
        if ($items === []) throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Đơn hoàn tất không có dòng hàng để tạo thiết bị.');

        $completedInstant = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $completedAt = $completedInstant->format('Y-m-d H:i:s');
        $completedLocalDate = $completedInstant->setTimezone(new \DateTimeZone('Asia/Ho_Chi_Minh'))->format('Y-m-d');
        $productStatement = $pdo->prepare('SELECT p.id, p.category_id FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.id = ?');
        $deviceInsert = $pdo->prepare("INSERT INTO owned_devices
            (customer_id, order_item_id, unit_number, product_id, variant_id, product_name_snapshot, sku_snapshot,
             purchased_at, completed_at, warranty_months_snapshot, warranty_start_date, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'ACTIVE')
            ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)");
        $ruleStatement = $pdo->prepare("SELECT id, rule_key, first_due_days FROM care_rules
            WHERE status = 'ACTIVE' AND (product_id = ? OR category_id = ?)
            ORDER BY CASE WHEN product_id = ? THEN 0 ELSE 1 END, id");
        $taskInsert = $pdo->prepare("INSERT INTO care_tasks
            (owned_device_id, care_rule_id, cycle_number, original_due_date, due_date, status)
            VALUES (?, ?, 1, ?, ?, 'DUE') ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)");

        foreach ($items as $item) {
            $quantity = filter_var($item['quantity'] ?? null, FILTER_VALIDATE_INT);
            $variantId = filter_var($item['variant_id'] ?? null, FILTER_VALIDATE_INT);
            $itemId = filter_var($item['id'] ?? null, FILTER_VALIDATE_INT);
            if (!$quantity || $quantity < 1 || $quantity > 1000 || !$variantId || !$itemId || (string) ($item['order_id'] ?? '') !== (string) $order['id']) {
                throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Dòng hàng không đủ dữ liệu để tạo hồ sơ thiết bị.');
            }
            $productStatement->execute([$variantId]);
            $product = $productStatement->fetch(\PDO::FETCH_ASSOC);
            if (!$product) throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Không còn tìm thấy sản phẩm của dòng hàng đã mua.');

            $ruleStatement->execute([$product['id'], $product['category_id'], $product['id']]);
            $rulesByKey = [];
            foreach ($ruleStatement->fetchAll(\PDO::FETCH_ASSOC) as $rule) {
                // A product rule takes precedence over a category rule with the same key.
                if (!array_key_exists($rule['rule_key'], $rulesByKey)) $rulesByKey[$rule['rule_key']] = $rule;
            }

            for ($unit = 1; $unit <= $quantity; $unit++) {
                $deviceInsert->execute([
                    $order['customer_id'], $itemId, $unit, $product['id'], $variantId,
                    $item['product_name'], $item['sku'], $order['placed_at'], $completedAt, (int) $item['warranty_months'],
                ]);
                $deviceId = (string) $pdo->lastInsertId();
                foreach ($rulesByKey as $rule) {
                    $days = (int) $rule['first_due_days'];
                    $dueDate = (new \DateTimeImmutable($completedLocalDate, new \DateTimeZone('Asia/Ho_Chi_Minh')))->modify('+' . $days . ' days')->format('Y-m-d');
                    $taskInsert->execute([$deviceId, $rule['id'], $dueDate, $dueDate]);
                }
            }
        }
    }
}
