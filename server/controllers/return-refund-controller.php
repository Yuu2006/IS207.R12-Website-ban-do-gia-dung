<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class ReturnRefundController
{
    public function __construct(private readonly ReturnRefundService $service) {}

    public function list(array $request): array
    {
        return apiSuccess($this->service->list($request['principal'], $request['input']));
    }

    public function detail(array $request): array
    {
        return apiSuccess($this->service->detail($request['principal'], $request['returnId']));
    }

    public function triage(array $request): array
    {
        return apiSuccess($this->service->triage($request['principal'], $request['returnId'], $request['input'], $request['idempotencyKey']));
    }

    public function decide(array $request): array
    {
        return apiSuccess($this->service->decide($request['principal'], $request['returnId'], $request['input'], $request['idempotencyKey']));
    }

    public function receive(array $request): array
    {
        return apiSuccess($this->service->receive($request['principal'], $request['returnId'], $request['input'], $request['idempotencyKey']));
    }
}
