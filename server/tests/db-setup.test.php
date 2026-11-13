<?php
declare(strict_types=1);

// STT 28: bộ tách câu SQL của server/db/setup.php và việc mọi file trong danh sách đều tách được. Không cần DB.
require_once __DIR__ . '/../db/setup.php';

$passed = 0;
function ensureSetup(bool $condition, string $message): void
{
    global $passed;
    if (!$condition) { fwrite(STDERR, "FAIL: {$message}\n"); exit(1); }
    $passed++;
}

$sql = "-- comment; not a statement\nINSERT INTO t (a, b) VALUES ('x; y', \"it''s\");\n/* block ; comment */ UPDATE t SET a = 'O''Brien;' WHERE id = 1;\n# hash comment ;\nSELECT `odd;name` FROM t;\nSELECT 'back\\'slash;'";
$parts = setupSplitSql($sql);
ensureSetup(count($parts) === 4, 'four statements, semicolons in strings/comments/backticks ignored: ' . json_encode($parts));
ensureSetup(str_contains($parts[0], "'x; y'") && str_contains($parts[1], "'O''Brien;'") && str_contains($parts[2], '`odd;name`') && str_contains($parts[3], "back\\'slash;"), 'statement text kept intact');
ensureSetup(setupSplitSql("SELECT 1;;\n  ;") === ['SELECT 1'], 'empty statements dropped');
ensureSetup(count(setupSplitSql("SELECT 1 -- trailing; comment\n; SELECT 2")) === 2, 'trailing line comment does not end a statement');

$names = array_column(setupMigrations(), 'name');
ensureSetup(count($names) === count(array_unique($names)), 'migration names are unique');
$files = array_map('basename', glob(__DIR__ . '/../db/migrations/*.sql'));
ensureSetup(array_diff(array_map(static fn (string $file): string => substr($file, 0, -4), $files), $names) === [], 'every migration file is listed in setup.php: ' . json_encode(array_diff(array_map(static fn (string $file): string => substr($file, 0, -4), $files), $names)));
foreach (setupMigrations() as $item) {
    $path = setupPath($item, 'migration');
    ensureSetup(is_file($path), "file exists: {$item['name']}");
    ensureSetup(setupSplitSql((string) file_get_contents($path)) !== [], "parses: {$item['name']}");
}

echo "PASS: {$passed} db setup checks.\n";
