<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class VnpayPaymentController
{
    public function __construct(private readonly VnpayPaymentServiceInterface $service) {}

    public function getAttempt(array $request): array
    {
        return apiSuccess($this->service->getAttempt($request['principal'], $request['paymentCode']));
    }
}
