<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class ReportService
{
    public function __construct(private readonly \PDO $pdo, private readonly ReportModel $model) {}

    // Revenue exports are restricted to the fixed ADMIN role and never modify reporting data.
    public function revenueCsv(array $principal, array $range): string
    {
        (new OrderModel($this->pdo))->requireActor($principal, ['ADMIN']);
        return $this->model->revenueCsv($range);
    }

    // DASH-01 aggregates are ADMIN-only and read-only.
    public function dashboard(array $principal, array $range): array
    {
        (new OrderModel($this->pdo))->requireActor($principal, ['ADMIN']);
        return $this->model->dashboard($range);
    }
}
