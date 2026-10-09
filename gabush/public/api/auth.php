<?php
// GET  /api/auth.php                       → { admin, user?, name?, role?, perms?, csrf? }
// POST /api/auth.php {action:"login", user, password}
// POST /api/auth.php {action:"logout"}      (needs X-CSRF-Token)
//
// Who can log in: the owner in config.php (admin_user, every permission) and the staff users in
// <data>/users.json (rectora, docentes, auxiliares… each with their own permissions — see users.php).
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

const LOGIN_MAX_FAILS = 5;
const LOGIN_WINDOW = 900; // 15 min

$method = $_SERVER['REQUEST_METHOD'];

/** Access audit of the panel (MySQL phase): sign-ins, failures and sign-outs. Never breaks the login. */
function auth_audit(string $userId, ?string $name, ?string $role, string $event): void
{
    global $CONFIG;
    if (empty($CONFIG['db'])) return;
    try {
        require_once dirname(__DIR__, 2) . '/server/bootstrap.php';
        (new Gabush\Application\Shared\AccessAudit(Gabush\App::boot()->db()))->event('panel', $userId, $name, $role, $event);
    } catch (Throwable $e) {
        error_log('[gabush audit] ' . $e->getMessage());
    }
}

function auth_payload(array $me): array
{
    return ['ok' => true, 'admin' => true, 'uid' => $me['id'], 'user' => $me['user'], 'name' => $me['name'], 'role' => $me['role'], 'perms' => $me['perms'], 'csrf' => $_SESSION['csrf']];
}

if ($method === 'GET') {
    $me = rp_current_user();
    if ($me) rp_json(200, auth_payload($me));
    rp_json(200, ['ok' => true, 'admin' => false]);
}
if ($method !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}

$in = rp_body(4000);
$action = $in['action'] ?? '';

if ($action === 'logout') {
    rp_require_admin();
    if ($me = rp_current_user()) auth_audit((string) $me['id'], (string) $me['name'], (string) $me['role'], ($in['reason'] ?? '') === 'idle' ? 'inactividad' : 'salida');
    $_SESSION = [];
    $p = session_get_cookie_params();
    setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
    session_destroy();
    rp_json(200, ['ok' => true, 'admin' => false]);
}

if ($action !== 'login') {
    rp_json(400, ['ok' => false, 'error' => 'validation']);
}

$rootHash = (string) ($CONFIG['admin_password_hash'] ?? '');
$rootUser = (string) ($CONFIG['admin_user'] ?? '');
$users = rp_read_json(rp_data_dir() . '/users.json')['users'] ?? [];
if (($rootHash === '' || $rootUser === '') && !$users) {
    rp_json(503, ['ok' => false, 'error' => 'not_configured']);
}

// Brute-force protection: max 5 failed attempts per (hashed) IP every 15 minutes.
$client = rp_client_hash($CONFIG);
$now = time();
$limitFile = rp_data_dir() . '/loginlimit.json';
$blocked = rp_with_json($limitFile, function (array $data) use ($client, $now) {
    foreach ($data as $k => $fails) {
        $data[$k] = array_values(array_filter((array) $fails, fn($t) => $t > $now - LOGIN_WINDOW));
        if (!$data[$k]) unset($data[$k]);
    }
    return [$data, count($data[$client] ?? []) >= LOGIN_MAX_FAILS];
});
if ($blocked) {
    rp_json(429, ['ok' => false, 'error' => 'rate_limited']);
}

$user = mb_strtolower(rp_clean($in['user'] ?? '', 60));
$pass = is_string($in['password'] ?? null) ? mb_substr($in['password'], 0, 200) : '';

$uid = null;
if ($rootUser !== '' && hash_equals(mb_strtolower($rootUser), $user)) {
    if (password_verify($pass, $rootHash)) $uid = RP_ROOT;
} else {
    $found = null;
    foreach ($users as $u) if (mb_strtolower($u['user'] ?? '') === $user) $found = $u;
    // always run one bcrypt check so a wrong user takes as long as a wrong password
    $ok = password_verify($pass, $found['hash'] ?? password_hash('gabush-dummy', PASSWORD_DEFAULT));
    if ($found && $ok && !empty($found['active'])) $uid = $found['id'];
}

if ($uid === null) {
    rp_with_json($limitFile, function (array $data) use ($client, $now) {
        $data[$client][] = $now;
        return [$data, null];
    });
    auth_audit($user !== '' ? $user : '(vacío)', 'Usuario escrito: ' . $user, null, 'fallido');
    usleep(400000); // slow down guessing a little more
    rp_json(401, ['ok' => false, 'error' => 'invalid']);
}

rp_session_start();
session_regenerate_id(true);
$_SESSION['admin'] = true;
$_SESSION['uid'] = $uid;
$_SESSION['seen'] = $now;
$_SESSION['csrf'] = bin2hex(random_bytes(24));

if ($uid !== RP_ROOT) {
    rp_with_json(rp_data_dir() . '/users.json', function (array $data) use ($uid) {
        foreach ($data['users'] ?? [] as $i => $u) if ($u['id'] === $uid) $data['users'][$i]['lastLogin'] = date('c');
        return [$data, null];
    });
}

$me = rp_current_user();
auth_audit((string) $me['id'], (string) $me['name'], (string) $me['role'], 'ingreso');
rp_json(200, auth_payload($me));
