<?php
declare(strict_types=1);

// Loads an SQL dump (stdin) into the configured database with the mysql client — used once to publish the
// migrated data. The credentials are read here from config.php and never leave the server.
// Refuses to write into a database that already has tables, unless --force.
//   gunzip -c dump.sql.gz | php server/bin/load-sql.php
//   php server/bin/load-sql.php --check      → only reports whether the database is reachable and empty
require dirname(__DIR__) . '/bootstrap.php';

use Gabush\Infrastructure\Config;

if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$cfg = Config::load(gb_config_path());
$db = (array) $cfg->get('db', []);
if (empty($db['name']) || empty($db['user'])) { fwrite(STDERR, "config.php no tiene 'db' (host, port, name, user, password)\n"); exit(2); }
$host = (string) ($db['host'] ?? 'localhost');
$port = (int) ($db['port'] ?? 3306);

try {
    $pdo = new PDO("mysql:host=$host;port=$port;dbname={$db['name']};charset=utf8mb4", (string) $db['user'], (string) ($db['password'] ?? ''), [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
} catch (Throwable $e) {
    fwrite(STDERR, 'No se pudo conectar a la base de datos: ' . $e->getMessage() . "\n");
    exit(3);
}
$tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
if (in_array('--check', $argv, true)) {
    echo 'conexión ok · ' . $pdo->query('SELECT VERSION()')->fetchColumn() . ' · tablas: ' . count($tables) . "\n";
    exit(0);
}
if ($tables && !in_array('--force', $argv, true)) {
    fwrite(STDERR, 'La base de datos ya tiene ' . count($tables) . " tablas: no se cargó nada (usa --force solo si de verdad quieres reemplazarla).\n");
    exit(4);
}

$cmd = ['mysql', '-h', $host, '-P', (string) $port, '-u', (string) $db['user'], '--default-character-set=utf8mb4', (string) $db['name']];
$proc = proc_open($cmd, [0 => STDIN, 1 => STDOUT, 2 => STDERR], $pipes, null, ['MYSQL_PWD' => (string) ($db['password'] ?? ''), 'PATH' => getenv('PATH') ?: '/usr/bin:/bin']);
if (!is_resource($proc)) { fwrite(STDERR, "No se pudo ejecutar mysql\n"); exit(5); }
$code = proc_close($proc);
if ($code !== 0) { fwrite(STDERR, "mysql terminó con código $code\n"); exit($code); }
$n = (int) $pdo->query('SELECT COUNT(*) FROM students')->fetchColumn();
echo "cargado · estudiantes: $n · tablas: " . count($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN)) . "\n";
