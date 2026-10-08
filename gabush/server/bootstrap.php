<?php
declare(strict_types=1);

/*
 * Gabush application kernel (fase 2).
 *
 * Layout (clean architecture, dependencies point inwards):
 *   src/Domain          entities, value objects and business rules — no I/O
 *   src/Application     use cases that orchestrate the domain through ports (interfaces)
 *   src/Infrastructure  adapters: MySQL repositories, payment gateways, SMTP mail, files, clock
 *   src/Http            router, controllers, middleware (staff / family auth, CSRF)
 *
 * Where it runs:
 *   dev   <project>/server                     (PHP built-in server on public/, API at /api/v2/)
 *   prod  domains/gabushkids.com/server        (outside public_html; only api/v2/index.php is public)
 * Configuration comes from public/api/config.php (prod keeps its own copy, never overwritten by deploys).
 */

const GB_SERVER = __DIR__;
date_default_timezone_set('America/Bogota');

spl_autoload_register(static function (string $class): void {
    if (!str_starts_with($class, 'Gabush\\')) {
        return;
    }
    $file = GB_SERVER . '/src/' . str_replace('\\', '/', substr($class, 7)) . '.php';
    if (is_file($file)) {
        require $file;
    }
});

/** Locates config.php next to the public API (public/api in dev, public_html/api in prod). */
function gb_config_path(): string
{
    $candidates = [
        getenv('GB_CONFIG') ?: '',
        dirname(GB_SERVER) . '/public/api/config.php',      // dev
        dirname(GB_SERVER) . '/public_html/api/config.php', // prod: server/ sits next to public_html/
    ];
    foreach ($candidates as $c) {
        if ($c !== '' && is_file($c)) {
            return $c;
        }
    }
    throw new RuntimeException('config.php not found');
}
