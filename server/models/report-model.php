<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class ReportModel
{
    public function __construct(private readonly \PDO $pdo) {}

    // Local inclusive dates [from, to] (Asia/Ho_Chi_Minh) become the UTC half-open range [fromUtc, toUtc).
    private function utcRange(array $range): array
    {
        $timezone = new \DateTimeZone('Asia/Ho_Chi_Minh');
        $utc = new \DateTimeZone('UTC');
        return [
            (new \DateTimeImmutable($range['from'], $timezone))->setTimezone($utc)->format('Y-m-d H:i:s'),
            (new \DateTimeImmutable($range['to'], $timezone))->modify('+1 day')->setTimezone($utc)->format('Y-m-d H:i:s'),
        ];
    }

    // First COMPLETED history row per order: the single recognition moment shared by CSV SALE rows and dashboard metrics.
    private const COMPLETED_IN_RANGE = "SELECT o.id, o.customer_id, o.order_code, o.order_status, o.payment_status, o.payment_method, o.total_amount, h.recognized_at
        FROM orders o JOIN (
            SELECT order_id, MIN(changed_at) AS recognized_at
            FROM order_status_history WHERE status = 'COMPLETED' AND is_deleted = 0 GROUP BY order_id
        ) h ON h.order_id = o.id
        WHERE o.is_deleted = 0 AND o.order_status = 'COMPLETED' AND h.recognized_at >= ? AND h.recognized_at < ?";

    // DASH-01: aggregate metrics from MySQL for one local date range; unconfirmed metrics are null, never 0.
    public function dashboard(array $range): array
    {
        [$fromUtc, $toUtc] = $this->utcRange($range);
        $one = function (string $sql, array $values = []): array {
            $statement = $this->pdo->prepare($sql);
            $statement->execute($values);
            return $statement->fetch(\PDO::FETCH_ASSOC) ?: [];
        };
        $all = function (string $sql, array $values = []): array {
            $statement = $this->pdo->prepare($sql);
            $statement->execute($values);
            return $statement->fetchAll(\PDO::FETCH_ASSOC);
        };
        $completed = self::COMPLETED_IN_RANGE;
        $sales = $one("SELECT COUNT(*) AS orders, COALESCE(SUM(c.total_amount), 0) AS gross FROM ({$completed}) c WHERE c.payment_status IN ('PAID', 'REFUNDED')", [$fromUtc, $toUtc]);
        $refunds = $one("SELECT COUNT(*) AS refunds, COALESCE(SUM(r.amount), 0) AS amount FROM order_simulated_refunds r JOIN orders o ON o.id = r.order_id
            WHERE r.status = 'SIMULATED' AND o.is_deleted = 0 AND r.created_at >= ? AND r.created_at < ?", [$fromUtc, $toUtc]);
        $placed = $one('SELECT COUNT(*) AS orders FROM orders WHERE is_deleted = 0 AND placed_at >= ? AND placed_at < ?', [$fromUtc, $toUtc]);
        $buyers = $one("SELECT COUNT(*) AS orders, COUNT(DISTINCT c.customer_id) AS customers,
                COALESCE((SELECT SUM(oi.quantity) FROM order_items oi JOIN ({$completed}) c2 ON c2.id = oi.order_id WHERE oi.is_deleted = 0), 0) AS units
            FROM ({$completed}) c", [$fromUtc, $toUtc, $fromUtc, $toUtc]);
        $statuses = $all('SELECT order_status, COUNT(*) AS orders FROM orders WHERE is_deleted = 0 AND placed_at >= ? AND placed_at < ? GROUP BY order_status ORDER BY orders DESC, order_status', [$fromUtc, $toUtc]);
        $top = $all("SELECT v.product_id, MAX(oi.product_name) AS product_name, SUM(oi.quantity) AS units, SUM(oi.line_total) AS revenue
            FROM order_items oi JOIN ({$completed}) c ON c.id = oi.order_id JOIN product_variants v ON v.id = oi.variant_id
            WHERE oi.is_deleted = 0 GROUP BY v.product_id ORDER BY units DESC, v.product_id LIMIT 5", [$fromUtc, $toUtc]);
        $lowStockWhere = 'FROM product_variants v JOIN products p ON p.id = v.product_id
            WHERE v.is_active = 1 AND v.is_deleted = 0 AND p.is_active = 1 AND p.is_deleted = 0 AND v.stock_quantity <= v.low_stock_threshold';
        $lowStock = $all("SELECT v.id, v.sku, v.variant_name, p.name AS product_name, v.stock_quantity, v.low_stock_threshold {$lowStockWhere} ORDER BY v.stock_quantity, v.id LIMIT 10");
        $lowStockTotal = (int) ($one("SELECT COUNT(*) AS total {$lowStockWhere}")['total'] ?? 0);

        $decision = ['fitChecks' => null, 'notFitRate' => null, 'tcoCalculations' => null, 'careCompletionRate' => null];
        try {
            $events = $one("SELECT SUM(event_type = 'FIT_CHECK') AS fit_checks, SUM(event_type = 'FIT_CHECK' AND fit_result = 'NOT_FIT') AS not_fit, SUM(event_type = 'TCO') AS tco
                FROM decision_events WHERE created_at >= ? AND created_at < ?", [$fromUtc, $toUtc]);
            $fitChecks = (int) ($events['fit_checks'] ?? 0);
            $decision['fitChecks'] = $fitChecks;
            $decision['notFitRate'] = $fitChecks === 0 ? null : round((int) $events['not_fit'] / $fitChecks, 4);
            $decision['tcoCalculations'] = (int) ($events['tco'] ?? 0);
        } catch (\PDOException $error) {
            // decision_events exists only after migration 012; without it these metrics stay unavailable.
            if ($error->getCode() !== '42S02') throw $error;
        }

        $gross = orderMoney($sales['gross'] ?? 0);
        $refunded = orderMoney($refunds['amount'] ?? 0);
        $saleOrders = (int) ($sales['orders'] ?? 0);
        return [
            'period' => ['from' => $range['from'], 'to' => $range['to'], 'timezone' => 'Asia/Ho_Chi_Minh'],
            'sales' => [
                'grossSalesVnd' => $gross, 'refundsVnd' => $refunded, 'netRevenueVnd' => $gross - $refunded,
                'saleOrders' => $saleOrders, 'refundCount' => (int) ($refunds['refunds'] ?? 0),
                // Integer VND, rounded half up; null when nothing was sold so the UI never shows a fake 0 average.
                'averageOrderValueVnd' => $saleOrders === 0 ? null : intdiv(2 * $gross + $saleOrders, 2 * $saleOrders),
                'placedOrders' => (int) ($placed['orders'] ?? 0), 'completedOrders' => (int) ($buyers['orders'] ?? 0),
                'purchasingCustomers' => (int) ($buyers['customers'] ?? 0), 'soldUnits' => (int) ($buyers['units'] ?? 0),
            ],
            'ordersByStatus' => array_map(static fn (array $row): array => ['status' => strtolower($row['order_status']), 'orders' => (int) $row['orders']], $statuses),
            'topProducts' => array_map(static fn (array $row): array => ['productId' => (string) $row['product_id'], 'productName' => $row['product_name'], 'soldUnits' => (int) $row['units'], 'revenueVnd' => orderMoney($row['revenue'])], $top),
            'lowStock' => ['total' => $lowStockTotal, 'items' => array_map(static fn (array $row): array => ['variantId' => (string) $row['id'], 'sku' => $row['sku'], 'productName' => $row['product_name'], 'variantName' => $row['variant_name'], 'stockQuantity' => (int) $row['stock_quantity'], 'threshold' => (int) $row['low_stock_threshold']], $lowStock)],
            'decisionTools' => $decision,
            // Care completion rate still waits for TV2/TV3 to confirm how postponed/late tasks count.
            'dataStatus' => 'PARTIAL',
            'generatedAt' => gmdate('Y-m-d\TH:i:s\Z'),
        ];
    }

    // Export recognized completed sales and simulated refunds as separate, auditable rows.
    public function revenueCsv(array $range): string
    {
        $timezone = new \DateTimeZone('Asia/Ho_Chi_Minh');
        $utc = new \DateTimeZone('UTC');
        [$fromUtc, $toUtc] = $this->utcRange($range);

        $sales = $this->pdo->prepare('SELECT c.order_code, c.order_status, c.payment_status, c.payment_method, c.total_amount, c.recognized_at AS event_at
            FROM (' . self::COMPLETED_IN_RANGE . ") c WHERE c.payment_status IN ('PAID', 'REFUNDED')
            ORDER BY c.recognized_at, c.id");
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
