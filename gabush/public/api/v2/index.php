<?php
declare(strict_types=1);

// Public entry point of the Gabush v2 API (/api/v2/...). Everything else lives in ../../../server
// (dev: <project>/server, prod: next to public_html — not reachable from the web).
require __DIR__ . '/../_bootstrap.php'; // v1 helpers: config, staff session, permissions
require __DIR__ . '/../_push.php';      // web push (VAPID) shared with the panel's notifications
require dirname(__DIR__, 3) . '/server/bootstrap.php';

rp_check_origin($CONFIG);
$app = Gabush\App::boot();
(new Gabush\Http\Kernel($app))->handle(Gabush\Http\Request::fromGlobals('/api/v2'))->send();
