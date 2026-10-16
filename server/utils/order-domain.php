<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

const MAX_ORDER_INTEGER = 9007199254740991;
const ORDER_NEXT_STATUS = ['pending' => 'confirmed', 'confirmed' => 'preparing', 'preparing' => 'shipping', 'shipping' => 'delivered', 'delivered' => 'completed'];

// Map DECIMAL to integer VND exactly; fractional VND is rejected, never rounded silently.
function orderMoney(mixed $value): int
{
    if ((!is_string($value) && !is_int($value)) || preg_match('/^(0|[1-9][0-9]*)(?:\.0{1,2})?$/D', (string) $value) !== 1) {
        throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Dữ liệu tiền cần được chuẩn hóa.');
    }
    $whole = explode('.', (string) $value)[0];
    if (strlen($whole) > 16 || (strlen($whole) === 16 && strcmp($whole, (string) MAX_ORDER_INTEGER) > 0)) {
        throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Giá trị tiền ngoài giới hạn.');
    }
    return (int) $whole;
}

// Check multiplication before doing it, preventing PHP overflow/float promotion.
function orderLineTotal(int $price, int $quantity): int
{
    if ($price < 0 || $quantity < 1 || $price > intdiv(MAX_ORDER_INTEGER, $quantity)) {
        throw new ApiException(422, 'INVALID_INPUT', 'Số lượng hoặc giá trị dòng hàng ngoài giới hạn.');
    }
    return $price * $quantity;
}

// SQL timestamps written by this module are UTC; legacy DATETIME needs team verification.
function orderIsoDate(string $value): string
{
    $date = \DateTimeImmutable::createFromFormat('!Y-m-d H:i:s', $value, new \DateTimeZone('UTC'));
    if (!$date || $date->format('Y-m-d H:i:s') !== $value) {
        throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Thời gian đơn hàng không hợp lệ.');
    }
    return $date->format(DATE_ATOM);
}

// Canonical hashing preserves array order but removes object field-order differences.
function orderCanonicalHash(array $input): string
{
    $normalize = function (mixed $value) use (&$normalize): mixed {
        if (!is_array($value)) return $value;
        if (!array_is_list($value)) ksort($value, SORT_STRING);
        foreach ($value as $key => $item) $value[$key] = $normalize($item);
        return $value;
    };
    return hash('sha256', json_encode($normalize($input), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
}

// Validate the transition against a locked DB snapshot, independent of React state.
function orderTransition(array $order, array $principal, array $input): array
{
    $from = strtolower($order['order_status']);
    $to = $input['toStatus'];
    $payment = strtolower($order['payment_status']);
    $method = strtoupper($order['payment_method']);
    if (!array_key_exists($from, ORDER_NEXT_STATUS) && !in_array($from, ['completed', 'cancelled'], true)) {
        throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Trạng thái đơn hàng cần được chuẩn hóa.');
    }
    if ($principal['role'] === 'CUSTOMER' && ($to !== 'cancelled' || (string) $order['customer_id'] !== $principal['id'])) {
        throw new ApiException(403, 'FORBIDDEN', 'Bạn không có quyền xử lý đơn hàng này.');
    }
    if (!in_array($principal['role'], ['CUSTOMER', 'SALES', 'ADMIN'], true)) {
        throw new ApiException(403, 'FORBIDDEN', 'Bạn không có quyền xử lý đơn hàng.');
    }
    if ((int) $order['version'] !== $input['expectedVersion']) {
        throw new ApiException(409, 'ORDER_VERSION_CONFLICT', 'Đơn hàng đã thay đổi. Hãy tải lại.');
    }
    if ($input['expectedVersion'] >= MAX_ORDER_INTEGER) throw new ApiException(409, 'ORDER_VERSION_CONFLICT', 'Phiên bản đơn hàng vượt giới hạn.');
    if ($to === 'cancelled' ? !in_array($from, ['pending', 'confirmed', 'preparing'], true) : (ORDER_NEXT_STATUS[$from] ?? null) !== $to) {
        throw new ApiException(409, 'INVALID_ORDER_TRANSITION', 'Không thể chuyển sang trạng thái này.');
    }
    if (!in_array($method, ['COD', 'VNPAY'], true) || !in_array($payment, ['unpaid', 'pending', 'paid', 'failed', 'refunded'], true)) {
        throw new ApiException(503, 'ORDER_DATA_INCOMPATIBLE', 'Dữ liệu thanh toán cần được chuẩn hóa.');
    }
    if ($to === 'cancelled') {
        orderText($input['reason'] ?? '', 'reason', 1, 500);
    } elseif ($method === 'VNPAY' && $payment !== 'paid') {
        throw new ApiException(409, 'PAYMENT_NOT_PAID', 'Đơn VNPay chưa được máy chủ xác nhận thanh toán.');
    } elseif ($method === 'COD') {
        $expected = $from === 'delivered' ? 'paid' : 'unpaid';
        if ($payment !== $expected) throw new ApiException(409, 'PAYMENT_CONFLICT', 'Trạng thái thu tiền COD không hợp lệ.');
        if ($to === 'delivered' && ($input['codCollected'] ?? false) !== true) {
            throw new ApiException(422, 'COD_COLLECTION_REQUIRED', 'Cần xác nhận giao hàng và thu đủ tiền COD.');
        }
    }
    if (array_key_exists('codCollected', $input) && ($method !== 'COD' || $to !== 'delivered' || !is_bool($input['codCollected']))) {
        throw new ApiException(422, 'INVALID_INPUT', 'Xác nhận COD không áp dụng cho bước này.');
    }
    if ($to === 'shipping' && $order['inventory_state'] !== 'RESERVED') {
        throw new ApiException(409, 'INVENTORY_UNTRACKED', 'Đơn chưa có xác nhận giữ tồn hợp lệ.');
    }
    return ['from' => $from, 'to' => $to,
        'payment' => $method === 'COD' && $to === 'delivered' ? 'paid' : $payment,
        'refundRequired' => $to === 'cancelled' && $payment === 'paid' || (bool) $order['refund_required']];
}
