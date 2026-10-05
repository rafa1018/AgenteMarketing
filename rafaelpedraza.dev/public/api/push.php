<?php
// Admin only — Web Push subscriptions of the admin's devices.
// GET  /api/push.php                                        → { publicKey, subs:[{endpoint, prefs, device}] }
// POST /api/push.php {action:"subscribe", subscription, prefs, device}
// POST /api/push.php {action:"prefs", endpoint, prefs}
// POST /api/push.php {action:"unsubscribe", endpoint}
// POST /api/push.php {action:"test", endpoint}                → sends a test notification to that device
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_push.php';
rp_check_origin($CONFIG);

const MAX_SUBS = 20;
$file = rp_data_dir() . '/push.json';
$method = $_SERVER['REQUEST_METHOD'];

function clean_prefs($p): array
{
    $out = [];
    foreach (PUSH_TYPES as $t) $out[$t] = !isset($p[$t]) || (bool) $p[$t];
    return $out;
}
function valid_endpoint(string $e): bool
{
    return (bool) preg_match('#^https://[a-z0-9.-]+(:\d+)?/#i', $e) && strlen($e) < 1000;
}

if ($method === 'GET') {
    rp_require_admin_read();
    $subs = rp_read_json($file)['subs'] ?? [];
    rp_json(200, ['ok' => true, 'publicKey' => push_vapid()['public'], 'subs' => array_map(fn($s) => ['endpoint' => $s['endpoint'], 'prefs' => $s['prefs'], 'device' => $s['device'] ?? ''], $subs)]);
}
if ($method !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}
rp_require_admin();
$in = rp_body(6000);
$action = $in['action'] ?? '';
$endpoint = (string) ($in['endpoint'] ?? ($in['subscription']['endpoint'] ?? ''));
if (!valid_endpoint($endpoint)) {
    rp_json(422, ['ok' => false, 'error' => 'validation']);
}

if ($action === 'subscribe') {
    $keys = (array) ($in['subscription']['keys'] ?? []);
    $p256dh = (string) ($keys['p256dh'] ?? '');
    $auth = (string) ($keys['auth'] ?? '');
    if (strlen(b64u_dec($p256dh)) !== 65 || strlen(b64u_dec($auth)) !== 16) {
        rp_json(422, ['ok' => false, 'error' => 'validation']);
    }
    $sub = ['endpoint' => $endpoint, 'keys' => ['p256dh' => $p256dh, 'auth' => $auth], 'prefs' => clean_prefs($in['prefs'] ?? []), 'device' => rp_clean($in['device'] ?? '', 60), 'createdAt' => date('c')];
    rp_with_json($file, function (array $data) use ($sub) {
        $subs = array_values(array_filter($data['subs'] ?? [], fn($s) => $s['endpoint'] !== $sub['endpoint']));
        $subs[] = $sub;
        $data['subs'] = array_slice($subs, -MAX_SUBS);
        return [$data, null];
    });
    rp_json(200, ['ok' => true]);
}

if ($action === 'prefs') {
    $prefs = clean_prefs($in['prefs'] ?? []);
    $found = rp_with_json($file, function (array $data) use ($endpoint, $prefs) {
        $hit = false;
        foreach ($data['subs'] ?? [] as $i => $s) {
            if ($s['endpoint'] === $endpoint) {
                $data['subs'][$i]['prefs'] = $prefs;
                $hit = true;
            }
        }
        return [$data, $hit];
    });
    rp_json($found ? 200 : 404, ['ok' => $found]);
}

if ($action === 'unsubscribe') {
    rp_with_json($file, function (array $data) use ($endpoint) {
        $data['subs'] = array_values(array_filter($data['subs'] ?? [], fn($s) => $s['endpoint'] !== $endpoint));
        return [$data, null];
    });
    rp_json(200, ['ok' => true]);
}

if ($action === 'test') {
    $sub = current(array_filter(rp_read_json($file)['subs'] ?? [], fn($s) => $s['endpoint'] === $endpoint));
    if (!$sub) rp_json(404, ['ok' => false, 'error' => 'not_found']);
    $code = push_send_one($sub, ['title' => '🔔 Notificaciones activadas', 'body' => 'Así te avisaremos de mensajes nuevos, descargas de tu CV y visitas.', 'url' => '/admin/#/inicio', 'tag' => 'test', 'type' => 'test'], push_vapid(), 'mailto:' . ($CONFIG['push_contact'] ?? 'admin@rafaelpedraza.dev'));
    rp_json($code >= 200 && $code < 300 ? 200 : 502, ['ok' => $code >= 200 && $code < 300, 'status' => $code]);
}

rp_json(400, ['ok' => false, 'error' => 'validation']);
