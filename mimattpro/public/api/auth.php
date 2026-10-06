<?php
// GET  /api/auth.php                        → { admin, user?, csrf?, defaultPassword? }
// POST /api/auth.php {action:"login", user, password}
// POST /api/auth.php {action:"logout"}       (needs X-CSRF-Token)
require __DIR__ . '/_bootstrap.php';
mm_check_origin($CONFIG);

const LOGIN_MAX_FAILS = 5;
const LOGIN_WINDOW = 900; // 15 min

$method = $_SERVER['REQUEST_METHOD'];
$out = fn() => ['ok' => true, 'admin' => true, 'user' => $_SESSION['user'], 'csrf' => $_SESSION['csrf'], 'defaultPassword' => mm_default_password()];

if ($method === 'GET') {
    if (mm_is_admin()) mm_json(200, $out());
    mm_json(200, ['ok' => true, 'admin' => false]);
}
if ($method !== 'POST') mm_json(405, ['ok' => false, 'error' => 'method']);

$in = mm_body(4000);
$action = $in['action'] ?? '';

if ($action === 'logout') {
    mm_require_admin();
    $_SESSION = [];
    $p = session_get_cookie_params();
    setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => $p['path'], 'secure' => $p['secure'], 'httponly' => true, 'samesite' => 'Strict']);
    session_destroy();
    mm_json(200, ['ok' => true, 'admin' => false]);
}
if ($action !== 'login') mm_json(400, ['ok' => false, 'error' => 'validation']);

$hash = mm_password_hash();
$adminUser = (string) ($CONFIG['admin_user'] ?? '');
if ($hash === '' || $adminUser === '') mm_json(503, ['ok' => false, 'error' => 'not_configured']);

// brute-force protection: max 5 failed attempts per (hashed) IP every 15 minutes
$client = mm_client_hash($CONFIG);
$now = time();
$limitFile = mm_data_dir() . '/loginlimit.json';
$blocked = mm_with_json($limitFile, function (array $data) use ($client, $now) {
    foreach ($data as $k => $fails) {
        $data[$k] = array_values(array_filter((array) $fails, fn($t) => $t > $now - LOGIN_WINDOW));
        if (!$data[$k]) unset($data[$k]);
    }
    return [$data, count($data[$client] ?? []) >= LOGIN_MAX_FAILS];
});
if ($blocked) mm_json(429, ['ok' => false, 'error' => 'rate_limited']);

$user = is_string($in['user'] ?? null) ? mb_substr(trim($in['user']), 0, 60) : '';
$pass = is_string($in['password'] ?? null) ? mb_substr($in['password'], 0, 200) : '';
$valid = hash_equals(mb_strtolower($adminUser), mb_strtolower($user)) & password_verify($pass, $hash);

if (!$valid) {
    mm_with_json($limitFile, function (array $data) use ($client, $now) {
        $data[$client][] = $now;
        return [$data, null];
    });
    usleep(400000);
    mm_json(401, ['ok' => false, 'error' => 'invalid']);
}

mm_session_start();
session_regenerate_id(true);
$_SESSION['admin'] = true;
$_SESSION['user'] = $adminUser;
$_SESSION['seen'] = $now;
$_SESSION['csrf'] = bin2hex(random_bytes(24));
mm_json(200, $out());
