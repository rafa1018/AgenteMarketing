<?php
// GET  /api/visits.php → { count }
// POST /api/visits.php {ref?, lang?, tz?, screen?} → registers a visit → { count }
//   The public counter goes up once per visitor every 12 h; bots and logged-in staff are never counted.
//   After answering, the visit is added to the history (visitlog.json) with its approximate location
//   (from the IP, looked up once per IP) and device — shown in the admin panel → Visitas.
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

const DEDUPE_SECONDS = 43200; // 12 h
const VISIT_LOG_MAX = 5000;
$file = rp_data_dir() . '/visits.json';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    rp_json(200, ['ok' => true, 'count' => (int) (rp_read_json($file)['count'] ?? 0)]);
}
if ($method !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}

// staff browsing the site with the panel open must not inflate the numbers
if (rp_is_bot() || rp_is_admin()) {
    rp_json(200, ['ok' => true, 'count' => (int) (rp_read_json($file)['count'] ?? 0)]);
}

$raw = file_get_contents('php://input', false, null, 0, 4000);
$in = json_decode($raw ?: '', true);
$in = is_array($in) ? $in : [];

$client = rp_client_hash($CONFIG);
$now = time();
[$count, $isNew] = rp_with_json($file, function (array $data) use ($client, $now) {
    $data['count'] = (int) ($data['count'] ?? 0);
    $seen = array_filter((array) ($data['seen'] ?? []), fn($t) => $t > $now - DEDUPE_SECONDS);
    $isNew = !isset($seen[$client]);
    if ($isNew) {
        $data['count']++;
        $seen[$client] = $now;
    }
    $data['seen'] = $seen;
    return [$data, [$data['count'], $isNew]];
});

rp_json_then_continue(['ok' => true, 'count' => $count]);

// ── after the response: history entry with location ──
try {
    $ip = rp_client_ip();
    $ua = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300);
    $geo = rp_geo($ip);
    $dev = rp_device($ua);
    $ref = rp_clean($in['ref'] ?? '', 300);
    $entry = [
        'id' => rp_uid(),
        't' => $now,
        'ip' => $ip,
        'new' => $isNew,
        'country' => $geo['country'], 'cc' => $geo['cc'], 'region' => $geo['region'], 'city' => $geo['city'], 'isp' => $geo['isp'],
        'device' => $dev['label'],
        'kind' => $dev['kind'],
        'ref' => preg_match('#^https?://#i', $ref) && !preg_match('#^https?://(www\.)?gabushkids\.com#i', $ref) ? $ref : '',
        'lang' => rp_clean($in['lang'] ?? '', 20),
        'tz' => rp_clean($in['tz'] ?? '', 60),
        'screen' => rp_clean($in['screen'] ?? '', 20),
    ];
    rp_with_json(rp_data_dir() . '/visitlog.json', function (array $data) use ($entry) {
        $data[] = $entry;
        if (count($data) > VISIT_LOG_MAX) $data = array_slice($data, -VISIT_LOG_MAX);
        return [$data, null];
    });
} catch (Throwable $e) {
    // the history must never break the counter
}

require __DIR__ . '/_push.php';
require __DIR__ . '/_reports.php';
try {
    rp_daily_backup();
    push_maybe_reminders();
} catch (Throwable $e) {
    // reminders must never break the visit counter
}
