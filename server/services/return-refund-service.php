<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class ReturnRefundService
{
    public function __construct(private readonly \PDO $pdo, private readonly ReturnRefundModel $model) {}

    public function list(array $principal, array $filters): array
    {
        (new OrderModel($this->pdo))->requireActor($principal, ['SALES', 'ADMIN', 'WAREHOUSE']);
        return $this->model->page($filters);
    }

    public function detail(array $principal, string $returnId): array
    {
        (new OrderModel($this->pdo))->requireActor($principal, ['SALES', 'ADMIN', 'WAREHOUSE']);
        return $this->model->detail(orderDatabaseId($returnId, 'returnId'));
    }

    // SALES assigns severity; only major/critical cases enter the administrator queue.
    public function triage(array $principal, string $returnId, array $input, string $key): array
    {
        $actorModel = new OrderModel($this->pdo);
        $actorModel->requireActor($principal, ['SALES']);
        $id = orderDatabaseId($returnId, 'returnId');
        $key = orderIdempotencyKey(['idempotency-key' => $key]);
        return (new OrderIdempotencyModel($this->pdo))->run($principal, 'return-triage:' . $id, $key, $input, function () use ($id, $principal, $input) {
            $request = $this->model->lock($id);
            if ($request['status'] !== 'REQUESTED') throw new ApiException(409, 'RETURN_STATE_CONFLICT', 'Yêu cầu trả hàng đã được phân loại.');
            $this->model->triage($request, $principal, $input['severity'], $input['note']);
            $result = $this->model->detail($id);
            (new \AuditModel($this->pdo))->record((int) $principal['id'], $principal['role'], 'RETURN_TRIAGED', 'return_request', (int) $id, ['severity' => $input['severity'], 'status' => strtoupper($result['status'])]);
            $notifications = new \NotificationModel($this->pdo);
            $notifications->create((int) $request['customer_id'], 'return:' . $id . ':status:' . strtoupper($result['status']), 'RETURN', 'Cập nhật yêu cầu trả hàng', $result['status'] === 'pending_manager' ? 'Yêu cầu trả hàng đã được chuyển đến quản lý để xét duyệt.' : 'Yêu cầu trả hàng chưa đủ điều kiện để chuyển duyệt.', '/orders/' . $request['order_id']);
            if ($result['status'] === 'pending_manager') {
                foreach ($notifications->activeRecipientIds('ADMIN') as $recipientId) {
                    $notifications->create($recipientId, 'return:' . $id . ':manager-review', 'RETURN', 'Yêu cầu trả hàng cần quản lý duyệt', 'Có yêu cầu mức ' . strtolower($input['severity']) . ' đang chờ xét duyệt.', '/sales/returns');
                }
            }
            return $result;
        });
    }

    // Only ADMIN acts as the fixed-role management approver.
    public function decide(array $principal, string $returnId, array $input, string $key): array
    {
        (new OrderModel($this->pdo))->requireActor($principal, ['ADMIN']);
        $id = orderDatabaseId($returnId, 'returnId');
        $key = orderIdempotencyKey(['idempotency-key' => $key]);
        return (new OrderIdempotencyModel($this->pdo))->run($principal, 'return-decision:' . $id, $key, $input, function () use ($id, $principal, $input) {
            $request = $this->model->lock($id);
            if ($request['status'] !== 'PENDING_MANAGER' || !in_array($request['severity'], ['MAJOR', 'CRITICAL'], true)) {
                throw new ApiException(409, 'RETURN_NOT_PENDING_MANAGER', 'Chỉ yêu cầu mức nặng/nghiêm trọng đang chờ mới được quản lý duyệt.');
            }
            $this->model->decide($request, $principal, $input['decision'], $input['reason']);
            $result = $this->model->detail($id);
            (new \AuditModel($this->pdo))->record((int) $principal['id'], $principal['role'], 'RETURN_DECIDED', 'return_request', (int) $id, ['decision' => $input['decision'], 'status' => strtoupper($result['status']), 'severity' => $request['severity']]);
            $notifications = new \NotificationModel($this->pdo);
            $notifications->create((int) $request['customer_id'], 'return:' . $id . ':status:' . strtoupper($result['status']), 'RETURN', 'Kết quả xét duyệt trả hàng', $result['status'] === 'approved' ? 'Yêu cầu trả hàng đã được duyệt. Vui lòng chờ kho kiểm nhận.' : 'Yêu cầu trả hàng đã bị từ chối sau khi quản lý xem xét.', '/orders/' . $request['order_id']);
            if ($result['status'] === 'approved') {
                foreach ($notifications->activeRecipientIds('WAREHOUSE') as $recipientId) {
                    $notifications->create($recipientId, 'return:' . $id . ':warehouse-receive', 'RETURN', 'Yêu cầu trả hàng chờ kho kiểm nhận', 'Yêu cầu trả hàng cho đơn #' . $result['order']['code'] . ' đã được duyệt và đang chờ kho kiểm nhận.', '/warehouse/returns');
                }
            }
            return $result;
        });
    }

    // Warehouse confirms receipt and inspection; a full simulated refund is committed once with the audit row.
    public function receive(array $principal, string $returnId, array $input, string $key): array
    {
        $orderModel = new OrderModel($this->pdo);
        $orderModel->requireActor($principal, ['WAREHOUSE']);
        $id = orderDatabaseId($returnId, 'returnId');
        $key = orderIdempotencyKey(['idempotency-key' => $key]);
        return (new OrderIdempotencyModel($this->pdo))->run($principal, 'return-receive:' . $id, $key, $input, function () use ($id, $principal, $input, $orderModel) {
            $request = $this->model->lock($id);
            if ($request['status'] !== 'APPROVED') throw new ApiException(409, 'RETURN_NOT_APPROVED', 'Yêu cầu phải được quản lý duyệt trước khi nhận hàng trả.');
            foreach (['packageReceived', 'orderMatched', 'allItemsPresent', 'conditionAssessed'] as $item) {
                if (!$input['checklist'][$item]) throw new ApiException(409, 'RETURN_INSPECTION_INCOMPLETE', 'Cần xác nhận đầy đủ checklist trước khi ghi nhận nhận hàng và hoàn tiền.');
            }
            $order = $orderModel->find((string) $request['order_id'], null, true);
            if (!in_array($order['order_status'], ['DELIVERED', 'COMPLETED'], true) || $order['payment_status'] !== 'PAID') {
                throw new ApiException(409, 'RETURN_PAYMENT_CONFLICT', 'Đơn không còn đủ điều kiện hoàn tiền.');
            }
            $payments = new PaymentModel($this->pdo);
            $lockedPayments = $payments->lock((string) $order['id']);
            $payments->assertSettled($order, $lockedPayments);
            $paid = array_values(array_filter($lockedPayments, static fn ($payment) => $payment['status'] === 'PAID'));
            $returnedDeviceCount = $this->model->receiveAndRefund($request, $order, $principal, $paid[0], $input['checklist'], orderMoney($order['total_amount']));
            $result = $this->model->detail($id);
            $checklist = array_intersect_key($input['checklist'], array_flip(['packageReceived', 'orderMatched', 'allItemsPresent', 'conditionAssessed']));
            (new \AuditModel($this->pdo))->record((int) $principal['id'], $principal['role'], 'RETURN_REFUND_SIMULATED', 'return_request', (int) $id, ['orderId' => (int) $order['id'], 'amount' => orderMoney($order['total_amount']), 'refundStatus' => 'SIMULATED', 'returnedDeviceCount' => $returnedDeviceCount, 'checklist' => $checklist]);
            (new \NotificationModel($this->pdo))->create((int) $request['customer_id'], 'return:' . $id . ':status:REFUNDED', 'RETURN', 'Đã ghi nhận hoàn tiền mô phỏng', 'Kho đã kiểm nhận hàng trả. Hệ thống đã ghi nhận khoản hoàn tiền mô phỏng cho đơn #' . $order['order_code'] . '.', '/orders/' . $order['id']);
            return $result;
        });
    }
}
