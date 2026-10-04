<?php
// Shared helpers for the tiny API (contact form + visit counter).
define('RP_API', true);

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

/** Data lives outside public/ when running the local PHP dev server, so it is never deployed by accident. */
function rp_data_dir(): string
{
    $dir = PHP_SAPI === 'cli-server' ? dirname(__DIR__, 2) . '/.api-data' : __DIR__ . '/data';
    if (!is_dir($dir)) {
        @mkdir($dir, 0750, true);
    }
    return $dir;
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
