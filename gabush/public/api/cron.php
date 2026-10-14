<?php
// Daily reminders (pagos pendientes, asistencia sin marcar) — run by a Hostinger cron job every 15 minutes:
//   /usr/bin/php /home/<usuario>/domains/<dominio>/public_html/api/cron.php
// Command line only: a browser request gets 403.
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit;
}
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_push.php';
require __DIR__ . '/_reports.php';
rp_daily_backup();
push_maybe_reminders();

// Fase 2 (MySQL): pensiones del mes, mora, recordatorios a familias y cola de correos
if (!empty($CONFIG['db'])) {
    try {
        defined('GB_SERVER') || require dirname(__DIR__, 2) . '/server/bootstrap.php'; // the reminders may have loaded it
        $done = (new Gabush\Application\Scheduler(Gabush\App::boot()))->run();
        echo date('c') . ' v2 ' . json_encode($done) . "\n";
    } catch (Throwable $e) {
        error_log('[gabush cron v2] ' . $e->getMessage());
        echo date('c') . ' v2 ERROR ' . $e->getMessage() . "\n";
    }
}
echo date('c') . " ok\n";
