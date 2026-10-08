<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class OrderModel
{
    // All access uses one native-prepared PDO connection; no HTTP or stock arithmetic here.
    public function __construct(public readonly \PDO $pdo) {}

    // Refuse a stale role/disabled account even when a server session still exists.
    public function requireActor(array $principal, array $roles): void
    {
        requireOrderRole($principal, $roles);
        $statement = $this->pdo->prepare('SELECT role FROM users WHERE id = ? AND status = ? AND is_deleted = 0');
        $statement->execute([$principal['id'], 'ACTIVE']);
        $role = $statement->fetchColumn();
        if ($role === false) throw new ApiException(401, 'AUTH_REQUIRED', 'Tài khoản không còn hoạt động.');
        if ($role !== $principal['role']) throw new ApiException(403, 'FORBIDDEN', 'Quyền tài khoản đã thay đổi. Vui lòng đăng nhập lại.');
    }

    // Filter before pagination; literal LIKE escape and unique parameters prevent wildcard injection.
    public function page(array $principal, array $filters, bool $sales): array
    {
        $where = ['o.is_deleted = 0'];
        $parameters = [];
        if (!$sales) { $where[] = 'o.customer_id = ?'; $parameters[] = $principal['id']; }
        if ($filters['statuses'] !== []) {
            $where[] = 'o.order_status IN (' . implode(',', array_fill(0, count($filters['statuses']), '?')) . ')';
            array_push($parameters, ...array_map('strtoupper', $filters['statuses']));
        }
        if ($sales && $filters['search'] !== '') {
            $where[] = "(o.order_code LIKE ? ESCAPE '=' OR o.recipient_name LIKE ? ESCAPE '=' OR o.recipient_phone LIKE ? ESCAPE '=')";
            $term = '%' . strtr($filters['search'], ['=' => '==', '%' => '=%', '_' => '=_']) . '%';
            array_push($parameters, $term, $term, $term);
        }
        $clause = implode(' AND ', $where);
        // Count and items share a read snapshot, preventing impossible pagination under concurrent writes.
        $ownsTransaction = !$this->pdo->inTransaction();
        if ($ownsTransaction) {
            $this->pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
            $this->pdo->beginTransaction();
        }
        try {
            $statement = $this->pdo->prepare('SELECT COUNT(*) FROM orders o WHERE ' . $clause);
            $statement->execute($parameters);
            $total = (int) $statement->fetchColumn();
            $offset = ($filters['page'] - 1) * $filters['pageSize'];
            if (!is_int($offset) || $offset > MAX_ORDER_INTEGER) throw new ApiException(422, 'INVALID_INPUT', 'Trang ngoài giới hạn.');
            $statement = $this->pdo->prepare('SELECT o.* FROM orders o WHERE ' . $clause . ' ORDER BY o.placed_at DESC, o.id DESC LIMIT ? OFFSET ?');
            foreach ($parameters as $index => $parameter) $statement->bindValue($index + 1, $parameter, \PDO::PARAM_STR);
            $statement->bindValue(count($parameters) + 1, $filters['pageSize'], \PDO::PARAM_INT);
            $statement->bindValue(count($parameters) + 2, $offset, \PDO::PARAM_INT);
            $statement->execute();
            $rows = $statement->fetchAll(\PDO::FETCH_ASSOC);
            $items = $this->itemsFor(array_column($rows, 'id'));
            $result = ['items' => array_map(fn ($row) => $this->dto($row, $items[(string) $row['id']] ?? [], false, $sales), $rows),
                'pagination' => ['page' => $filters['page'], 'pageSize' => $filters['pageSize'], 'totalItems' => $total, 'totalPages' => (int) ceil($total / $filters['pageSize'])]];
            if ($ownsTransaction) $this->pdo->commit();
            return $result;
        } catch (\Throwable $error) {
            if ($ownsTransaction && $this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
    }

    // Ownership is a SQL predicate, not a frontend filter; foreign/unknown IDs both return 404.
    public function find(string $orderId, ?string $ownerId, bool $lock = false): array
    {
        $sql = 'SELECT * FROM orders WHERE id = ? AND is_deleted = 0';
        $parameters = [$orderId];
        if ($ownerId !== null) { $sql .= ' AND customer_id = ?'; $parameters[] = $ownerId; }
        if ($lock) {
            if (!$this->pdo->inTransaction()) throw new \LogicException('Order lock requires a transaction.');
            $sql .= ' FOR UPDATE';
        }
        $statement = $this->pdo->prepare($sql);
        $statement->execute($parameters);
        $row = $statement->fetch(\PDO::FETCH_ASSOC);
        if (!$row) throw new ApiException(404, 'ORDER_NOT_FOUND', 'Không tìm thấy đơn hàng.');
        return $row;
    }

    // One batch loads immutable item snapshots for a page, never current catalog prices.
    public function itemsFor(array $ids): array
    {
        if ($ids === []) return [];
        $statement = $this->pdo->prepare('SELECT * FROM order_items WHERE order_id IN (' . implode(',', array_fill(0, count($ids), '?')) . ') AND is_deleted = 0 ORDER BY order_id, id');
        $statement->execute($ids);
        $result = [];
        foreach ($statement->fetchAll(\PDO::FETCH_ASSOC) as $item) $result[(string) $item['order_id']][] = $item;
        return $result;
    }

    // Detail reads use one consistent snapshot; mutation callers already own their transaction.
    public function detail(string $id, ?string $ownerId, bool $sales): array
    {
        $ownsTransaction = !$this->pdo->inTransaction();
        if ($ownsTransaction) {
            $this->pdo->exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
            $this->pdo->beginTransaction();
        }
        try {
            $row = $this->find($id, $ownerId);
            $items = $this->itemsFor([$id])[$id] ?? [];
            $result = $this->dto($row, $items, true, $sales);
            if ($ownsTransaction) $this->pdo->commit();
            return $result;
        } catch (\Throwable $error) {
            if ($ownsTransaction && $this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
    }

    // Strict mapping catches legacy fractional money/history instead of fabricating snapshots.
    private function dto(array $row, array $items, bool $detail, bool $sales): array
    {
        $status = strtolower($row['order_status']);
        $payment = strtolower($row['payment_status']);
        if (!in_array($status, ORDER_STATUSES, true) || !in_array($payment, ['unpaid', 'pending', 'paid', 'failed', 'refunded'], true) || !in_array($row['payment_method'], ['COD', 'VNPAY'], true)) {
            throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Dữ liệu trạng thái cần được chuẩn hóa.');
        }
        $totals = ['subtotal' => orderMoney($row['subtotal']), 'discount' => orderMoney($row['discount_amount']), 'shipping' => orderMoney($row['shipping_fee']), 'total' => orderMoney($row['total_amount'])];
        if ($totals['discount'] > $totals['subtotal'] || $totals['total'] !== $totals['subtotal'] - $totals['discount'] + $totals['shipping']) {
            throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Tổng tiền snapshot không hợp lệ.');
        }
        $version = orderMoney($row['version']);
        if ($version < 1) throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Phiên bản đơn không hợp lệ.');
        $lineSum = 0;
        foreach ($items as $item) {
            $quantity = orderMoney($item['quantity']);
            $price = orderMoney($item['unit_price']);
            if ($quantity < 1 || $price > intdiv(MAX_ORDER_INTEGER, $quantity)) throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Dòng hàng snapshot không hợp lệ.');
            $line = $price * $quantity;
            if (orderMoney($item['line_total']) !== $line || $lineSum > MAX_ORDER_INTEGER - $line) throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Tiền dòng hàng snapshot không hợp lệ.');
            $lineSum += $line;
        }
        if ($items === [] || $lineSum !== $totals['subtotal']) throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Snapshot dòng hàng không khớp tổng tiền.');
        $result = ['id' => (string) $row['id'], 'code' => $row['order_code'], 'version' => $version, 'orderStatus' => $status, 'paymentStatus' => $payment,
            'paymentMethod' => $row['payment_method'], 'createdAt' => orderIsoDate($row['placed_at']), 'totals' => $totals,
            'items' => array_map(fn ($item) => ['orderItemId' => (string) $item['id'], 'skuId' => (string) $item['variant_id'], 'skuCode' => $item['sku'],
                'productName' => $item['product_name'], 'variantName' => $item['variant_name'], 'unitPrice' => orderMoney($item['unit_price']),
                'quantity' => (int) $item['quantity'], 'warrantyMonths' => (int) $item['warranty_months'], 'imageUrl' => $item['image_url'] ?? ''], $items)];
        if ($sales) { $result['customerName'] = $row['recipient_name']; $result['customerPhone'] = $row['recipient_phone']; }
        if ($detail) {
            $result['shippingAddress'] = ['recipientName' => $row['recipient_name'], 'phone' => $row['recipient_phone'], 'addressLine' => $row['shipping_address']];
            $result['note'] = $row['customer_note'] ?? '';
            $result['refundRequired'] = (bool) $row['refund_required'];
            $statement = $this->pdo->prepare('SELECT * FROM order_status_history WHERE order_id = ? AND is_deleted = 0 ORDER BY changed_at, id');
            $statement->execute([$row['id']]);
            $result['history'] = array_map(function ($entry) {
                $to = strtolower($entry['status']);
                $from = $entry['from_status'] === null ? null : strtolower($entry['from_status']);
                if (!in_array($entry['actor_role'], ['CUSTOMER', 'SALES', 'ADMIN', 'SYSTEM'], true) || !in_array($to, ORDER_STATUSES, true) || ($from !== null && !in_array($from, ORDER_STATUSES, true))) {
                    throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Lịch sử cũ cần được xác minh, không tự suy diễn người xử lý.');
                }
                return ['fromStatus' => $from, 'toStatus' => $to, 'actorId' => $entry['changed_by'] === null ? null : (string) $entry['changed_by'],
                    'actorRole' => $entry['actor_role'], 'reason' => $entry['note'], 'createdAt' => orderIsoDate($entry['changed_at'])];
            }, $statement->fetchAll(\PDO::FETCH_ASSOC));
            $result['returnRequest'] = $this->returnRequest((string) $row['id']);
        }
        return $result;
    }

    // The locked order serializes transitions; version condition remains a second safety check.
    public function transition(array $order, array $actor, array $input, array $decision): void
    {
        $statement = $this->pdo->prepare('UPDATE orders SET order_status = ?, payment_status = ?, refund_required = ?, inventory_state = ?, version = version + 1 WHERE id = ? AND version = ?');
        $inventory = $decision['to'] === 'shipping' ? 'CONSUMED' : ($decision['to'] === 'cancelled' ? 'RELEASED' : $order['inventory_state']);
        $statement->execute([strtoupper($decision['to']), strtoupper($decision['payment']), (int) $decision['refundRequired'], $inventory, $order['id'], $input['expectedVersion']]);
        if ($statement->rowCount() !== 1) throw new ApiException(409, 'ORDER_VERSION_CONFLICT', 'Đơn hàng đã thay đổi.');
        $this->appendHistory((string) $order['id'], $decision['from'], $decision['to'], $actor, $input['reason'] ?? null);
    }

    // History is append-only in module code, captured with immutable actor role and UTC time.
    public function appendHistory(string $id, ?string $from, string $to, array $actor, ?string $reason): void
    {
        $statement = $this->pdo->prepare('INSERT INTO order_status_history (order_id, changed_by, status, note, changed_at, from_status, actor_role) VALUES (?, ?, ?, ?, UTC_TIMESTAMP(), ?, ?)');
        $statement->execute([$id, $actor['id'], strtoupper($to), $reason, $from === null ? null : strtoupper($from), $actor['role']]);
    }

    // Separate return lifecycle: this read never changes order/payment/stock.
    public function returnRequest(string $orderId): ?array
    {
        $statement = $this->pdo->prepare('SELECT * FROM order_return_requests WHERE order_id = ?');
        $statement->execute([$orderId]);
        $row = $statement->fetch(\PDO::FETCH_ASSOC);
        return $row ? ['id' => (string) $row['id'], 'orderId' => (string) $row['order_id'], 'status' => strtolower($row['status']), 'reason' => $row['reason'], 'createdAt' => orderIsoDate($row['created_at'])] : null;
    }

    // Exactly one request per order until a team-approved adjudication/reopen policy is added.
    public function insertReturnRequest(array $order, array $actor, string $reason): array
    {
        if ($this->returnRequest((string) $order['id'])) throw new ApiException(409, 'RETURN_REQUEST_EXISTS', 'Đơn đã có yêu cầu trả hàng.');
        $statement = $this->pdo->prepare('INSERT INTO order_return_requests (order_id, customer_id, reason, created_at) VALUES (?, ?, ?, UTC_TIMESTAMP())');
        $statement->execute([$order['id'], $actor['id'], $reason]);
        return $this->returnRequest((string) $order['id']);
    }
}
