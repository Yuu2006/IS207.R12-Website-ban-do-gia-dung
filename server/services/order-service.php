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
}

// Điểm tích hợp repository/transaction tương lai; chưa đọc/ghi MySQL hoặc trả dữ liệu giả.
final class OrderService implements OrderServiceInterface
{
    // Fail closed khi chưa có repository/transaction, không trả fixture thành công.
    private function unavailable(): never
    {
        throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Dịch vụ đơn hàng chưa sẵn sàng.');
    }

    // Điểm nối truy vấn có owner và filter trước phân trang; hiện chưa có DB.
    public function listCustomerOrders(array $principal, array $filters): array
    {
        $this->unavailable();
    }

    // Điểm nối detail/timeline kiểm tra owner; hiện từ chối bằng 503.
    public function getCustomerOrder(array $principal, string $orderId): array
    {
        $this->unavailable();
    }

    // Transaction hủy/hoàn tồn một lần sẽ được nối sau mapping kho.
    public function cancelOrder(array $principal, string $orderId, array $input, string $key): array
    {
        $this->unavailable();
    }

    // Transaction mua lại sẽ dùng giá/tồn SKU và cartVersion hiện hành.
    public function reorder(array $principal, string $orderId, array $input, string $key): array
    {
        $this->unavailable();
    }

    // Điểm nối danh sách/search nhân viên; chưa đọc dữ liệu khách từ DB.
    public function listSalesOrders(array $principal, array $filters): array
    {
        $this->unavailable();
    }

    // Điểm nối detail cho SALES/ADMIN; không cung cấp dữ liệu giả.
    public function getSalesOrder(array $principal, string $orderId): array
    {
        $this->unavailable();
    }

    // Transaction kiểm tra state/version/payment và audit sẽ được triển khai tiếp.
    public function updateSalesStatus(array $principal, string $orderId, array $input, string $key): array
    {
        $this->unavailable();
    }
}
