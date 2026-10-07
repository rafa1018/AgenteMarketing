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
echo date('c') . " ok\n";
