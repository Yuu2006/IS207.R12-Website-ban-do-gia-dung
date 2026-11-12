<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class CheckoutModel
{
    public function __construct(private readonly OrderModel $orders) {}

    // Caller owns the transaction. Snapshots and the initial payment state are inserted together.
    public function insert(array $actor, array $input, array $quote, ?int $paymentExpiresAt = null): array
    {
        $pdo = $this->orders->pdo;
        if (!$pdo->inTransaction()) throw new \LogicException('Checkout requires an outer transaction.');
        $code = 'HC' . gmdate('Ymd') . strtoupper(bin2hex(random_bytes(8)));
        $method = $input['paymentMethod'];
        $paymentStatus = $method === 'COD' ? 'UNPAID' : 'PENDING';
        $paymentCode = $method === 'COD' ? 'COD-' . $code : 'VNPAY-' . $code;
        $expiresAt = $method === 'VNPAY' && $paymentExpiresAt !== null ? gmdate('Y-m-d H:i:s', $paymentExpiresAt) : null;
        if ($method === 'VNPAY' && $expiresAt === null) throw new \LogicException('VNPay checkout requires an expiration.');
        $address = $quote['shippingAddress'];
        $totals = $quote['totals'];
        $statement = $pdo->prepare("INSERT INTO orders (order_code, customer_id, voucher_id, recipient_name, recipient_phone, shipping_address, delivery_method, subtotal, discount_amount, shipping_fee, total_amount, payment_method, payment_status, order_status, customer_note, placed_at, inventory_state) VALUES (?, ?, ?, ?, ?, ?, 'STANDARD', ?, ?, ?, ?, ?, ?, 'PENDING', ?, UTC_TIMESTAMP(), 'RESERVED')");
        $statement->execute([$code, $actor['id'], $quote['voucherId'] ?? null, $address['recipientName'], $address['phone'], $address['addressLine'], $totals['subtotal'], $totals['discount'], $totals['shipping'], $totals['total'], $method, $paymentStatus, $input['note']]);
        $id = $pdo->lastInsertId();
        $merchant = ['name' => getenv('STORE_NAME') ?: 'HomeCare', 'address' => getenv('STORE_ADDRESS') ?: '', 'phone' => getenv('STORE_PHONE') ?: ''];
        $pdo->prepare('UPDATE orders SET merchant_snapshot = ? WHERE id = ?')->execute([json_encode($merchant, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), $id]);
        $statement = $pdo->prepare('INSERT INTO order_items (order_id, variant_id, product_name, sku, variant_name, unit_price, quantity, line_total, warranty_months, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        foreach ($quote['items'] as $item) {
            $statement->execute([$id, $item['skuId'], $item['productName'], $item['skuCode'], $item['variantName'], $item['unitPrice'], $item['quantity'], orderLineTotal($item['unitPrice'], $item['quantity']), $item['warrantyMonths'], $item['imageUrl']]);
        }
        $metadata = $method === 'BANK_TRANSFER' ? bankTransferConfig() : null;
        $statement = $pdo->prepare("INSERT INTO payments (order_id, payment_code, payment_method, amount, status, expires_at, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $statement->execute([$id, $paymentCode, $method, $totals['total'], $paymentStatus, $expiresAt, $metadata ? json_encode($metadata, JSON_THROW_ON_ERROR) : null]);
        $this->orders->appendHistory($id, null, 'pending', $actor, null);
        return $this->orders->find($id, $actor['id'], true);
    }
}
