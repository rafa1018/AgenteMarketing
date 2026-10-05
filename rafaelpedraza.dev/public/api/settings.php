<?php
// Admin only — site settings.
// GET  /api/settings.php                                → { settings, musicSrc }
// POST /api/settings.php {action:"cv", enabled}           → show / hide every "Descargar CV" button
// POST /api/settings.php {action:"musicEnabled", enabled} → turn the background music on / off
// POST /api/settings.php {action:"musicAutoplay", autoplay} → start playing by itself or wait for the visitor
// POST /api/settings.php {action:"musicVolume", volume}   → starting volume 0–100
// POST /api/settings.php {action:"musicUrl", url}         → play an mp3 from a URL
// POST /api/settings.php {action:"musicDefault"}          → back to the original track
// POST /api/settings.php {action:"telegramEnabled", enabled} / {action:"telegramSave", token?, chatId}
// POST /api/settings.php {action:"telegramReset"} / {action:"telegramTest"}
// POST /api/settings.php  multipart: action=musicUpload, file=<.mp3>  (X-CSRF-Token header)
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

const MUSIC_MAX_BYTES = 30 * 1024 * 1024; // 30 MB

$file = rp_data_dir() . '/settings.json';
$mediaDir = rp_data_dir() . '/media';

function settings_out(): array
{
    $s = rp_settings();
    // the bot token never leaves the server: the panel only sees its last 4 characters
    $tg = rp_telegram();
    $s['telegram'] = [
        'enabled' => $tg['enabled'],
        'chatId' => $tg['chatId'],
        'tokenHint' => $tg['token'] !== '' ? '••••' . substr($tg['token'], -4) : '',
        'source' => $tg['source'],
    ];
    return ['ok' => true, 'settings' => $s, 'musicSrc' => rp_music_src(rp_settings())];
}

/** Applies $fn to the stored settings (merged with defaults). */
function settings_save(string $file, callable $fn): void
{
    // the file is locked here: work only on $data (re-reading it fails on Windows)
    rp_with_json($file, fn(array $data) => [$fn(rp_settings_from($data)), null]);
}

/** Removes uploaded tracks that are no longer in use. */
function settings_cleanup_media(string $mediaDir, string $keep): void
{
    foreach (glob("$mediaDir/*.mp3") ?: [] as $f) if (basename($f) !== $keep) @unlink($f);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    rp_require_admin_read();
    rp_json(200, settings_out());
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}
rp_require_admin();

// ── mp3 upload (multipart/form-data) ──
if (($_POST['action'] ?? '') === 'musicUpload') {
    $up = $_FILES['file'] ?? null;
    if (!$up || ($up['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        $tooBig = in_array($up['error'] ?? 0, [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true);
        rp_json(422, ['ok' => false, 'error' => $tooBig ? 'too_big' : 'upload']);
    }
    if ($up['size'] > MUSIC_MAX_BYTES) rp_json(422, ['ok' => false, 'error' => 'too_big']);
    $mime = function_exists('finfo_open') ? (string) finfo_file(finfo_open(FILEINFO_MIME_TYPE), $up['tmp_name']) : 'audio/mpeg';
    $head = (string) file_get_contents($up['tmp_name'], false, null, 0, 3);
    $looksMp3 = $head === 'ID3' || (strlen($head) >= 2 && ord($head[0]) === 0xFF && (ord($head[1]) & 0xE0) === 0xE0);
    if (!preg_match('#^audio/(mpeg|mp3|x-mpeg)#', $mime) && !$looksMp3) rp_json(422, ['ok' => false, 'error' => 'not_mp3']);

    if (!is_dir($mediaDir)) @mkdir($mediaDir, 0750, true);
    $name = 'music-' . date('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.mp3';
    if (!move_uploaded_file($up['tmp_name'], "$mediaDir/$name")) rp_json(500, ['ok' => false, 'error' => 'storage']);
    $original = rp_clean(pathinfo((string) $up['name'], PATHINFO_FILENAME), 120);
    settings_save($file, function (array $s) use ($name, $original) {
        $s['music'] = array_merge($s['music'], ['enabled' => true, 'mode' => 'file', 'file' => $name, 'name' => $original, 'updatedAt' => date('c')]);
        return $s;
    });
    settings_cleanup_media($mediaDir, $name);
    rp_json(200, settings_out());
}

$in = rp_body(4000);
$action = $in['action'] ?? '';

if ($action === 'cv') {
    $on = (bool) ($in['enabled'] ?? true);
    settings_save($file, function (array $s) use ($on) {
        $s['cvEnabled'] = $on;
        return $s;
    });
    rp_json(200, settings_out());
}

if ($action === 'telegramEnabled') {
    $on = (bool) ($in['enabled'] ?? true);
    settings_save($file, function (array $s) use ($on) {
        $s['telegram']['enabled'] = $on;
        return $s;
    });
    rp_json(200, settings_out());
}

if ($action === 'telegramSave') {
    $token = trim((string) ($in['token'] ?? ''));   // '' = keep the current one
    $chatId = trim((string) ($in['chatId'] ?? ''));
    if ($token !== '' && !preg_match('/^\d{5,15}:[A-Za-z0-9_-]{30,60}$/', $token)) rp_json(422, ['ok' => false, 'error' => 'token']);
    if (!preg_match('/^(-?\d{3,20}|@[A-Za-z0-9_]{4,40})$/', $chatId)) rp_json(422, ['ok' => false, 'error' => 'chat']);
    settings_save($file, function (array $s) use ($token, $chatId) {
        if ($token !== '') $s['telegram']['token'] = $token;
        $s['telegram']['chatId'] = $chatId;
        $s['telegram']['enabled'] = true;
        return $s;
    });
    rp_json(200, settings_out());
}

if ($action === 'telegramReset') {
    // forget the values saved from the panel → back to the ones in config.php
    settings_save($file, function (array $s) {
        $s['telegram']['token'] = '';
        $s['telegram']['chatId'] = '';
        return $s;
    });
    rp_json(200, settings_out());
}

if ($action === 'telegramTest') {
    $tg = rp_telegram();
    $code = rp_telegram_send($tg['token'], $tg['chatId'], "✅ Prueba desde el panel de rafaelpedraza.dev\nAsí te llegarán los mensajes del formulario.");
    rp_json($code === 200 ? 200 : 502, ['ok' => $code === 200, 'status' => $code]);
}

if ($action === 'musicEnabled') {
    $on = (bool) ($in['enabled'] ?? true);
    settings_save($file, function (array $s) use ($on) {
        $s['music']['enabled'] = $on;
        return $s;
    });
    rp_json(200, settings_out());
}

if ($action === 'musicAutoplay') {
    $on = (bool) ($in['autoplay'] ?? true);
    settings_save($file, function (array $s) use ($on) {
        $s['music']['autoplay'] = $on;
        return $s;
    });
    rp_json(200, settings_out());
}

if ($action === 'musicVolume') {
    $v = filter_var($in['volume'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 100]]);
    if ($v === false) rp_json(422, ['ok' => false, 'error' => 'volume']);
    settings_save($file, function (array $s) use ($v) {
        $s['music']['volume'] = $v;
        return $s;
    });
    rp_json(200, settings_out());
}

if ($action === 'musicUrl') {
    $url = trim((string) ($in['url'] ?? ''));
    if (!preg_match('#^https://[^\s"\'<>]+$#i', $url) || strlen($url) > 1000) rp_json(422, ['ok' => false, 'error' => 'url']);
    settings_save($file, function (array $s) use ($url) {
        $s['music'] = array_merge($s['music'], ['enabled' => true, 'mode' => 'url', 'url' => $url, 'file' => '', 'name' => '', 'updatedAt' => date('c')]);
        return $s;
    });
    settings_cleanup_media($mediaDir, '');
    rp_json(200, settings_out());
}

if ($action === 'musicDefault') {
    settings_save($file, function (array $s) {
        $s['music'] = array_merge($s['music'], ['enabled' => true, 'mode' => 'default', 'url' => '', 'file' => '', 'name' => '', 'updatedAt' => date('c')]);
        return $s;
    });
    settings_cleanup_media($mediaDir, '');
    rp_json(200, settings_out());
}

rp_json(400, ['ok' => false, 'error' => 'validation']);
