<?php
// GET  /api/visits.php → { count }
// POST /api/visits.php {path?, ref?, lang?, tz?, screen?} → registers a visit → { count }
//   The counter goes up once per visitor IP (IPv6: per /64), forever; returning visitors only add a history entry.
//   Bots and the logged-in admin are never counted.
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_push.php';
rp_check_origin($CONFIG);

const VISIT_LOG_MAX = 5000;
$file = rp_data_dir() . '/visits.json';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    rp_json(200, ['ok' => true, 'count' => (int) (rp_read_json($file)['count'] ?? 0)]);
}
if ($method !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}

if (rp_is_bot() || rp_is_admin()) {
    rp_json(200, ['ok' => true, 'count' => (int) (rp_read_json($file)['count'] ?? 0)]);
}

$raw = file_get_contents('php://input', false, null, 0, 4000);
$in = json_decode($raw ?: '', true);
$in = is_array($in) ? $in : [];

$visitor = rp_visitor_hash($CONFIG);
$now = time();
[$count, $isNew] = rp_with_json($file, function (array $data) use ($visitor, $now) {
    $data['count'] = (int) ($data['count'] ?? 0);
    $data['seen'] = (array) ($data['seen'] ?? []);
    $isNew = !isset($data['seen'][$visitor]);
    if ($isNew) {
        $data['count']++;
        $data['seen'][$visitor] = $now;
    }
    return [$data, [$data['count'], $isNew]];
});

rp_json_then_continue(['ok' => true, 'count' => $count]);

// ── after the response: history entry with location (looked up once per IP) ──
$ip = rp_client_ip();
$ua = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300);
$geo = rp_geo($ip);
$ref = rp_clean($in['ref'] ?? '', 300);
$entry = [
    'id' => rp_uid(),
    't' => $now,
    'ip' => $ip,
    'new' => $isNew,
    'country' => $geo['country'], 'cc' => $geo['cc'], 'region' => $geo['region'], 'city' => $geo['city'], 'isp' => $geo['isp'],
    'device' => rp_device($ua)['label'],
    'kind' => rp_device($ua)['kind'],
    'ref' => preg_match('#^https?://#i', $ref) ? $ref : '',
    'lang' => rp_clean($in['lang'] ?? '', 20),
    'tz' => rp_clean($in['tz'] ?? '', 60),
    'screen' => rp_clean($in['screen'] ?? '', 20),
    'ua' => $ua,
];
rp_with_json(rp_data_dir() . '/visitlog.json', function (array $data) use ($entry) {
    $data[] = $entry;
    if (count($data) > VISIT_LOG_MAX) $data = array_slice($data, -VISIT_LOG_MAX);
    return [$data, null];
});
rp_daily_backup();

if ($isNew) {
    $where = implode(', ', array_filter([$geo['city'], $geo['country']])) ?: 'ubicación desconocida';
    push_notify('visitas', ['title' => '👀 Nueva visita #' . $count, 'body' => "Desde $where · {$entry['device']}", 'url' => '/admin/#/visitas', 'tag' => 'visita']);
}

