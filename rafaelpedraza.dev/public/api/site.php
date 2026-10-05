<?php
// GET /api/site.php — public settings the site needs at load time: { cv: {enabled}, music: {src|null} }
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

$s = rp_settings();
// no-store (set in _bootstrap): changes made in the admin panel must show up on the next load, never a cached copy
rp_json(200, [
    'ok' => true,
    'cv' => ['enabled' => $s['cvEnabled']],
    'music' => ['src' => rp_music_src($s), 'autoplay' => $s['music']['autoplay'], 'volume' => $s['music']['volume']],
]);
