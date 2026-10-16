<?php
// Shared native-prepared UTF-8 connection; timestamps created by this module use UTC.
function db(): PDO {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;

    $host = getenv('DB_HOST') ?: 'db';
    $port = getenv('DB_PORT') ?: '3306';
    $name = getenv('DB_NAME') ?: 'household_ecommerce';
    $user = getenv('DB_USER') ?: 'app_user';
    $pass = getenv('DB_PASSWORD') ?: '';

    $connection = new PDO(
        "mysql:host={$host};port={$port};dbname={$name};charset=utf8mb4",
        $user,
        $pass,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_EMULATE_PREPARES => false, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
    $connection->exec("SET time_zone = '+00:00'");
    $pdo = $connection;
    return $pdo;
}
