<?php
// GET  /api/visits.php → { count }
// POST /api/visits.php → registers a visit (once per visitor every 12 h, bots ignored) → { count }
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

const DEDUPE_SECONDS = 43200; // 12 h
$file = rp_data_dir() . '/visits.json';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $data = is_file($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : [];
    rp_json(200, ['ok' => true, 'count' => (int) ($data['count'] ?? 0)]);
}
if ($method !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}

$client = rp_client_hash($CONFIG);
$now = time();
$count = rp_with_json($file, function (array $data) use ($client, $now) {
    $data['count'] = (int) ($data['count'] ?? 0);
    $seen = $data['seen'] ?? [];
    // forget visitors older than the dedupe window
    $seen = array_filter($seen, fn($t) => $t > $now - DEDUPE_SECONDS);
    if (!rp_is_bot() && !isset($seen[$client])) {
        $data['count']++;
        $seen[$client] = $now;
    }
    $data['seen'] = $seen;
    return [$data, $data['count']];
});

rp_json(200, ['ok' => true, 'count' => $count]);
