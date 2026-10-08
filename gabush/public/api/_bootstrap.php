<?php
// Shared helpers for the tiny API (Gabush Kids) (contact form + visit counter).
define('RP_API', true);
date_default_timezone_set('America/Bogota');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'not_configured']);
    exit;
}
$CONFIG = require $configFile;

/**
 * Where all the data (JSON files + student photos) lives.
 * - Local PHP dev server: <project>/.api-data
 * - Production: a folder NEXT TO public_html ("gabush-data"), so publishing a new version — even deleting
 *   public_html — never touches the data, and it is unreachable from the web.
 * - Fallback when that folder can't be created: api/data (protected by .htaccess).
 * GB_DATA_DIR (env) or $CONFIG['data_dir'] override it.
 */
function rp_data_dir(): string
{
    static $dir = null;
    if ($dir !== null) return $dir;
    global $CONFIG;
    if (getenv('GB_DATA_DIR')) {
        $dir = getenv('GB_DATA_DIR');
    } elseif (!empty($CONFIG['data_dir'])) {
        $dir = $CONFIG['data_dir'];
    } elseif (PHP_SAPI === 'cli-server') {
        $dir = dirname(__DIR__, 2) . '/.api-data';
    } else {
        $outside = dirname(__DIR__, 2) . '/gabush-data';
        $dir = ((is_dir($outside) || @mkdir($outside, 0750, true)) && is_writable($outside)) ? $outside : __DIR__ . '/data';
        if ($dir === $outside) rp_migrate_data(__DIR__ . '/data', $outside);
    }
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    return $dir;
}

/** One-time move of data an older version kept inside public_html/api/data. */
function rp_migrate_data(string $from, string $to): void
{
    if (glob("$to/*.json") || !glob("$from/*.json")) return;
    foreach (glob("$from/*.json") as $f) @copy($f, "$to/" . basename($f));
    if (is_dir("$from/photos")) {
        @mkdir("$to/photos", 0750, true);
        foreach (glob("$from/photos/*") ?: [] as $f) @copy($f, "$to/photos/" . basename($f));
    }
}

/** Data files that make up a backup (keys, rate limits and logs are left out). */
const RP_BACKUP_FILES = ['students', 'attendance', 'billing', 'inscriptions', 'events', 'settings', 'visits', 'push', 'feed', 'users', 'visitlog', 'content'];

/** Once a day: copy the JSON data to <data>/backups/YYYY-MM-DD and keep the last 14 days. */
function rp_daily_backup(): void
{
    $base = rp_data_dir() . '/backups';
    $day = "$base/" . date('Y-m-d');
    if (is_dir($day) || !(@mkdir($day, 0750, true))) return;
    foreach (RP_BACKUP_FILES as $name) {
        $f = rp_data_dir() . "/$name.json";
        if (is_file($f)) @copy($f, "$day/$name.json");
    }
    $old = glob("$base/*", GLOB_ONLYDIR) ?: [];
    sort($old);
    foreach (array_slice($old, 0, max(0, count($old) - 14)) as $dir) {
        array_map('unlink', glob("$dir/*") ?: []);
        @rmdir($dir);
    }
}

function rp_json(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Rejects browser calls from foreign origins (CSRF / hot-linking). Same-origin requests may omit Origin. */
function rp_check_origin(array $config): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') {
        return;
    }
    if (!in_array($origin, $config['allowed_origins'], true)) {
        rp_json(403, ['ok' => false, 'error' => 'forbidden']);
    }
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}

function rp_client_hash(array $config): string
{
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return substr(hash('sha256', $config['salt'] . '|' . $ip), 0, 24);
}

/**
 * Atomically read-modify-write a JSON file under an exclusive lock.
 * $fn receives the decoded array and returns [newData, result].
 */
function rp_with_json(string $file, callable $fn)
{
    $fp = fopen($file, 'c+');
    if (!$fp) {
        rp_json(500, ['ok' => false, 'error' => 'storage']);
    }
    flock($fp, LOCK_EX);
    $raw = stream_get_contents($fp);
    $data = $raw ? (json_decode($raw, true) ?: []) : [];
    [$data, $result] = $fn($data);
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode($data));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $result;
}

function rp_is_bot(): bool
{
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    return $ua === '' || (bool) preg_match('/bot|crawl|spider|slurp|preview|monitor|headless|lighthouse|curl|wget|python|httpclient/i', $ua);
}

/* ───────────── Admin session (calendar module) ───────────── */

const RP_ADMIN_IDLE = 28800; // 8 h of inactivity logs the admin out

function rp_is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

/** Starts the admin session: HttpOnly + SameSite=Strict cookie scoped to /api. */
function rp_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_name('gbadmin');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/api',
        'secure'   => rp_is_https(),
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    ini_set('session.use_strict_mode', '1');
    session_start();
}

/** True when a logged-in, non-expired admin session exists (refreshes the idle timer). */
function rp_is_admin(): bool
{
    // Visitors without the admin cookie never get a session (no cookie is set for the public).
    if (session_status() !== PHP_SESSION_ACTIVE && empty($_COOKIE['gbadmin'])) {
        return false;
    }
    rp_session_start();
    if (empty($_SESSION['admin'])) {
        return false;
    }
    if (time() - (int) ($_SESSION['seen'] ?? 0) > RP_ADMIN_IDLE) {
        $_SESSION = [];
        session_destroy();
        return false;
    }
    $_SESSION['seen'] = time();
    return true;
}

/** Mutations need an admin session AND the per-session CSRF token in the X-CSRF-Token header. */
function rp_require_admin(): void
{
    if (!rp_is_admin() || !rp_current_user()) {
        rp_json(401, ['ok' => false, 'error' => 'unauthorized']);
    }
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($sent) || !hash_equals((string) ($_SESSION['csrf'] ?? ''), $sent)) {
        rp_json(403, ['ok' => false, 'error' => 'csrf']);
    }
}

/** Decoded JSON request body (400 when it is not a JSON object). */
function rp_body(int $max = 20000): array
{
    $raw = file_get_contents('php://input', false, null, 0, $max);
    $in = json_decode($raw ?: '', true);
    if (!is_array($in)) {
        rp_json(400, ['ok' => false, 'error' => 'validation']);
    }
    return $in;
}

/** Colombian mobile (+57 + 10 digits starting with 3) → "+57 301 648 3958", or null when invalid. */
function rp_phone_co(string $input): ?string
{
    $d = preg_replace('/\D/', '', $input);
    if (strlen($d) === 12 && strpos($d, '57') === 0) $d = substr($d, 2);
    if (!preg_match('/^3\d{9}$/', $d)) return null;
    return '+57 ' . substr($d, 0, 3) . ' ' . substr($d, 3, 3) . ' ' . substr($d, 6);
}

/** Strips control characters, trims and caps the length. */
function rp_clean($v, int $max): string
{
    $v = is_string($v) ? $v : '';
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return mb_substr(trim($v), 0, $max);
}

/** Admin-only reads (GET): a valid session is enough, no CSRF token needed. */
function rp_require_admin_read(): void
{
    if (!rp_is_admin() || !rp_current_user()) {
        rp_json(401, ['ok' => false, 'error' => 'unauthorized']);
    }
    header('Cache-Control: private, no-store');
}

/* ───────────── Visitors: IP, location, device ───────────── */

/** Visitor IP (Hostinger's CDN passes the real one in REMOTE_ADDR). */
function rp_client_ip(): string
{
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}

/** Sends the JSON response now and keeps running (the visitor doesn't wait for geolocation). */
function rp_json_then_continue(array $body, int $status = 200): void
{
    ignore_user_abort(true);
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    if (function_exists('litespeed_finish_request')) litespeed_finish_request();
    elseif (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
}

/** Country / region / city / ISP of an IP (approximate), cached in geo.json: each IP is looked up only once. */
function rp_geo(string $ip): array
{
    $none = ['country' => '', 'cc' => '', 'region' => '', 'city' => '', 'isp' => ''];
    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
        return ['country' => 'Red local'] + $none;
    }
    $file = rp_data_dir() . '/geo.json';
    $cache = rp_read_json($file);
    if (isset($cache[$ip])) return $cache[$ip];

    $geo = null;
    $ctx = stream_context_create(['http' => ['timeout' => 4, 'ignore_errors' => true]]);
    $r = json_decode((string) @file_get_contents('http://ip-api.com/json/' . rawurlencode($ip) . '?fields=status,country,countryCode,regionName,city,isp&lang=es', false, $ctx), true);
    if (($r['status'] ?? '') === 'success') {
        $geo = ['country' => $r['country'], 'cc' => $r['countryCode'], 'region' => $r['regionName'], 'city' => $r['city'], 'isp' => $r['isp']];
    } else {
        $r = json_decode((string) @file_get_contents('https://ipwho.is/' . rawurlencode($ip) . '?fields=success,country,country_code,region,city,connection&lang=es', false, $ctx), true);
        if (!empty($r['success'])) {
            $geo = ['country' => $r['country'], 'cc' => $r['country_code'], 'region' => $r['region'], 'city' => $r['city'], 'isp' => $r['connection']['isp'] ?? ''];
        }
    }
    if (!$geo) return $none;
    rp_with_json($file, function (array $data) use ($ip, $geo) {
        $data[$ip] = $geo;
        if (count($data) > 5000) $data = array_slice($data, -4000, null, true);
        return [$data, null];
    });
    return $geo;
}

/** "Chrome · Android" style label + device kind from the User-Agent. */
function rp_device(string $ua): array
{
    $os = 'Otro';
    foreach (['Android' => '/android/i', 'iPhone' => '/iphone/i', 'iPad' => '/ipad/i', 'Windows' => '/windows/i', 'macOS' => '/macintosh|mac os x/i', 'Linux' => '/linux/i'] as $name => $re) {
        if (preg_match($re, $ua)) { $os = $name; break; }
    }
    $browser = 'Otro';
    foreach (['Edge' => '/edg\//i', 'Opera' => '/opr\//i', 'Samsung' => '/samsungbrowser/i', 'Facebook' => '/fban|fbav/i', 'Instagram' => '/instagram/i', 'Chrome' => '/chrome|crios/i', 'Firefox' => '/firefox|fxios/i', 'Safari' => '/safari/i'] as $name => $re) {
        if (preg_match($re, $ua)) { $browser = $name; break; }
    }
    $kind = preg_match('/ipad|tablet/i', $ua) ? 'tablet' : (preg_match('/mobi|iphone|android/i', $ua) ? 'mobile' : 'desktop');
    return ['label' => "$browser · $os", 'kind' => $kind];
}

/* ───────────── Users, roles and permissions ─────────────
 * - The user in config.php (admin_user) is the technical owner: always every permission, can't be locked out.
 * - Everyone else lives in <data>/users.json and is managed by whoever has the "usuarios" permission.
 * - Permissions are re-read on every request, so changes (or deactivating someone) apply immediately.
 */
const RP_PERMS = ['asistencia', 'estudiantes', 'pagos', 'inscripciones', 'calendario', 'feed', 'ajustes', 'usuarios', 'matriculas', 'academico', 'calificaciones', 'observador', 'caja', 'mensajes'];
const RP_ROOT = 'root';

/** The logged-in user: ['id', 'user', 'name', 'role', 'perms'] — null when nobody (or a deactivated user) is logged in. */
function rp_current_user(): ?array
{
    static $me = false;
    if ($me !== false) return $me;
    global $CONFIG;
    $me = null;
    if (!rp_is_admin()) return null;
    $uid = (string) ($_SESSION['uid'] ?? RP_ROOT); // sessions from before users existed = owner
    if ($uid === RP_ROOT) {
        $me = ['id' => RP_ROOT, 'user' => (string) ($CONFIG['admin_user'] ?? ''), 'name' => (string) ($CONFIG['admin_name'] ?? 'Administración'), 'role' => 'admin', 'perms' => RP_PERMS];
        return $me;
    }
    foreach (rp_read_json(rp_data_dir() . '/users.json')['users'] ?? [] as $u) {
        if (($u['id'] ?? '') === $uid && !empty($u['active'])) {
            $me = ['id' => $u['id'], 'user' => $u['user'], 'name' => $u['name'], 'role' => $u['role'], 'perms' => rp_role_perms($u)];
            return $me;
        }
    }
    // the user was deleted or deactivated: end the session
    $_SESSION = [];
    session_destroy();
    return null;
}

/** A user's permissions: the "rectora" role always gets all of them (also future ones); others, what was ticked. */
function rp_role_perms(array $u): array
{
    if (($u['role'] ?? '') === 'rectora') return RP_PERMS;
    return array_values(array_intersect(RP_PERMS, (array) ($u['perms'] ?? [])));
}

/** Permissions of any user id (for work done without a session, e.g. notifications). [] when unknown or inactive. */
function rp_user_perms(string $uid): array
{
    if ($uid === '' || $uid === RP_ROOT) return RP_PERMS;
    foreach (rp_read_json(rp_data_dir() . '/users.json')['users'] ?? [] as $u) {
        if (($u['id'] ?? '') === $uid) return empty($u['active']) ? [] : rp_role_perms($u);
    }
    return [];
}

function rp_can(string $perm): bool
{
    $me = rp_current_user();
    return $me !== null && in_array($perm, $me['perms'], true);
}

/** Mutation that needs ANY of the given permissions (plus a valid session and CSRF token). */
function rp_require_perm(string ...$perms): void
{
    rp_require_admin();
    if (!rp_current_user()) rp_json(401, ['ok' => false, 'error' => 'unauthorized']);
    foreach ($perms as $p) if (rp_can($p)) return;
    rp_json(403, ['ok' => false, 'error' => 'forbidden']);
}

/** Read (GET) that needs ANY of the given permissions. */
function rp_require_perm_read(string ...$perms): void
{
    rp_require_admin_read();
    if (!rp_current_user()) rp_json(401, ['ok' => false, 'error' => 'unauthorized']);
    foreach ($perms as $p) if (rp_can($p)) return;
    rp_json(403, ['ok' => false, 'error' => 'forbidden']);
}

/** Decoded JSON file (empty array when missing). */
function rp_read_json(string $file): array
{
    return is_file($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : [];
}

function rp_uid(): string
{
    return bin2hex(random_bytes(8));
}

function rp_valid_date(string $d): bool
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m)) return false;
    return checkdate((int) $m[2], (int) $m[3], (int) $m[1]) && (int) $m[1] >= 2000 && (int) $m[1] <= 2100;
}
