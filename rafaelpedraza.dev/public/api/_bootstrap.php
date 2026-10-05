<?php
// Shared helpers for the API: public endpoints (contact, visits, cv, site) and the private admin panel.
define('RP_API', true);
date_default_timezone_set('America/Bogota');
ini_set('display_errors', '0'); // a PHP notice must never end up inside a JSON response
ini_set('log_errors', '1');

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
 * Where all the data (JSON files + uploaded music) lives.
 * - Local PHP dev server: <project>/.api-data
 * - Production: a folder NEXT TO public_html ("rp-data"), so publishing a new version — even deleting
 *   public_html — never touches the data, and it is unreachable from the web.
 * - Fallback when that folder can't be created: api/data (protected by .htaccess).
 * $CONFIG['data_dir'] overrides it.
 */
function rp_data_dir(): string
{
    static $dir = null;
    if ($dir !== null) return $dir;
    global $CONFIG;
    if (!empty($CONFIG['data_dir'])) {
        $dir = $CONFIG['data_dir'];
    } elseif (PHP_SAPI === 'cli-server') {
        $dir = dirname(__DIR__, 2) . '/.api-data';
    } else {
        $outside = dirname(__DIR__, 2) . '/rp-data';
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
}

/** Data files that make up a backup (keys, rate limits and the music file are left out). */
const RP_BACKUP_FILES = ['experience', 'stack', 'subscribers', 'visits', 'visitlog', 'downloads', 'messages', 'settings', 'push', 'geo'];

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

/** Visitor IP (Hostinger's CDN passes the real one in REMOTE_ADDR). */
function rp_client_ip(): string
{
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return filter_var($ip, FILTER_VALIDATE_IP) ? $ip : '0.0.0.0';
}

/**
 * What identifies "one visitor" for the counter: the IPv4 address, or the /64 prefix for IPv6
 * (phones rotate the last half of their IPv6 address several times a day).
 */
function rp_ip_key(string $ip): string
{
    if (strpos($ip, ':') === false) return $ip;
    $bin = @inet_pton($ip);
    if ($bin === false) return $ip;
    return inet_ntop(substr($bin, 0, 8) . str_repeat("\0", 8)) . '/64';
}

function rp_client_hash(array $config): string
{
    return substr(hash('sha256', $config['salt'] . '|' . rp_client_ip()), 0, 24);
}

/** Salted hash of the visitor key (same visitor → same hash). */
function rp_visitor_hash(array $config): string
{
    return substr(hash('sha256', $config['salt'] . '|' . rp_ip_key(rp_client_ip())), 0, 24);
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
    fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return $result;
}

/** Decoded JSON file (empty array when missing). */
function rp_read_json(string $file): array
{
    return is_file($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : [];
}

function rp_is_bot(): bool
{
    $ua = $_SERVER['HTTP_USER_AGENT'] ?? '';
    return $ua === '' || (bool) preg_match('/bot|crawl|spider|slurp|preview|monitor|headless|lighthouse|curl|wget|python|httpclient|facebookexternalhit|whatsapp|telegram/i', $ua);
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

/** Strips control characters, trims and caps the length. */
function rp_clean($v, int $max): string
{
    $v = is_string($v) ? $v : '';
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return mb_substr(trim($v), 0, $max);
}

function rp_uid(): string
{
    return bin2hex(random_bytes(8));
}

/** Lets the visitor's request finish before slow work (geolocation, notifications) runs. */
function rp_finish_response(): void
{
    if (function_exists('litespeed_finish_request')) litespeed_finish_request();
    elseif (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
}

/** Sends the JSON response now and keeps running (the visitor doesn't wait for geolocation/notifications). */
function rp_json_then_continue(array $body, int $status = 200): void
{
    ignore_user_abort(true);
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    rp_finish_response();
}
/* ───────────── Site settings (editable from the admin panel) ───────────── */

const RP_DEFAULT_MUSIC = '/audio/background.mp3';

function rp_settings(): array
{
    return rp_settings_from(rp_read_json(rp_data_dir() . '/settings.json'));
}

/** Stored settings (possibly partial) merged with the defaults. Pure: safe to call while the file is locked. */
function rp_settings_from(array $s): array
{
    $music = (array) ($s['music'] ?? []);
    return [
        'cvEnabled' => (bool) ($s['cvEnabled'] ?? true),
        'preloader' => (bool) ($s['preloader'] ?? true), // intro/boot screen shown while the site loads
        'autoScroll' => (bool) ($s['autoScroll'] ?? true), // "auto tour" button (page scrolls by itself at reading pace)
        'music' => [
            'enabled' => (bool) ($music['enabled'] ?? true),
            'autoplay' => (bool) ($music['autoplay'] ?? true),                       // starts by itself when the page opens
            'volume' => max(0, min(100, (int) ($music['volume'] ?? 80))),           // starting volume, %
            'mode' => in_array($music['mode'] ?? '', ['default', 'url', 'file'], true) ? $music['mode'] : 'default',
            'url' => (string) ($music['url'] ?? ''),
            'file' => (string) ($music['file'] ?? ''),
            'name' => (string) ($music['name'] ?? ''),
            'updatedAt' => (string) ($music['updatedAt'] ?? ''),
        ],
        'video' => [
            // background video of the Manifesto section (off until turned on from the admin panel)
            'enabled' => (bool) ($s['video']['enabled'] ?? false),
            'youtube' => preg_match('/^[A-Za-z0-9_-]{11}$/', (string) ($s['video']['youtube'] ?? '')) ? $s['video']['youtube'] : '',
            'src' => (string) ($s['video']['src'] ?? ''),
            'opacity' => max(5, min(100, (int) ($s['video']['opacity'] ?? 30))),
        ],
        'telegram' => [
            'enabled' => (bool) ($s['telegram']['enabled'] ?? true),
            'token' => (string) ($s['telegram']['token'] ?? ''),   // '' = use config.php
            'chatId' => (string) ($s['telegram']['chatId'] ?? ''), // '' = use config.php
        ],
    ];
}

/** Telegram values in use: the ones saved from the admin panel, else the ones in config.php. */
function rp_telegram(): array
{
    global $CONFIG;
    $t = rp_settings()['telegram'];
    return [
        'enabled' => $t['enabled'],
        'token' => $t['token'] !== '' ? $t['token'] : (string) ($CONFIG['telegram_bot_token'] ?? ''),
        'chatId' => $t['chatId'] !== '' ? $t['chatId'] : (string) ($CONFIG['telegram_chat_id'] ?? ''),
        'source' => $t['token'] !== '' || $t['chatId'] !== '' ? 'panel' : 'config',
    ];
}

/** Sends a plain-text Telegram message (no parse_mode, so user input can't inject formatting). Returns the HTTP status (0 = network error). */
function rp_telegram_send(string $token, string $chatId, string $text): int
{
    if ($token === '' || $chatId === '') return 0;
    $url = 'https://api.telegram.org/bot' . $token . '/sendMessage';
    $payload = http_build_query(['chat_id' => $chatId, 'text' => $text, 'disable_web_page_preview' => 'true']);
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload, CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 10]);
        curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return $code;
    }
    $ctx = stream_context_create(['http' => ['method' => 'POST', 'header' => 'Content-Type: application/x-www-form-urlencoded', 'content' => $payload, 'timeout' => 10, 'ignore_errors' => true]]);
    $res = @file_get_contents($url, false, $ctx);
    return $res !== false && (json_decode($res, true)['ok'] ?? false) ? 200 : 0;
}

/** URL the public site should play (null when the music is turned off). */
function rp_music_src(array $settings): ?string
{
    $m = $settings['music'];
    if (!$m['enabled']) return null;
    if ($m['mode'] === 'url' && $m['url'] !== '') return $m['url'];
    if ($m['mode'] === 'file' && $m['file'] !== '' && is_file(rp_data_dir() . '/media/' . $m['file'])) return '/api/media.php?f=' . rawurlencode($m['file']);
    return RP_DEFAULT_MUSIC;
}

/* ───────────── Visitor details: location + device ───────────── */

/** Country / region / city / ISP of an IP, cached in geo.json (looked up once per IP). */
function rp_geo(string $ip): array
{
    if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
        return ['country' => 'Red local', 'cc' => '', 'region' => '', 'city' => '', 'isp' => ''];
    }
    $file = rp_data_dir() . '/geo.json';
    $cache = rp_read_json($file);
    if (isset($cache[$ip])) return $cache[$ip];

    $geo = null;
    $ctx = stream_context_create(['http' => ['timeout' => 4, 'ignore_errors' => true], 'ssl' => ['verify_peer' => true]]);
    $r = json_decode((string) @file_get_contents('http://ip-api.com/json/' . rawurlencode($ip) . '?fields=status,country,countryCode,regionName,city,isp&lang=es', false, $ctx), true);
    if (($r['status'] ?? '') === 'success') {
        $geo = ['country' => $r['country'], 'cc' => $r['countryCode'], 'region' => $r['regionName'], 'city' => $r['city'], 'isp' => $r['isp']];
    } else {
        $r = json_decode((string) @file_get_contents('https://ipwho.is/' . rawurlencode($ip) . '?fields=success,country,country_code,region,city,connection&lang=es', false, $ctx), true);
        if (!empty($r['success'])) {
            $geo = ['country' => $r['country'], 'cc' => $r['country_code'], 'region' => $r['region'], 'city' => $r['city'], 'isp' => $r['connection']['isp'] ?? ''];
        }
    }
    if (!$geo) return ['country' => '', 'cc' => '', 'region' => '', 'city' => '', 'isp' => ''];

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
    foreach (['Edge' => '/edg\//i', 'Opera' => '/opr\//i', 'Samsung' => '/samsungbrowser/i', 'Chrome' => '/chrome|crios/i', 'Firefox' => '/firefox|fxios/i', 'Safari' => '/safari/i'] as $name => $re) {
        if (preg_match($re, $ua)) { $browser = $name; break; }
    }
    $kind = preg_match('/ipad|tablet/i', $ua) ? 'tablet' : (preg_match('/mobi|iphone|android/i', $ua) ? 'mobile' : 'desktop');
    return ['label' => "$browser · $os", 'kind' => $kind];
}

/* ───────────── Admin session ───────────── */

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
    session_name('rpadmin');
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
    if (session_status() !== PHP_SESSION_ACTIVE && empty($_COOKIE['rpadmin'])) {
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
    if (!rp_is_admin()) {
        rp_json(401, ['ok' => false, 'error' => 'unauthorized']);
    }
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($sent) || !hash_equals((string) ($_SESSION['csrf'] ?? ''), $sent)) {
        rp_json(403, ['ok' => false, 'error' => 'csrf']);
    }
}

/** Admin-only reads (GET): a valid session is enough, no CSRF token needed. */
function rp_require_admin_read(): void
{
    if (!rp_is_admin()) {
        rp_json(401, ['ok' => false, 'error' => 'unauthorized']);
    }
    header('Cache-Control: private, no-store');
}
