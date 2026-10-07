<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

interface CheckoutServiceInterface
{
    public function quoteCheckout(array $principal, array $input): array;
    public function createOrder(array $principal, array $input, string $key): array;
}

// Chỉ triển khai transaction sau khi auth/cart/address/voucher/SKU/kho được owner duyệt.
final class CheckoutService implements CheckoutServiceInterface
{
    // Chưa tính quote thật khi repository giỏ/địa chỉ/voucher/SKU chưa tích hợp.
    public function quoteCheckout(array $principal, array $input): array
    {
        throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Dịch vụ thanh toán đơn hàng chưa sẵn sàng.');
    }

    // Chưa tạo đơn/giữ tồn; 503 bảo đảm frontend không báo thành công giả.
    public function createOrder(array $principal, array $input, string $key): array
    {
        throw new ApiException(503, 'SERVICE_UNAVAILABLE', 'Chưa thể tạo đơn hàng. Vui lòng thử lại sau.');
    }
}
