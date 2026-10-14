<?php
// Web Push subscriptions — every staff user can register their own devices; each device only receives
// the notification types its user's permissions allow (see PUSH_PERMS in _push.php).
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
/** Records who turned notifications on (or tried and failed, with why) in the notification log. */
function push_activation_log(string $uid, string $device, bool $ok, ?string $error): void
{
    $app = push_app();
    if (!$app) return;
    $who = push_user_name($uid);
    Gabush\Application\Notifications\StaffDigest::log(
        $app, 'panel', 'activacion',
        $ok ? "🔔 $who activó las notificaciones" : "⚠️ $who intentó activar las notificaciones y no se pudo",
        $ok ? null : $error, null, $who,
        [['who' => $who, 'device' => $device ?: 'Dispositivo', 'status' => $ok ? 201 : 0]],
    );
}

function valid_endpoint(string $e): bool
{
    return (bool) preg_match('#^https://[a-z0-9.-]+(:\d+)?/#i', $e) && strlen($e) < 1000;
}

if ($method === 'GET') {
    rp_require_admin_read();
    $me = rp_current_user()['id'];
    $subs = array_values(array_filter(rp_read_json($file)['subs'] ?? [], fn($s) => ($s['uid'] ?? RP_ROOT) === $me));
    rp_json(200, ['ok' => true, 'publicKey' => push_vapid()['public'], 'allowed' => rp_user_push_types($me), 'subs' => array_map(fn($s) => ['endpoint' => $s['endpoint'], 'prefs' => $s['prefs'], 'device' => $s['device'] ?? ''], $subs)]);
}
if ($method !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}
rp_require_admin();
$me = rp_current_user()['id'];
$in = rp_body(6000);
$action = $in['action'] ?? '';
// a failed attempt to turn notifications on (permission blocked, browser without push…): recorded so the
// school can see who tried and why it did not work (Auditoría → Notificaciones)
if ($action === 'report') {
    push_activation_log($me, rp_clean($in['device'] ?? '', 60), false, rp_clean($in['error'] ?? 'Error desconocido', 300));
    rp_json(200, ['ok' => true]);
}

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
    $sub = ['endpoint' => $endpoint, 'keys' => ['p256dh' => $p256dh, 'auth' => $auth], 'prefs' => clean_prefs($in['prefs'] ?? []), 'device' => rp_clean($in['device'] ?? '', 60), 'uid' => $me, 'createdAt' => date('c')];
    rp_with_json($file, function (array $data) use ($sub) {
        $subs = array_values(array_filter($data['subs'] ?? [], fn($s) => $s['endpoint'] !== $sub['endpoint']));
        $subs[] = $sub;
        $data['subs'] = array_slice($subs, -MAX_SUBS);
        return [$data, null];
    });
    push_activation_log($me, $sub['device'], true, null);
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
    $code = push_send_one($sub, ['title' => '🔔 Notificaciones activadas', 'body' => 'Así te avisaremos de inscripciones, pagos y asistencia.', 'url' => '/admin/#/inicio', 'tag' => 'test', 'type' => 'test'], push_vapid(), 'mailto:' . ($CONFIG['push_contact'] ?? 'gabushjardin@gmail.com'));
    rp_json($code >= 200 && $code < 300 ? 200 : 502, ['ok' => $code >= 200 && $code < 300, 'status' => $code]);
}

rp_json(400, ['ok' => false, 'error' => 'validation']);
