<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

// Controller chỉ điều phối context đã qua middleware và đóng response envelope.
final class OrderController
{
    // Nhận service qua interface để tách HTTP khỏi lưu trữ và test double.
    public function __construct(private readonly OrderServiceInterface $service)
    {
    }

    // Chuyển principal và bộ lọc đã chuẩn hóa tới danh sách đơn của khách.
    public function listCustomerOrders(array $request): array
    {
        return apiSuccess($this->service->listCustomerOrders($request['principal'], $request['input']));
    }

    // Service chịu trách nhiệm kiểm tra owner trước khi trả detail/timeline.
    public function getCustomerOrder(array $request): array
    {
        return apiSuccess($this->service->getCustomerOrder($request['principal'], $request['orderId']));
    }

    // Chuyển version/lý do/key hủy; không hoàn kho tại controller.
    public function cancelOrder(array $request): array
    {
        return apiSuccess($this->service->cancelOrder($request['principal'], $request['orderId'], $request['input'], $request['idempotencyKey']));
    }

    // Giao mua lại cho service để dùng giỏ và giá SKU hiện hành.
    public function reorder(array $request): array
    {
        return apiSuccess($this->service->reorder($request['principal'], $request['orderId'], $request['input'], $request['idempotencyKey']));
    }

    // Danh sách nhân viên dùng endpoint và bộ lọc riêng đã qua role guard.
    public function listSalesOrders(array $request): array
    {
        return apiSuccess($this->service->listSalesOrders($request['principal'], $request['input']));
    }

    // Lấy detail theo quyền SALES/ADMIN, không dùng DTO danh sách thay detail.
    public function getSalesOrder(array $request): array
    {
        return apiSuccess($this->service->getSalesOrder($request['principal'], $request['orderId']));
    }

    // Giao state transition và audit cho service với actor lấy từ session.
    public function updateSalesStatus(array $request): array
    {
        return apiSuccess($this->service->updateSalesStatus($request['principal'], $request['orderId'], $request['input'], $request['idempotencyKey']));
    }
}
