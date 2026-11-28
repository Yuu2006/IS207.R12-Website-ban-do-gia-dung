<?php
declare(strict_types=1);

require_once __DIR__ . '/../models/audit-model.php';
require_once __DIR__ . '/../middleware/role-middleware.php';

// Audit records are read-only and visible only to administrators.
final class AuditService
{
    public function __construct(private AuditModel $model) {}

    // Accept only indexed filters, strict dates and bounded page sizes.
    public function list(?array $principal, array $query): array
    {
        requireRole($principal, ['ADMIN']);
        $allowed = ['action', 'entityType', 'actorId', 'from', 'to', 'page', 'pageSize'];
        if (array_diff(array_keys($query), $allowed)) throw new ApiException('Bộ lọc nhật ký có trường không được hỗ trợ.', 422);

        $filters = [];
        foreach (['action' => 80, 'entityType' => 80] as $key => $max) {
            $value = $query[$key] ?? '';
            if (!is_string($value) || strlen($value) > $max || preg_match('/^[A-Za-z0-9_-]*$/D', $value) !== 1) {
                throw new ApiException('Bộ lọc nhật ký chưa hợp lệ.', 422, [$key => 'Chỉ dùng chữ, số, dấu gạch ngang hoặc gạch dưới.']);
            }
            $filters[$key] = $value;
        }

        $actorId = $query['actorId'] ?? '';
        if (!is_string($actorId) || ($actorId !== '' && preg_match('/^[1-9][0-9]{0,18}$/D', $actorId) !== 1)) {
            throw new ApiException('Bộ lọc tài khoản chưa hợp lệ.', 422, ['actorId' => 'Cần ID nguyên dương.']);
        }
        $filters['actorId'] = $actorId;

        foreach (['from', 'to'] as $key) {
            $date = $query[$key] ?? '';
            if (!is_string($date) || ($date !== '' && (!$this->validDate($date)))) {
                throw new ApiException('Khoảng ngày chưa hợp lệ.', 422, [$key => 'Dùng định dạng YYYY-MM-DD.']);
            }
            $filters[$key] = $date;
        }
        if ($filters['from'] !== '' && $filters['to'] !== '' && $filters['from'] > $filters['to']) {
            throw new ApiException('Khoảng ngày chưa hợp lệ.', 422, ['from' => 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.']);
        }
        $filters['page'] = $this->positiveInt($query['page'] ?? '1', 'page', 1000000);
        $filters['pageSize'] = $this->positiveInt($query['pageSize'] ?? '25', 'pageSize', 100);
        return $this->model->page($filters);
    }

    // Reject impossible dates instead of letting MySQL coerce them.
    private function validDate(string $date): bool
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/D', $date)) return false;
        $parsed = \DateTimeImmutable::createFromFormat('!Y-m-d', $date);
        return $parsed !== false && $parsed->format('Y-m-d') === $date;
    }

    // Parse numeric query fields without coercing malformed values.
    private function positiveInt(mixed $value, string $field, int $max): int
    {
        if (!is_string($value) || preg_match('/^[1-9][0-9]*$/D', $value) !== 1) throw new ApiException('Phân trang chưa hợp lệ.', 422, [$field => 'Cần số nguyên dương.']);
        $number = filter_var($value, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => $max]]);
        if ($number === false) throw new ApiException('Phân trang vượt giới hạn.', 422, [$field => 'Giá trị vượt giới hạn.']);
        return $number;
    }
}
