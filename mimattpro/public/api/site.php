<?php
// GET /api/site.php — public settings the site needs at load time: { theme: 'blue' | 'gold' }
require __DIR__ . '/_bootstrap.php';
mm_check_origin($CONFIG);

mm_json(200, ['ok' => true] + mm_settings());
