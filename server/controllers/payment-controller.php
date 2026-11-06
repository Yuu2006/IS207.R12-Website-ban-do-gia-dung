<?php
declare(strict_types=1);
namespace HomeCare\OrderApi;

// HTTP orchestration only; all ledger decisions and transactions belong to PaymentService.
final class PaymentController
{
    public function __construct(private readonly PaymentService $service) {}
    public function methods(): array { return apiSuccess($this->service->methods()); }
    public function status(array $actor, string $id, bool $staff): array { return apiSuccess($this->service->status($actor, $id, $staff)); }
    public function reference(array $actor, string $reference): array { return apiSuccess($this->service->byReference($actor, $reference)); }
    public function confirm(array $actor, string $id, array $input, string $key): array { return apiSuccess($this->service->confirmTransfer($actor, $id, $input, $key)); }
    public function document(array $actor, string $id, bool $staff, string $type): array { return apiSuccess($this->service->document($actor, $id, $staff, $type)); }
}
