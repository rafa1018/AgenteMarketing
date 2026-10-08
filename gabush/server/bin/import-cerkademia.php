<?php
declare(strict_types=1);

// Imports the Cerkademia export into the database (safe to run again: it upserts).
//   php server/bin/import-cerkademia.php [path to .migration/raw]
require dirname(__DIR__) . '/bootstrap.php';

use Gabush\App;
use Gabush\Infrastructure\Database\Migrator;
use Gabush\Infrastructure\Migration\CerkademiaImporter;

if (PHP_SAPI !== 'cli') { http_response_code(403); exit; }
$raw = $argv[1] ?? dirname(GB_SERVER) . '/.migration/raw';
$app = App::boot();
(new Migrator($app->db(), GB_SERVER . '/migrations'))->migrate();
$t = microtime(true);
$stats = (new CerkademiaImporter($app->db(), $raw, $app->dataDir(), static fn($m) => print("  $m\n")))->run();
foreach ($stats as $k => $v) printf("  %-24s %d\n", $k, $v);
printf("Listo en %.1f s\n", microtime(true) - $t);
