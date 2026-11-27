<?php
declare(strict_types=1);

namespace {

// Persists immutable audit events and exposes a paginated, filterable view to the ADMIN service.
final class AuditModel
{
    public function __construct(private PDO $pdo) {}

    // Store only caller-approved metadata; credentials, tokens and payment secrets must never be passed here.
    public function record(?int $actorId, ?string $actorRole, string $action, string $entityType, ?int $entityId, array $details = []): void
    {
        $statement = $this->pdo->prepare('INSERT INTO audit_logs (actor_id, actor_role, action, entity_type, entity_id, details, created_at) VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())');
        $statement->execute([$actorId, $actorRole, $action, $entityType, $entityId, json_encode($details, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)]);
    }

    // Whitelisted filters prevent SQL identifier injection and support indexed time/actor queries.
    public function page(array $filters): array
    {
        $where = ['a.is_deleted = 0'];
        $parameters = [];
        foreach (['action' => 'a.action', 'entityType' => 'a.entity_type', 'actorId' => 'a.actor_id'] as $key => $column) {
            if (($filters[$key] ?? '') === '') continue;
            $where[] = $column . ' = ?';
            $parameters[] = $filters[$key];
        }
        if (($filters['from'] ?? '') !== '') { $where[] = 'a.created_at >= ?'; $parameters[] = $filters['from'] . ' 00:00:00'; }
        if (($filters['to'] ?? '') !== '') { $where[] = 'a.created_at < DATE_ADD(?, INTERVAL 1 DAY)'; $parameters[] = $filters['to']; }
        $clause = ' WHERE ' . implode(' AND ', $where);
        $count = $this->pdo->prepare('SELECT COUNT(*) FROM audit_logs a' . $clause);
        $count->execute($parameters);
        $total = (int) $count->fetchColumn();
        $query = $this->pdo->prepare('SELECT a.id, a.actor_id, a.actor_role, a.action, a.entity_type, a.entity_id, a.details, a.created_at, u.full_name AS actor_name
            FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id' . $clause . ' ORDER BY a.created_at DESC, a.id DESC LIMIT ? OFFSET ?');
        foreach ($parameters as $index => $value) $query->bindValue($index + 1, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        $query->bindValue(count($parameters) + 1, $filters['pageSize'], PDO::PARAM_INT);
        $query->bindValue(count($parameters) + 2, ($filters['page'] - 1) * $filters['pageSize'], PDO::PARAM_INT);
        $query->execute();
        $items = array_map(static fn (array $row): array => [
            'id' => (string) $row['id'], 'actorId' => $row['actor_id'] === null ? null : (string) $row['actor_id'],
            'actorName' => $row['actor_name'] ?? 'Không xác định', 'actorRole' => $row['actor_role'],
            'action' => $row['action'], 'entityType' => $row['entity_type'],
            'entityId' => $row['entity_id'] === null ? null : (string) $row['entity_id'],
            'details' => $row['details'] ? json_decode($row['details'], true, 32, JSON_THROW_ON_ERROR) : [], 'createdAt' => $row['created_at'],
        ], $query->fetchAll(PDO::FETCH_ASSOC));
        return ['items' => $items, 'pagination' => ['page' => $filters['page'], 'pageSize' => $filters['pageSize'], 'totalItems' => $total, 'totalPages' => (int) ceil($total / $filters['pageSize'])]];
    }
}

}
