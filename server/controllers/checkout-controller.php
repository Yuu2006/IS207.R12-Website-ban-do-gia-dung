<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

// Không tính giá, voucher hoặc kho trong controller.
final class CheckoutController
{
    // Inject interface để HTTP không phụ thuộc implementation lưu trữ.
    public function __construct(private readonly CheckoutServiceInterface $service)
    {
    }

    // Trả quote từ service; không tính giá/voucher từ dữ liệu giao diện.
    public function quoteCheckout(array $request): array
    {
        return apiSuccess($this->service->quoteCheckout($request['principal'], $request['input']));
    }

    // Chỉ trả 201 sau khi service thực sự tạo đơn thành công.
    public function createOrder(array $request): array
    {
        return apiSuccess($this->service->createOrder($request['principal'], $request['input'], $request['idempotencyKey']), 'Đơn hàng đã được tạo.', 201);
    }
}
