<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class ReportController
{
    public function __construct(private readonly ReportService $service) {}

    public function dashboard(array $request): array
    {
        return apiSuccess($this->service->dashboard($request['principal'], $request['input']), 'Đã lấy dashboard.');
    }

    // Return a raw CSV response so the browser downloads the file without JSON wrapping.
    public function revenueCsv(array $request): array
    {
        $filename = 'homecare-revenue-' . $request['input']['from'] . '-to-' . $request['input']['to'] . '.csv';
        return [
            'status' => 200,
            'headers' => [
                'Content-Type' => 'text/csv; charset=UTF-8',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Cache-Control' => 'no-store',
            ],
            'rawBody' => $this->service->revenueCsv($request['principal'], $request['input']),
        ];
    }
}
