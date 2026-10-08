<?php
declare(strict_types=1);

// Applies pending database migrations.   php server/bin/migrate.php
require dirname(__DIR__) . '/bootstrap.php';

use Gabush\Infrastructure\Config;
use Gabush\Infrastructure\Database\Database;
use Gabush\Infrastructure\Database\Migrator;

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}
$config = Config::load(gb_config_path());
$db = Database::connect($config->get('db'));
$applied = (new Migrator($db, GB_SERVER . '/migrations'))->migrate();
echo $applied ? 'Aplicadas: ' . implode(', ', $applied) . PHP_EOL : 'La base ya está al día.' . PHP_EOL;
