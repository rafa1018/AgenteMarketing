<?php
declare(strict_types=1);

// Tiny test runner (no Composer needed on the hosting):   php server/tests/run.php
require dirname(__DIR__) . '/bootstrap.php';

$failures = 0;
$count = 0;
function check(bool $cond, string $what): void
{
    global $failures, $count;
    $count++;
    if (!$cond) {
        $failures++;
        echo "  ✗ $what\n";
    }
}
function same(mixed $expected, mixed $actual, string $what): void
{
    check($expected === $actual, $what . ' (esperado ' . json_encode($expected) . ', obtenido ' . json_encode($actual) . ')');
}

foreach (glob(__DIR__ . '/*Test.php') ?: [] as $file) {
    echo basename($file, '.php') . "\n";
    require $file;
}
echo PHP_EOL . ($failures ? "$failures de $count comprobaciones fallaron" : "$count comprobaciones OK") . PHP_EOL;
exit($failures ? 1 : 0);
