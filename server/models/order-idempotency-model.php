<?php
declare(strict_types=1);

namespace HomeCare\OrderApi;

final class OrderIdempotencyModel
{
    // One connection and transaction cover key, order, payment, audit and dependency writes.
    public function __construct(private readonly \PDO $pdo) {}

    // Insert or lock one unique key before any other row lock; conflict/replay never repeats writes.
    public function run(array $principal, string $operation, string $key, array $input, callable $apply): array
    {
        if ($this->pdo->inTransaction()) throw new \LogicException('Nested order transaction is not allowed.');
        for ($attempt = 0; $attempt < 3; $attempt++) {
            try { return $this->attempt($principal, $operation, $key, $input, $apply); }
            catch (\PDOException $error) {
                if (!in_array((int) ($error->errorInfo[1] ?? 0), [1205, 1213], true)) throw $error;
                if ($attempt === 2) throw new ApiException(503, 'REQUEST_RETRYABLE', 'Dữ liệu đang được xử lý. Thử lại cùng mã yêu cầu.');
                usleep(10000 * ($attempt + 1));
            }
        }
        throw new \LogicException('Unreachable transaction retry.');
    }

    // Retry only rolled-back DB work with the SAME key; callbacks must have no external effects.
    private function attempt(array $principal, string $operation, string $key, array $input, callable $apply): array
    {
        $hash = orderCanonicalHash(['role' => $principal['role'], 'input' => $input]);
        $this->pdo->beginTransaction();
        try {
            $statement = $this->pdo->prepare('INSERT INTO order_idempotency (actor_id, operation, request_key, request_hash) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE request_hash = request_hash');
            $statement->execute([$principal['id'], $operation, $key, $hash]);
            $statement = $this->pdo->prepare('SELECT request_hash, response_json FROM order_idempotency WHERE actor_id = ? AND operation = ? AND request_key = ? FOR UPDATE');
            $statement->execute([$principal['id'], $operation, $key]);
            $row = $statement->fetch(\PDO::FETCH_ASSOC);
            if (!hash_equals($row['request_hash'], $hash)) throw new ApiException(409, 'IDEMPOTENCY_CONFLICT', 'Mã gửi lặp đã được dùng cho nội dung khác.');
            if ($row['response_json'] !== null) {
                $response = json_decode($row['response_json'], true, 512, JSON_THROW_ON_ERROR);
            } else {
                $response = $apply();
                if (!$this->pdo->inTransaction()) throw new \LogicException('Dependency ended the order transaction.');
                $statement = $this->pdo->prepare('UPDATE order_idempotency SET response_json = ? WHERE actor_id = ? AND operation = ? AND request_key = ?');
                $statement->execute([json_encode($response, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), $principal['id'], $operation, $key]);
            }
            $this->pdo->commit();
            return $response;
        } catch (\Throwable $error) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $error;
        }
    }
}
