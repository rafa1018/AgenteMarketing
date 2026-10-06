<?php
// Shared helpers for the site API: public site settings + the private admin panel (/admin/).
define('MM_API', true);
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
 * Where the data lives.
 * - Local PHP dev server: <project>/.api-data
 * - Production: a folder NEXT TO public_html ("mm-data"): publishing never touches it and it is
 *   unreachable from the web. Fallback: api/data (protected by .htaccess).
 */
function mm_data_dir(): string
{
    static $dir = null;
    if ($dir !== null) return $dir;
    global $CONFIG;
    if (!empty($CONFIG['data_dir'])) {
        $dir = $CONFIG['data_dir'];
    } elseif (PHP_SAPI === 'cli-server') {
        $dir = dirname(__DIR__, 2) . '/.api-data';
    } else {
        $outside = dirname(__DIR__, 2) . '/mm-data';
        $dir = ((is_dir($outside) || @mkdir($outside, 0750, true)) && is_writable($outside)) ? $outside : __DIR__ . '/data';
    }
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    return $dir;
}

function mm_json(int $status, array $body): void
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE);
    exit;
}

/** Rejects browser calls from foreign origins. Same-origin requests may omit Origin. */
function mm_check_origin(array $config): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin === '') return;
    if (!in_array($origin, $config['allowed_origins'], true)) mm_json(403, ['ok' => false, 'error' => 'forbidden']);
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}

function mm_client_hash(array $config): string
{
    $ip = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
    return substr(hash('sha256', $config['salt'] . '|' . $ip), 0, 24);
}

/** Atomic read-modify-write of a JSON file. $fn receives the data and returns [newData, result]. */
function mm_with_json(string $file, callable $fn)
{
    $fp = fopen($file, 'c+');
    if (!$fp) mm_json(500, ['ok' => false, 'error' => 'storage']);
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

function mm_read_json(string $file): array
{
    return is_file($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : [];
}

function mm_body(int $max = 8000): array
{
    $in = json_decode(file_get_contents('php://input', false, null, 0, $max) ?: '', true);
    if (!is_array($in)) mm_json(400, ['ok' => false, 'error' => 'validation']);
    return $in;
}

/* ───────────── site settings ───────────── */

const MM_THEMES = ['blue', 'gold'];

/** Stored settings merged with the defaults. Pure: safe to call on data read under a lock. */
function mm_settings_from(array $s): array
{
    return ['theme' => in_array($s['theme'] ?? '', MM_THEMES, true) ? $s['theme'] : 'blue'];
}

function mm_settings(): array
{
    return mm_settings_from(mm_read_json(mm_data_dir() . '/settings.json'));
}

/* ───────────── admin session ───────────── */

const MM_ADMIN_IDLE = 28800; // 8 h of inactivity logs the admin out

/** Password hash in use: one changed from the panel (data folder) wins over config.php. */
function mm_password_hash(): string
{
    global $CONFIG;
    $saved = (string) (mm_read_json(mm_data_dir() . '/auth.json')['password_hash'] ?? '');
    return $saved !== '' ? $saved : (string) ($CONFIG['admin_password_hash'] ?? '');
}

/** True while the admin still uses the initial "admin" password. */
function mm_default_password(): bool
{
    return password_verify('admin', mm_password_hash());
}

function mm_is_https(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function mm_session_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) return;
    session_name('mmadmin');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/api', 'secure' => mm_is_https(), 'httponly' => true, 'samesite' => 'Strict']);
    ini_set('session.use_strict_mode', '1');
    session_start();
}

function mm_is_admin(): bool
{
    if (session_status() !== PHP_SESSION_ACTIVE && empty($_COOKIE['mmadmin'])) return false;
    mm_session_start();
    if (empty($_SESSION['admin'])) return false;
    if (time() - (int) ($_SESSION['seen'] ?? 0) > MM_ADMIN_IDLE) {
        $_SESSION = [];
        session_destroy();
        return false;
    }
    $_SESSION['seen'] = time();
    return true;
}

/** Mutations need an admin session AND the per-session CSRF token in the X-CSRF-Token header. */
function mm_require_admin(): void
{
    if (!mm_is_admin()) mm_json(401, ['ok' => false, 'error' => 'unauthorized']);
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (!is_string($sent) || !hash_equals((string) ($_SESSION['csrf'] ?? ''), $sent)) mm_json(403, ['ok' => false, 'error' => 'csrf']);
}

function mm_require_admin_read(): void
{
    if (!mm_is_admin()) mm_json(401, ['ok' => false, 'error' => 'unauthorized']);
    header('Cache-Control: private, no-store');
}
