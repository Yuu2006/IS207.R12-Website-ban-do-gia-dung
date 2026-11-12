<?php
declare(strict_types=1);

// STT 28: dựng/nâng cấp database theo một thứ tự cố định và ghi lại file đã áp vào bảng schema_migrations.
//
//   php server/db/setup.php status  --database=TEN_DB
//   php server/db/setup.php migrate --database=TEN_DB [--backup-confirmed]
//   php server/db/setup.php seed    --database=TEN_DB [--backup-confirmed]
//
// Kết nối lấy từ DB_HOST/DB_PORT/DB_USER/DB_PASSWORD. --database phải trùng DB_NAME để tránh chạy nhầm database.
// Không bao giờ DROP/TRUNCATE. DB đã có bảng thì phải sao lưu trước và thêm --backup-confirmed.

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }

const SETUP_ROOT = __DIR__;

// Thứ tự áp dụng. probe: dấu hiệu cho thấy file đã được áp trên DB cũ chưa có schema_migrations.
function setupMigrations(): array
{
    return [
        ['name' => 'baseline', 'file' => setupBaselinePath(), 'probe' => ['table', 'users']],
        ['name' => '008_product_attributes', 'probe' => ['table', 'product_attributes']],
        ['name' => '009_product_attribute_values', 'probe' => ['table', 'product_attribute_values']],
        ['name' => '008_order_runtime', 'probe' => ['table', 'order_idempotency']],
        ['name' => '010_auth_profile', 'probe' => ['column', 'users', 'failed_login_count']],
        ['name' => '011_auth_catalog_completion', 'probe' => ['column', 'categories', 'sort_order']],
        ['name' => '017_admin_user_management', 'probe' => ['column', 'users', 'admin_locked_at']],
        ['name' => '012_decision_tools', 'probe' => ['table', 'room_profiles']],
        ['name' => '013_fit_rule_versions', 'probe' => ['table', 'fit_rule_versions']],
        ['name' => '014_payment_ledger', 'probe' => ['column', 'orders', 'merchant_snapshot']],
        ['name' => '015_return_refund_reporting', 'probe' => ['table', 'order_simulated_refunds']],
        ['name' => '016_care_rule_supplies', 'probe' => ['table', 'care_rule_supplies']],
        ['name' => '018_chatbot_faqs', 'probe' => ['table', 'chatbot_faqs']],
        ['name' => '019_wishlists', 'probe' => ['table', 'wishlists']],
        ['name' => '020_query_indexes', 'probe' => ['index', 'orders', 'idx_orders_placed_at']],
    ];
}

// Dữ liệu phát triển. 002 là dữ liệu cũ nên không nạp; optional = chỉ nạp khi file có trên máy.
function setupSeeds(): array
{
    return [
        ['name' => '001_auth_demo_users'], ['name' => '003_catalog_appliances'], ['name' => '004_catalog_real_brands'],
        ['name' => '005_catalog_media'], ['name' => '006_customers_addresses'], ['name' => '007_vouchers'],
        ['name' => '008_orders_payments'], ['name' => '009_reviews_audit'], ['name' => '010_decision_tools'],
        ['name' => '011_catalog_real_images', 'optional' => true],
    ];
}

function setupBaselinePath(): string
{
    // Máy local: <repo>/database. Container api (chỉ mount ./server): docker-compose mount thêm ./database tại /var/www/database.
    foreach ([SETUP_ROOT . '/../../database/schema_database.sql', '/var/www/database/schema_database.sql'] as $path) {
        if (is_file($path)) return $path;
    }
    return SETUP_ROOT . '/../../database/schema_database.sql';
}

function setupPath(array $item, string $kind): string
{
    return $item['file'] ?? SETUP_ROOT . ($kind === 'seed' ? '/seeds/' : '/migrations/') . $item['name'] . '.sql';
}

// Tách file SQL thành từng câu lệnh, bỏ qua dấu ; nằm trong chuỗi/tên cột/chú thích.
// Chạy từng câu để lỗi ở bất kỳ câu nào cũng dừng lại và báo đúng vị trí (PDO::exec nhiều câu một lúc có thể nuốt lỗi câu sau).
function setupSplitSql(string $sql): array
{
    $statements = [];
    $current = '';
    $length = strlen($sql);
    $quote = null;
    for ($i = 0; $i < $length; $i++) {
        $char = $sql[$i];
        $next = $sql[$i + 1] ?? '';
        if ($quote !== null) {
            $current .= $char;
            if ($char === '\\' && $quote !== '`') { $current .= $next; $i++; continue; }
            if ($char === $quote) {
                if ($next === $quote) { $current .= $next; $i++; continue; }
                $quote = null;
            }
            continue;
        }
        if ($char === '-' && $next === '-' && in_array($sql[$i + 2] ?? ' ', [' ', "\t", "\n", "\r"], true) || $char === '#') {
            $end = strpos($sql, "\n", $i);
            $i = $end === false ? $length : $end;
            $current .= "\n";
            continue;
        }
        if ($char === '/' && $next === '*') {
            $end = strpos($sql, '*/', $i + 2);
            $i = $end === false ? $length : $end + 1;
            $current .= ' ';
            continue;
        }
        if ($char === "'" || $char === '"' || $char === '`') { $quote = $char; $current .= $char; continue; }
        if ($char === ';') {
            if (trim($current) !== '') $statements[] = trim($current);
            $current = '';
            continue;
        }
        $current .= $char;
    }
    if (trim($current) !== '') $statements[] = trim($current);
    return $statements;
}

function setupOptions(array $argv): array
{
    $options = ['command' => 'status', 'database' => null, 'backupConfirmed' => false];
    foreach (array_slice($argv, 1) as $arg) {
        if (in_array($arg, ['status', 'migrate', 'seed'], true)) $options['command'] = $arg;
        elseif (str_starts_with($arg, '--database=')) $options['database'] = substr($arg, 11);
        elseif ($arg === '--backup-confirmed') $options['backupConfirmed'] = true;
        else throw new InvalidArgumentException("Tham số không hỗ trợ: {$arg}");
    }
    return $options;
}

function setupConnect(string $database): PDO
{
    $expected = getenv('DB_NAME') ?: '';
    if ($database === '' || $database !== $expected) {
        throw new RuntimeException('--database phải trùng biến môi trường DB_NAME (đang là "' . $expected . '"), để không chạy nhầm database.');
    }
    if (!preg_match('/^[A-Za-z0-9_]{1,64}$/D', $database)) throw new RuntimeException('Tên database chỉ gồm chữ, số, dấu gạch dưới.');
    $host = getenv('DB_HOST') ?: '127.0.0.1';
    $port = getenv('DB_PORT') ?: '3306';
    $pdo = new PDO("mysql:host={$host};port={$port};dbname={$database};charset=utf8mb4", getenv('DB_USER') ?: 'root', getenv('DB_PASSWORD') ?: '', [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

function setupTableExists(PDO $pdo, string $table): bool
{
    $statement = $pdo->prepare('SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?');
    $statement->execute([$table]);
    return $statement->fetchColumn() !== false;
}

function setupProbe(PDO $pdo, array $probe): bool
{
    if ($probe[0] === 'table') return setupTableExists($pdo, $probe[1]);
    if ($probe[0] === 'index') {
        $statement = $pdo->prepare('SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?');
        $statement->execute([$probe[1], $probe[2]]);
        return $statement->fetchColumn() !== false;
    }
    $statement = $pdo->prepare('SELECT 1 FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?');
    $statement->execute([$probe[1], $probe[2]]);
    return $statement->fetchColumn() !== false;
}

// Có dữ liệu thật (tài khoản, sản phẩm hoặc đơn) thì bắt buộc sao lưu; DB vừa dựng schema còn trống thì không.
function setupHasData(PDO $pdo): bool
{
    foreach (['users', 'products', 'orders'] as $table) {
        if (setupTableExists($pdo, $table) && $pdo->query("SELECT 1 FROM `{$table}` LIMIT 1")->fetchColumn() !== false) return true;
    }
    return false;
}

function setupEnsureLedger(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS schema_migrations (
        name VARCHAR(120) NOT NULL PRIMARY KEY,
        kind ENUM('MIGRATION', 'SEED') NOT NULL,
        checksum CHAR(64) NOT NULL,
        mode ENUM('APPLIED', 'ADOPTED') NOT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

function setupLedger(PDO $pdo): array
{
    if (!setupTableExists($pdo, 'schema_migrations')) return [];
    $rows = [];
    foreach ($pdo->query('SELECT name, kind, checksum, mode, applied_at FROM schema_migrations') as $row) $rows[$row['name']] = $row;
    return $rows;
}

// Trạng thái từng file: applied (đã ghi), adoptable (DB cũ có dấu hiệu đã áp nhưng chưa ghi), pending, missing-file.
function setupPlan(PDO $pdo): array
{
    $ledger = setupLedger($pdo);
    $plan = [];
    foreach (setupMigrations() as $item) {
        $path = setupPath($item, 'migration');
        $row = $ledger[$item['name']] ?? null;
        $state = !is_file($path) ? 'missing-file' : ($row ? 'applied' : (setupProbe($pdo, $item['probe']) ? 'adoptable' : 'pending'));
        $changed = $row && is_file($path) && $row['mode'] === 'APPLIED' && !hash_equals($row['checksum'], hash_file('sha256', $path));
        $plan[] = $item + ['kind' => 'MIGRATION', 'path' => $path, 'state' => $state, 'changed' => $changed];
    }
    // Seed không có dấu hiệu nhận biết: DB cũ đã có dữ liệu mà chưa ghi sổ seed nào thì không khẳng định là "chưa áp".
    $seedLedgerEmpty = array_filter($ledger, static fn (array $row): bool => $row['kind'] === 'SEED') === [];
    $unknownSeeds = $seedLedgerEmpty && setupHasData($pdo);
    foreach (setupSeeds() as $item) {
        $path = setupPath($item, 'seed');
        $state = !is_file($path) ? (!empty($item['optional']) ? 'skipped' : 'missing-file') : (isset($ledger[$item['name']]) ? 'applied' : ($unknownSeeds ? 'unknown' : 'pending'));
        $plan[] = $item + ['kind' => 'SEED', 'path' => $path, 'state' => $state, 'changed' => false];
    }
    return $plan;
}

function setupRunFile(PDO $pdo, string $path): void
{
    $sql = file_get_contents($path);
    if ($sql === false) throw new RuntimeException("Không đọc được {$path}");
    // Baseline cũ có thể chứa truy vấn nháp ở cuối file của một máy; bỏ phần sau dấu "-- TEST" giống test runner.
    $scratch = strpos($sql, "\n-- TEST");
    if ($scratch !== false) $sql = substr($sql, 0, $scratch);
    foreach (setupSplitSql($sql) as $index => $statement) {
        if (preg_match('/^\s*(DROP\s+(DATABASE|SCHEMA|TABLE)|TRUNCATE)\b/i', $statement)) throw new RuntimeException('Từ chối câu lệnh xóa dữ liệu trong ' . basename($path) . ' (câu ' . ($index + 1) . ').');
        if (preg_match('/^\s*(CREATE\s+DATABASE|USE)\b/i', $statement)) continue;
        try { $pdo->exec($statement); }
        catch (PDOException $error) {
            throw new RuntimeException(basename($path) . ' lỗi ở câu ' . ($index + 1) . ': ' . $error->getMessage() . "\n" . substr($statement, 0, 200));
        }
    }
}

function setupMain(array $argv): int
{
    $options = setupOptions($argv);
    $pdo = setupConnect((string) $options['database']);
    $plan = setupPlan($pdo);
    $labels = ['applied' => 'đã áp', 'adoptable' => 'đã có trên DB, chưa ghi sổ', 'pending' => 'CHƯA ÁP', 'missing-file' => 'THIẾU FILE', 'skipped' => 'bỏ qua (không có file)', 'unknown' => 'không rõ (DB đã có dữ liệu, chưa ghi sổ seed)'];

    if ($options['command'] === 'status') {
        foreach ($plan as $item) echo str_pad($item['kind'] === 'SEED' ? 'seed' : 'migration', 10) . str_pad($item['name'], 34) . $labels[$item['state']] . ($item['changed'] ? ' (file đã đổi sau khi áp!)' : '') . "\n";
        $pending = array_filter($plan, static fn (array $item): bool => $item['kind'] === 'MIGRATION' && in_array($item['state'], ['pending', 'missing-file'], true));
        echo $pending === [] ? "Schema đầy đủ.\n" : count($pending) . " migration chưa áp. Chạy: php db/setup.php migrate --database={$options['database']}\n";
        return $pending === [] ? 0 : 2;
    }

    $kind = $options['command'] === 'seed' ? 'SEED' : 'MIGRATION';
    if ($kind === 'SEED' && array_filter($plan, static fn (array $item): bool => $item['kind'] === 'MIGRATION' && $item['state'] !== 'applied' && $item['state'] !== 'adoptable')) {
        throw new RuntimeException('Còn migration chưa áp; chạy migrate trước khi nạp seed.');
    }
    $work = array_values(array_filter($plan, static fn (array $item): bool => $item['kind'] === $kind && in_array($item['state'], ['pending', 'adoptable', 'missing-file', 'unknown'], true)));
    foreach ($work as $item) if ($item['state'] === 'missing-file') throw new RuntimeException("Thiếu file {$item['path']}");
    $runs = array_filter($work, static fn (array $item): bool => in_array($item['state'], ['pending', 'unknown'], true));
    if ($runs !== [] && setupHasData($pdo) && !$options['backupConfirmed']) {
        throw new RuntimeException("Database đã có dữ liệu. Sao lưu trước (xem server/db/README.md), rồi chạy lại với --backup-confirmed.\nSẽ áp: " . implode(', ', array_column($runs, 'name')));
    }
    setupEnsureLedger($pdo);
    $record = $pdo->prepare('INSERT INTO schema_migrations (name, kind, checksum, mode) VALUES (?, ?, ?, ?)');
    foreach ($work as $item) {
        $checksum = hash_file('sha256', $item['path']);
        if ($item['state'] === 'adoptable') {
            $record->execute([$item['name'], $kind, $checksum, 'ADOPTED']);
            echo "ghi sổ (đã có sẵn): {$item['name']}\n";
            continue;
        }
        echo "đang áp: {$item['name']} … ";
        setupRunFile($pdo, $item['path']);
        $record->execute([$item['name'], $kind, $checksum, 'APPLIED']);
        echo "xong\n";
    }
    echo $work === [] ? "Không có gì cần làm.\n" : "Hoàn tất.\n";
    return 0;
}

if (realpath($argv[0] ?? '') === realpath(__FILE__)) {
    try { exit(setupMain($argv)); }
    catch (Throwable $error) { fwrite(STDERR, 'LỖI: ' . $error->getMessage() . "\n"); exit(1); }
}
