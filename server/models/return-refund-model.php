<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class ReturnRefundModel
{
    public function __construct(private readonly \PDO $pdo) {}

    // Filter and paginate return requests without loading order lines for every row.
    public function page(array $filters): array
    {
        $where = ['rr.is_deleted = 0', 'o.is_deleted = 0'];
        $values = [];
        if ($filters['status'] !== '') { $where[] = 'rr.status = ?'; $values[] = strtoupper($filters['status']); }
        if ($filters['severity'] !== '') { $where[] = 'rr.severity = ?'; $values[] = strtoupper($filters['severity']); }
        if ($filters['search'] !== '') {
            $where[] = "(o.order_code LIKE ? ESCAPE '=' OR u.full_name LIKE ? ESCAPE '=')";
            $term = '%' . strtr($filters['search'], ['=' => '==', '%' => '=%', '_' => '=_']) . '%';
            array_push($values, $term, $term);
        }
        $clause = implode(' AND ', $where);
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM order_return_requests rr JOIN orders o ON o.id = rr.order_id JOIN users u ON u.id = rr.customer_id WHERE ' . $clause);
        $count->execute($values);
        $total = (int) $count->fetchColumn();
        $offset = ($filters['page'] - 1) * $filters['pageSize'];
        $statement = $this->pdo->prepare('SELECT rr.id, rr.order_id, rr.status, rr.issue_category, rr.severity, rr.reason, rr.created_at, rr.updated_at,
            o.order_code, o.order_status, o.payment_status, o.payment_method, o.total_amount, u.full_name AS customer_name
            FROM order_return_requests rr JOIN orders o ON o.id = rr.order_id JOIN users u ON u.id = rr.customer_id
            WHERE ' . $clause . ' ORDER BY rr.created_at DESC, rr.id DESC LIMIT ? OFFSET ?');
        foreach ($values as $index => $value) $statement->bindValue($index + 1, $value, \PDO::PARAM_STR);
        $statement->bindValue(count($values) + 1, $filters['pageSize'], \PDO::PARAM_INT);
        $statement->bindValue(count($values) + 2, $offset, \PDO::PARAM_INT);
        $statement->execute();
        $items = array_map(fn ($row) => [
            'id' => (string) $row['id'], 'orderId' => (string) $row['order_id'], 'orderCode' => $row['order_code'],
            'status' => strtolower($row['status']), 'issueCategory' => $row['issue_category'], 'severity' => $row['severity'] === null ? null : strtolower($row['severity']),
            'reason' => $row['reason'], 'createdAt' => orderIsoDate($row['created_at']), 'updatedAt' => orderIsoDate($row['updated_at']),
            'customerName' => $row['customer_name'], 'orderStatus' => strtolower($row['order_status']), 'paymentStatus' => strtolower($row['payment_status']),
            'paymentMethod' => $row['payment_method'], 'totalAmount' => orderMoney($row['total_amount']),
        ], $statement->fetchAll(\PDO::FETCH_ASSOC));
        return ['items' => $items, 'pagination' => ['page' => $filters['page'], 'pageSize' => $filters['pageSize'], 'totalItems' => $total, 'totalPages' => (int) ceil($total / $filters['pageSize'])]];
    }

    // Load one request, its immutable order lines, decision audit, receipt checklist and refund ledger.
    public function detail(string $id): array
    {
        $statement = $this->pdo->prepare('SELECT rr.*, o.order_code, o.order_status, o.payment_status, o.payment_method, o.total_amount, o.placed_at,
            o.recipient_name, o.recipient_phone, o.shipping_address, u.full_name AS customer_name, r.amount AS refund_amount,
            r.status AS refund_status, r.created_at AS refund_created_at
            FROM order_return_requests rr JOIN orders o ON o.id = rr.order_id JOIN users u ON u.id = rr.customer_id
            LEFT JOIN order_simulated_refunds r ON r.return_request_id = rr.id
            WHERE rr.id = ? AND rr.is_deleted = 0 AND o.is_deleted = 0');
        $statement->execute([$id]);
        $row = $statement->fetch(\PDO::FETCH_ASSOC);
        if (!$row) throw new ApiException(404, 'RETURN_NOT_FOUND', 'Không tìm thấy yêu cầu trả hàng.');
        $lines = $this->pdo->prepare('SELECT id, variant_id, sku, product_name, variant_name, unit_price, quantity, line_total, image_url FROM order_items WHERE order_id = ? AND is_deleted = 0 ORDER BY id');
        $lines->execute([$row['order_id']]);
        $items = array_map(fn ($item) => ['orderItemId' => (string) $item['id'], 'skuId' => (string) $item['variant_id'], 'skuCode' => $item['sku'],
            'productName' => $item['product_name'], 'variantName' => $item['variant_name'], 'unitPrice' => orderMoney($item['unit_price']),
            'quantity' => (int) $item['quantity'], 'lineTotal' => orderMoney($item['line_total']), 'imageUrl' => $item['image_url'] ?? ''], $lines->fetchAll(\PDO::FETCH_ASSOC));
        $checklist = $row['inspection_checklist'] === null ? null : json_decode($row['inspection_checklist'], true, 32, JSON_THROW_ON_ERROR);
        $historyStatement = $this->pdo->prepare('SELECT h.from_status, h.to_status, h.action, h.actor_role, h.note, h.details, h.changed_at, u.full_name AS actor_name
            FROM order_return_status_history h JOIN users u ON u.id = h.actor_id
            WHERE h.return_request_id = ? ORDER BY h.changed_at, h.id');
        $historyStatement->execute([$id]);
        $history = array_map(static function (array $event): array {
            return [
                'fromStatus' => $event['from_status'] === null ? null : strtolower($event['from_status']),
                'toStatus' => strtolower($event['to_status']), 'action' => strtolower($event['action']),
                'actorRole' => $event['actor_role'], 'actorName' => $event['actor_name'], 'note' => $event['note'],
                'details' => $event['details'] === null ? null : json_decode($event['details'], true, 32, JSON_THROW_ON_ERROR),
                'changedAt' => orderIsoDate($event['changed_at']),
            ];
        }, $historyStatement->fetchAll(\PDO::FETCH_ASSOC));
        return [
            'id' => (string) $row['id'], 'orderId' => (string) $row['order_id'], 'status' => strtolower($row['status']),
            'issueCategory' => $row['issue_category'], 'severity' => $row['severity'] === null ? null : strtolower($row['severity']),
            'reason' => $row['reason'], 'triageNote' => $row['triage_note'], 'decisionReason' => $row['decision_reason'],
            'createdAt' => orderIsoDate($row['created_at']), 'updatedAt' => orderIsoDate($row['updated_at']),
            'triagedAt' => $row['triaged_at'] === null ? null : orderIsoDate($row['triaged_at']),
            'managerDecidedAt' => $row['manager_decided_at'] === null ? null : orderIsoDate($row['manager_decided_at']),
            'receivedAt' => $row['received_at'] === null ? null : orderIsoDate($row['received_at']), 'inspectionChecklist' => $checklist,
            'refundAmount' => $row['refund_amount'] === null ? null : orderMoney($row['refund_amount']),
            'refundStatus' => $row['refund_status'] === null ? null : strtolower($row['refund_status']),
            'refundCreatedAt' => $row['refund_created_at'] === null ? null : orderIsoDate($row['refund_created_at']),
            'history' => $history,
            'customer' => ['name' => $row['customer_name'], 'phone' => $row['recipient_phone']],
            'order' => ['code' => $row['order_code'], 'status' => strtolower($row['order_status']), 'paymentStatus' => strtolower($row['payment_status']),
                'paymentMethod' => $row['payment_method'], 'totalAmount' => orderMoney($row['total_amount']), 'placedAt' => orderIsoDate($row['placed_at']),
                'shippingAddress' => $row['shipping_address'], 'items' => $items],
        ];
    }

    // Lock a request before applying triage, approval or warehouse receipt.
    public function lock(string $id): array
    {
        if (!$this->pdo->inTransaction()) throw new \LogicException('Return lock requires a transaction.');
        $statement = $this->pdo->prepare('SELECT * FROM order_return_requests WHERE id = ? AND is_deleted = 0 FOR UPDATE');
        $statement->execute([$id]);
        $row = $statement->fetch(\PDO::FETCH_ASSOC);
        if (!$row) throw new ApiException(404, 'RETURN_NOT_FOUND', 'Không tìm thấy yêu cầu trả hàng.');
        return $row;
    }

    public function triage(array $request, array $actor, string $severity, string $note): void
    {
        $status = $severity === 'MINOR' ? 'REJECTED' : 'PENDING_MANAGER';
        $decision = $severity === 'MINOR' ? 'Mức độ nhẹ không chuyển duyệt hoàn hàng. ' . $note : null;
        $statement = $this->pdo->prepare('UPDATE order_return_requests SET severity = ?, triage_note = ?, triaged_by = ?, triaged_at = UTC_TIMESTAMP(), status = ?, decision_reason = ? WHERE id = ? AND status = \'REQUESTED\'');
        $statement->execute([$severity, $note, $actor['id'], $status, $decision, $request['id']]);
        if ($statement->rowCount() !== 1) throw new ApiException(409, 'RETURN_STATE_CONFLICT', 'Yêu cầu trả hàng đã được xử lý.');
        $this->recordHistory((string) $request['id'], 'REQUESTED', $status, 'SALES_TRIAGE', $actor, $note, ['severity' => $severity]);
    }

    public function decide(array $request, array $actor, string $decision, string $reason): void
    {
        $status = $decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
        $statement = $this->pdo->prepare('UPDATE order_return_requests SET status = ?, manager_decided_by = ?, manager_decided_at = UTC_TIMESTAMP(), decision_reason = ? WHERE id = ? AND status = \'PENDING_MANAGER\'');
        $statement->execute([$status, $actor['id'], $reason, $request['id']]);
        if ($statement->rowCount() !== 1) throw new ApiException(409, 'RETURN_STATE_CONFLICT', 'Yêu cầu không còn chờ quản lý duyệt.');
        $this->recordHistory((string) $request['id'], 'PENDING_MANAGER', $status, 'ADMIN_DECISION', $actor, $reason, ['decision' => $decision]);
    }

    // Record receipt and the full-order refund atomically after warehouse inspection.
    public function receiveAndRefund(array $return, array $order, array $actor, array $payment, array $checklist, int $amount): void
    {
        $insert = $this->pdo->prepare("INSERT INTO order_simulated_refunds (order_id, return_request_id, payment_id, amount, status, recorded_by, created_at) VALUES (?, ?, ?, ?, 'SIMULATED', ?, UTC_TIMESTAMP())");
        $insert->execute([$order['id'], $return['id'], $payment['id'], $amount, $actor['id']]);
        $paymentUpdate = $this->pdo->prepare("UPDATE payments SET status = 'REFUNDED' WHERE id = ? AND status = 'PAID'");
        $paymentUpdate->execute([$payment['id']]);
        if ($paymentUpdate->rowCount() !== 1) throw new ApiException(409, 'PAYMENT_CONFLICT', 'Khoản thanh toán đã thay đổi.');
        $orderUpdate = $this->pdo->prepare("UPDATE orders SET payment_status = 'REFUNDED', refund_required = FALSE, version = version + 1 WHERE id = ? AND version = ? AND payment_status = 'PAID'");
        $orderUpdate->execute([$order['id'], $order['version']]);
        if ($orderUpdate->rowCount() !== 1) throw new ApiException(409, 'PAYMENT_CONFLICT', 'Trạng thái thanh toán của đơn đã thay đổi.');
        $checklistJson = json_encode($checklist, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
        $requestUpdate = $this->pdo->prepare("UPDATE order_return_requests SET status = 'REFUNDED', received_by = ?, received_at = UTC_TIMESTAMP(), inspection_checklist = ?, updated_at = UTC_TIMESTAMP() WHERE id = ? AND status = 'APPROVED'");
        $requestUpdate->execute([$actor['id'], $checklistJson, $return['id']]);
        if ($requestUpdate->rowCount() !== 1) throw new ApiException(409, 'RETURN_STATE_CONFLICT', 'Yêu cầu trả hàng đã thay đổi.');
        $this->recordHistory((string) $return['id'], 'APPROVED', 'REFUNDED', 'WAREHOUSE_RECEIVED_AND_REFUNDED', $actor, $checklist['notes'], ['checklist' => $checklist, 'refundAmount' => $amount, 'refundStatus' => 'SIMULATED']);
    }

    // Write the transition event in the same transaction as the state mutation.
    private function recordHistory(string $id, string $from, string $to, string $action, array $actor, ?string $note, ?array $details = null): void
    {
        $statement = $this->pdo->prepare('INSERT INTO order_return_status_history (return_request_id, from_status, to_status, action, actor_id, actor_role, note, details, changed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())');
        $statement->execute([$id, $from, $to, $action, $actor['id'], $actor['role'], $note, $details === null ? null : json_encode($details, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
    }
}
