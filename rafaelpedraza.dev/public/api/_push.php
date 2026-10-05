<?php
// Web Push (no external services, no Composer): VAPID keys, RFC 8291 payload encryption and delivery.
// Included by push.php, contact.php, visits.php and cv.php — never called directly (.htaccess denies it).
defined('RP_API') || exit;

const PUSH_TYPES = ['mensajes', 'descargas', 'visitas'];

function b64u_enc(string $s): string
{
    return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
}
function b64u_dec(string $s): string
{
    return (string) base64_decode(strtr($s, '-_', '+/') . str_repeat('=', (4 - strlen($s) % 4) % 4));
}

/** openssl.cnf location when the PHP build needs it explicitly (XAMPP on Windows); Linux hosts return []. */
function push_openssl_args(): array
{
    foreach ([getenv('OPENSSL_CONF') ?: '', dirname(PHP_BINARY) . '/extras/ssl/openssl.cnf'] as $cnf) {
        if ($cnf && is_file($cnf)) return ['config' => $cnf];
    }
    return [];
}

function push_ec_key()
{
    $opts = ['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC];
    $key = @openssl_pkey_new($opts) ?: @openssl_pkey_new($opts + push_openssl_args());
    if (!$key) throw new RuntimeException('EC key generation failed');
    return $key;
}

/** Uncompressed P-256 public key (65 bytes) of an OpenSSL key. */
function push_raw_public($key): string
{
    $ec = openssl_pkey_get_details($key)['ec'];
    return "\x04" . str_pad($ec['x'], 32, "\0", STR_PAD_LEFT) . str_pad($ec['y'], 32, "\0", STR_PAD_LEFT);
}

/** Raw 65-byte P-256 public key → OpenSSL public key (SubjectPublicKeyInfo DER wrapper). */
function push_public_from_raw(string $raw)
{
    $der = hex2bin('3059301306072a8648ce3d020106082a8648ce3d030107034200') . $raw;
    $pem = "-----BEGIN PUBLIC KEY-----\n" . chunk_split(base64_encode($der), 64, "\n") . "-----END PUBLIC KEY-----\n";
    return openssl_pkey_get_public($pem);
}

/** Server VAPID key pair, created on first use and kept in the data folder (private). */
function push_vapid(): array
{
    $file = rp_data_dir() . '/vapid.json';
    $v = rp_read_json($file);
    if (!empty($v['private']) && !empty($v['public'])) return $v;
    $key = push_ec_key();
    openssl_pkey_export($key, $pem, null, push_openssl_args()) || openssl_pkey_export($key, $pem);
    $v = ['private' => $pem, 'public' => b64u_enc(push_raw_public($key))];
    file_put_contents($file, json_encode($v), LOCK_EX);
    @chmod($file, 0600);
    return $v;
}

/** DER ECDSA signature → raw r||s (64 bytes), as JWT ES256 requires. */
function push_der_to_raw(string $der): string
{
    $pos = 2;
    if (ord($der[1]) & 0x80) $pos += ord($der[1]) & 0x7f;
    $out = '';
    for ($i = 0; $i < 2; $i++) {
        $len = ord($der[$pos + 1]);
        $int = substr($der, $pos + 2, $len);
        $out .= str_pad(ltrim($int, "\0"), 32, "\0", STR_PAD_LEFT);
        $pos += 2 + $len;
    }
    return $out;
}

/** "vapid t=<JWT>, k=<public key>" for the push service of an endpoint. */
function push_vapid_header(string $endpoint, array $vapid, string $subject): string
{
    $u = parse_url($endpoint);
    $aud = $u['scheme'] . '://' . $u['host'] . (isset($u['port']) ? ':' . $u['port'] : '');
    $data = b64u_enc(json_encode(['typ' => 'JWT', 'alg' => 'ES256'])) . '.' . b64u_enc(json_encode(['aud' => $aud, 'exp' => time() + 43200, 'sub' => $subject]));
    openssl_sign($data, $sig, $vapid['private'], OPENSSL_ALGO_SHA256);
    return 'vapid t=' . $data . '.' . b64u_enc(push_der_to_raw($sig)) . ', k=' . $vapid['public'];
}

/**
 * RFC 8291 / RFC 8188 (aes128gcm) encryption of a payload for one subscription.
 * $ephemeral and $salt are only injected by tests.
 */
function push_encrypt(string $payload, string $p256dh, string $auth, $ephemeral = null, ?string $salt = null): string
{
    $uaPublic = b64u_dec($p256dh);
    $authSecret = b64u_dec($auth);
    $ephemeral = $ephemeral ?: push_ec_key();
    $asPublic = push_raw_public($ephemeral);
    $salt = $salt ?? random_bytes(16);

    $ecdh = openssl_pkey_derive(push_public_from_raw($uaPublic), $ephemeral, 32);
    $prkKey = hash_hmac('sha256', $ecdh, $authSecret, true);
    $ikm = hash_hmac('sha256', "WebPush: info\0" . $uaPublic . $asPublic . "\x01", $prkKey, true);
    $prk = hash_hmac('sha256', $ikm, $salt, true);
    $cek = substr(hash_hmac('sha256', "Content-Encoding: aes128gcm\0\x01", $prk, true), 0, 16);
    $nonce = substr(hash_hmac('sha256', "Content-Encoding: nonce\0\x01", $prk, true), 0, 12);

    $cipher = openssl_encrypt($payload . "\x02", 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
    return $salt . pack('N', 4096) . chr(strlen($asPublic)) . $asPublic . $cipher . $tag;
}

/** Sends one notification; returns the HTTP status (0 = network error). */
function push_send_one(array $sub, array $message, array $vapid, string $subject): int
{
    $body = push_encrypt(json_encode($message, JSON_UNESCAPED_UNICODE), $sub['keys']['p256dh'], $sub['keys']['auth']);
    $ch = curl_init($sub['endpoint']);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 4,
        CURLOPT_TIMEOUT => 8,
        CURLOPT_HTTPHEADER => [
            'Content-Type: application/octet-stream',
            'Content-Encoding: aes128gcm',
            'TTL: 86400',
            'Urgency: high',
            'Authorization: ' . push_vapid_header($sub['endpoint'], $vapid, $subject),
        ],
    ]);
    curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $code;
}

/**
 * Notifies every subscribed device that wants this type. Expired subscriptions (404/410) are removed.
 * $message: {title, body, url, tag}
 */
function push_notify(string $type, array $message): int
{
    global $CONFIG;
    if (!function_exists('curl_init')) return 0;
    $file = rp_data_dir() . '/push.json';
    $subs = rp_read_json($file)['subs'] ?? [];
    $targets = array_filter($subs, fn($s) => ($s['prefs'][$type] ?? true) !== false);
    if (!$targets) return 0;
    $vapid = push_vapid();
    $subject = 'mailto:' . ($CONFIG['push_contact'] ?? 'admin@rafaelpedraza.dev');
    $gone = [];
    $sent = 0;
    foreach ($targets as $s) {
        try {
            $code = push_send_one($s, $message + ['type' => $type], $vapid, $subject);
        } catch (Throwable $e) {
            $code = 0;
        }
        if ($code === 404 || $code === 410) $gone[] = $s['endpoint'];
        elseif ($code >= 200 && $code < 300) $sent++;
    }
    if ($gone) {
        rp_with_json($file, function (array $data) use ($gone) {
            $data['subs'] = array_values(array_filter($data['subs'] ?? [], fn($s) => !in_array($s['endpoint'], $gone, true)));
            return [$data, null];
        });
    }
    return $sent;
}

/** Lets the visitor's request finish before slow work (notifications) runs. */
function push_finish_response(): void
{
    if (function_exists('litespeed_finish_request')) litespeed_finish_request();
    elseif (function_exists('fastcgi_finish_request')) fastcgi_finish_request();
}
