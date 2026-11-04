<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class ReportModel
{
    public function __construct(private readonly \PDO $pdo) {}

    // Export recognized completed sales and simulated refunds as separate, auditable rows.
    public function revenueCsv(array $range): string
    {
        $timezone = new \DateTimeZone('Asia/Ho_Chi_Minh');
        $utc = new \DateTimeZone('UTC');
        $fromLocal = new \DateTimeImmutable($range['from'], $timezone);
        $toExclusiveLocal = (new \DateTimeImmutable($range['to'], $timezone))->modify('+1 day');
        $fromUtc = $fromLocal->setTimezone($utc)->format('Y-m-d H:i:s');
        $toUtc = $toExclusiveLocal->setTimezone($utc)->format('Y-m-d H:i:s');

        $sales = $this->pdo->prepare("SELECT o.order_code, o.order_status, o.payment_status, o.payment_method, o.total_amount, h.recognized_at AS event_at
            FROM orders o JOIN (
                SELECT order_id, MIN(changed_at) AS recognized_at
                FROM order_status_history WHERE status = 'COMPLETED' AND is_deleted = 0 GROUP BY order_id
            ) h ON h.order_id = o.id
            WHERE o.is_deleted = 0 AND o.order_status = 'COMPLETED' AND o.payment_status IN ('PAID', 'REFUNDED')
                AND h.recognized_at >= ? AND h.recognized_at < ?
            ORDER BY h.recognized_at, o.id");
        $sales->execute([$fromUtc, $toUtc]);

        $refunds = $this->pdo->prepare("SELECT o.order_code, o.order_status, o.payment_status, o.payment_method, r.amount, r.created_at AS event_at
            FROM order_simulated_refunds r JOIN orders o ON o.id = r.order_id
            WHERE r.status = 'SIMULATED' AND o.is_deleted = 0 AND r.created_at >= ? AND r.created_at < ?
            ORDER BY r.created_at, r.id");
        $refunds->execute([$fromUtc, $toUtc]);

        $stream = fopen('php://temp', 'r+');
        if ($stream === false) throw new \RuntimeException('Could not create CSV stream.');
        fputcsv($stream, ['Loại giao dịch', 'Thời điểm (Asia/Ho_Chi_Minh)', 'Mã đơn', 'Trạng thái đơn', 'Thanh toán', 'Phương thức', 'Số tiền VND', 'Ghi chú'], ',', '"', '');
        $net = 0;
        foreach ($sales->fetchAll(\PDO::FETCH_ASSOC) as $row) {
            $amount = orderMoney($row['total_amount']);
            $net += $amount;
            fputcsv($stream, ['SALE', $this->localDate($row['event_at'], $utc, $timezone), $row['order_code'], strtolower($row['order_status']), strtolower($row['payment_status']), $row['payment_method'], $amount, 'Ghi nhận khi đơn hoàn tất và đã thanh toán'], ',', '"', '');
        }
        foreach ($refunds->fetchAll(\PDO::FETCH_ASSOC) as $row) {
            $amount = orderMoney($row['amount']);
            $net -= $amount;
            fputcsv($stream, ['REFUND', $this->localDate($row['event_at'], $utc, $timezone), $row['order_code'], strtolower($row['order_status']), strtolower($row['payment_status']), $row['payment_method'], -$amount, 'Hoàn tiền mô phỏng toàn bộ đơn'], ',', '"', '');
        }
        fputcsv($stream, ['NET_TOTAL', '', '', '', '', '', $net, 'Doanh thu thuần trong kỳ = giao dịch SALE - REFUND'], ',', '"', '');
        rewind($stream);
        $csv = stream_get_contents($stream);
        fclose($stream);
        if (!is_string($csv)) throw new \RuntimeException('Could not read CSV stream.');
        return "\xEF\xBB\xBF" . $csv;
    }

    // Database timestamps are UTC; exported dates use the documented Vietnam timezone.
    private function localDate(string $value, \DateTimeZone $utc, \DateTimeZone $timezone): string
    {
        return (new \DateTimeImmutable($value, $utc))->setTimezone($timezone)->format('Y-m-d H:i:s');
    }
}
