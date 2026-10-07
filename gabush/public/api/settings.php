<?php
// GET  /api/settings.php                              → { schedule }   (public)
// POST /api/settings.php {action:"schedule", schedule} → { schedule }   (admin + X-CSRF-Token)
//
// schedule = { days: [ {open: bool, slots: [{from:"08:00", to:"11:00"}, …]} × 7 ] }, index 0 = Monday.
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

const MAX_SLOTS = 3;

function default_schedule(): array
{
    $weekday = ['open' => true, 'slots' => [['from' => '08:00', 'to' => '11:00'], ['from' => '14:00', 'to' => '17:00']]];
    $closed = ['open' => false, 'slots' => []];
    return ['days' => [$weekday, $weekday, $weekday, $weekday, $weekday, $closed, $closed]];
}

$file = rp_data_dir() . '/settings.json';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $data = is_file($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : [];
    rp_json(200, ['ok' => true, 'schedule' => $data['schedule'] ?? default_schedule()]);
}
if ($method !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}

rp_require_perm('ajustes', 'calendario');
$in = rp_body(8000);
if (($in['action'] ?? '') !== 'schedule' || !is_array($in['schedule']['days'] ?? null) || count($in['schedule']['days']) !== 7) {
    rp_json(400, ['ok' => false, 'error' => 'validation']);
}

$days = [];
$bad = [];
foreach (array_values($in['schedule']['days']) as $i => $d) {
    $open = !empty($d['open']);
    $slots = [];
    foreach (array_slice((array) ($d['slots'] ?? []), 0, MAX_SLOTS) as $s) {
        $from = rp_clean($s['from'] ?? '', 5);
        $to = rp_clean($s['to'] ?? '', 5);
        if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $from) || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $to) || $from >= $to) {
            $bad[] = $i;
            continue;
        }
        $slots[] = ['from' => $from, 'to' => $to];
    }
    usort($slots, fn($a, $b) => strcmp($a['from'], $b['from']));
    if ($open && !$slots) $bad[] = $i;
    $days[] = ['open' => $open, 'slots' => $open ? $slots : []];
}
if ($bad) {
    rp_json(422, ['ok' => false, 'error' => 'validation', 'days' => array_values(array_unique($bad))]);
}

$schedule = ['days' => $days];
rp_with_json($file, function (array $data) use ($schedule) {
    $data['schedule'] = $schedule;
    return [$data, null];
});
rp_json(200, ['ok' => true, 'schedule' => $schedule]);
