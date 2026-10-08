<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

interface OrderServiceInterface
{
    public function listCustomerOrders(array $principal, array $filters): array;
    public function getCustomerOrder(array $principal, string $orderId): array;
    public function cancelOrder(array $principal, string $orderId, array $input, string $key): array;
    public function reorder(array $principal, string $orderId, array $input, string $key): array;
    public function listSalesOrders(array $principal, array $filters): array;
    public function getSalesOrder(array $principal, string $orderId): array;
    public function updateSalesStatus(array $principal, string $orderId, array $input, string $key): array;
    public function createReturnRequest(array $principal, string $orderId, array $input, string $key): array;
}

// Đinh Tùng supplies the reviewed device/care bridge: same PDO/TX, idempotent per order item.
interface OrderCompletionDependencies
{
    public function createDevicesAndCare(\PDO $pdo, array $principal, array $order, array $items): void;
}

// MySQL order domain; cart/voucher/inventory adapters remain explicitly owner-reviewed dependencies.
final class OrderService implements OrderServiceInterface
{
    // Dependency wiring is explicit; null keeps default runtime fail-closed until DB is configured.
    public function __construct(private readonly ?OrderModel $model = null, private readonly ?CheckoutDependencies $dependencies = null, private readonly ?OrderCompletionDependencies $completion = null) {}

    // Read/write services verify active DB actor as well as middleware role.
    private function model(array $principal, array $roles): OrderModel
    {
        if ($this->model === null) $this->unavailable();
        $this->model->requireActor($principal, $roles);
        return $this->model;
    }

    // Fail closed khi chưa có repository/transaction, không trả fixture thành công.
    private function unavailable(): never
    {
        throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Dịch vụ đơn hàng chưa sẵn sàng.');
    }

    // Owner and filters are SQL predicates applied before pagination.
    public function listCustomerOrders(array $principal, array $filters): array
    {
        return $this->model($principal, ['CUSTOMER'])->page($principal, $filters, false);
    }

    // Return immutable item/address/audit snapshots, scoped to session owner.
    public function getCustomerOrder(array $principal, string $orderId): array
    {
        return $this->model($principal, ['CUSTOMER'])->detail(orderDatabaseId($orderId, 'orderId'), $principal['id'], false);
    }

    // Cancellation and inventory release share one transaction; missing owner adapter is 503.
    public function cancelOrder(array $principal, string $orderId, array $input, string $key): array
    {
        $model = $this->model($principal, ['CUSTOMER']);
        return $this->change($model, $principal, $orderId, validateOrderMutation($input, 'cancel') + ['toStatus' => 'cancelled'], $key, true);
    }

    // Transaction mua lại sẽ dùng giá/tồn SKU và cartVersion hiện hành.
    public function reorder(array $principal, string $orderId, array $input, string $key): array
    {
        $model = $this->model($principal, ['CUSTOMER']);
        $id = orderDatabaseId($orderId, 'orderId');
        $input = validateOrderMutation($input, 'reorder');
        orderIdempotencyKey(['idempotency-key' => $key]);
        if ($this->dependencies === null) throw new ApiException(503, 'DEPENDENCY_NOT_READY', 'Giỏ hàng và SKU chưa được tích hợp.');
        return (new OrderIdempotencyModel($model->pdo))->run($principal, 'reorder:' . $id, $key, $input, function () use ($model, $principal, $id, $input) {
            $order = $model->find($id, $principal['id'], true);
            if (!in_array($order['order_status'], ['DELIVERED', 'COMPLETED', 'CANCELLED'], true)) throw new ApiException(409, 'REORDER_UNAVAILABLE', 'Đơn chưa thể mua lại.');
            $items = $model->itemsFor([$id])[$id] ?? [];
            return $this->dependencies->reorder($model->pdo, $principal, $order, $items, $input);
        });
    }

    // Authorized staff search is literal, bounded and paginated server-side.
    public function listSalesOrders(array $principal, array $filters): array
    {
        return $this->model($principal, ['SALES', 'ADMIN'])->page($principal, $filters, true);
    }

    // Staff detail requires active SALES/ADMIN from both session and database.
    public function getSalesOrder(array $principal, string $orderId): array
    {
        return $this->model($principal, ['SALES', 'ADMIN'])->detail(orderDatabaseId($orderId, 'orderId'), null, true);
    }

    // Validate locked state/version/payment and append audit atomically.
    public function updateSalesStatus(array $principal, string $orderId, array $input, string $key): array
    {
        $model = $this->model($principal, ['SALES', 'ADMIN']);
        return $this->change($model, $principal, $orderId, validateOrderMutation($input, 'status'), $key, false);
    }

    // Lock key -> order -> payment; dependency cancellation releases voucher/SKU in the SAME TX.
    private function change(OrderModel $model, array $principal, string $id, array $input, string $key, bool $customer): array
    {
        $id = orderDatabaseId($id, 'orderId');
        orderIdempotencyKey(['idempotency-key' => $key]);
        if ($input['toStatus'] === 'cancelled' && $this->dependencies === null) throw new ApiException(503, 'DEPENDENCY_NOT_READY', 'Quy tắc hoàn kho chưa được tích hợp.');
        if ($input['toStatus'] === 'completed' && $this->completion === null) throw new ApiException(503, 'DEPENDENCY_NOT_READY', 'Hồ sơ thiết bị và lịch bảo trì chưa được tích hợp.');
        return (new OrderIdempotencyModel($model->pdo))->run($principal, ($customer ? 'cancel:' : 'status:') . $id, $key, $input, function () use ($model, $principal, $id, $input, $customer) {
            $order = $model->find($id, $customer ? $principal['id'] : null, true);
            $payments = new PaymentModel($model->pdo);
            $lockedPayments = $payments->lock($id);
            $decision = orderTransition($order, $principal, $input);
            if ($order['payment_status'] === 'PAID') $payments->assertSettled($order, $lockedPayments);
            if ($decision['to'] === 'cancelled') {
                if ($order['inventory_state'] !== 'RESERVED') throw new ApiException(409, 'INVENTORY_UNTRACKED', 'Không có reservation hợp lệ để hoàn kho.');
                $this->dependencies->release($model->pdo, $principal, $order, $model->itemsFor([$id])[$id] ?? []);
            }
            if ($decision['to'] === 'delivered' && $order['payment_method'] === 'COD') $payments->collectCod($order, $lockedPayments);
            $model->transition($order, $principal, $input, $decision);
            if ($decision['to'] === 'completed') $this->completion->createDevicesAndCare($model->pdo, $principal, $model->find($id, null), $model->itemsFor([$id])[$id] ?? []);
            return $model->detail($id, $customer ? $principal['id'] : null, !$customer);
        });
    }

    // Create a request only; no automatic financial or inventory side effects.
    public function createReturnRequest(array $principal, string $orderId, array $input, string $key): array
    {
        $model = $this->model($principal, ['CUSTOMER']);
        $id = orderDatabaseId($orderId, 'orderId');
        $input = validateOrderMutation($input, 'return');
        orderIdempotencyKey(['idempotency-key' => $key]);
        return (new OrderIdempotencyModel($model->pdo))->run($principal, 'return:' . $id, $key, $input, function () use ($model, $principal, $id, $input) {
            $order = $model->find($id, $principal['id'], true);
            if ((int) $order['version'] !== $input['expectedVersion']) throw new ApiException(409, 'ORDER_VERSION_CONFLICT', 'Đơn hàng đã thay đổi.');
            if (!in_array($order['order_status'], ['DELIVERED', 'COMPLETED'], true) || $order['payment_status'] !== 'PAID') throw new ApiException(409, 'RETURN_UNAVAILABLE', 'Chỉ tạo yêu cầu trả hàng cho đơn đã giao và thanh toán.');
            $payments = new PaymentModel($model->pdo);
            $payments->assertSettled($order, $payments->lock($id));
            return $model->insertReturnRequest($order, $principal, $input['reason']);
        });
    }
}
