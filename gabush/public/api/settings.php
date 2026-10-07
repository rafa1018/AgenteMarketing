<?php
// GET  /api/settings.php                                   → { schedule, site }   (public)
// POST /api/settings.php {action:"schedule", schedule}      → { schedule }   (ajustes | calendario)
//
// Website options (permission "ajustes"):
// POST {action:"preloader", enabled}        → show / skip the intro (letters + lion) when the site opens
// POST {action:"musicEnabled", enabled}     → background music on / off (the music button disappears when off)
// POST {action:"musicAutoplay", autoplay}   → start playing by itself or wait for the visitor
// POST {action:"musicVolume", volume}       → starting volume 0–100
// POST {action:"musicUrl", url}             → play an audio file from an https URL
// POST {action:"musicRemove"}               → forget the uploaded song / URL (the file is moved to media/old, not deleted)
// POST multipart: action=musicUpload, file=<.mp3>  → upload a song (max 20 MB), stored in <data>/media
//
// schedule = { days: [ {open: bool, slots: [{from:"08:00", to:"11:00"}, …]} × 7 ] }, index 0 = Monday.
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

const MAX_SLOTS = 3;
const MAX_MUSIC_BYTES = 20 * 1024 * 1024;

function default_schedule(): array
{
    $weekday = ['open' => true, 'slots' => [['from' => '08:00', 'to' => '11:00'], ['from' => '14:00', 'to' => '17:00']]];
    $closed = ['open' => false, 'slots' => []];
    return ['days' => [$weekday, $weekday, $weekday, $weekday, $weekday, $closed, $closed]];
}

/** Website options with defaults filled in. */
function site_settings(array $data): array
{
    $s = (array) ($data['site'] ?? []);
    $m = (array) ($s['music'] ?? []);
    return [
        'preloader' => ($s['preloader'] ?? true) !== false,
        'music' => [
            'enabled' => !empty($m['enabled']),
            'mode' => in_array($m['mode'] ?? '', ['file', 'url'], true) ? $m['mode'] : 'none',
            'file' => (string) ($m['file'] ?? ''),
            'name' => (string) ($m['name'] ?? ''),
            'url' => (string) ($m['url'] ?? ''),
            'autoplay' => ($m['autoplay'] ?? true) !== false,
            'volume' => max(0, min(100, (int) ($m['volume'] ?? 60))),
            'updatedAt' => $m['updatedAt'] ?? null,
        ],
    ];
}

/** Public URL of the song that plays, or null when there is none / the music is off. */
function music_src(array $site): ?string
{
    $m = $site['music'];
    if (!$m['enabled']) return null;
    if ($m['mode'] === 'file' && $m['file'] !== '' && is_file(rp_data_dir() . '/media/' . $m['file'])) return '/api/media.php?f=' . rawurlencode($m['file']);
    if ($m['mode'] === 'url' && $m['url'] !== '') return $m['url'];
    return null;
}

function site_payload(array $data): array
{
    $site = site_settings($data);
    $site['music']['src'] = music_src($site);
    return $site;
}

$file = rp_data_dir() . '/settings.json';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $data = rp_read_json($file);
    rp_json(200, ['ok' => true, 'schedule' => $data['schedule'] ?? default_schedule(), 'site' => site_payload($data)]);
}
if ($method !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}

/** Read-modify-write of the website options; returns the new public payload. */
function save_site(string $file, callable $fn): array
{
    return rp_with_json($file, function (array $data) use ($fn) {
        $site = site_settings($data);
        $site = $fn($site);
        $site['music']['updatedAt'] = date('c');
        unset($site['music']['src']);
        $data['site'] = $site;
        return [$data, site_payload($data)];
    });
}

/* ── song upload (multipart) ── */
if (($_POST['action'] ?? '') === 'musicUpload') {
    rp_require_perm('ajustes');
    $f = $_FILES['file'] ?? null;
    if (!$f || ($f['error'] ?? 1) === UPLOAD_ERR_INI_SIZE || ($f['size'] ?? 0) > MAX_MUSIC_BYTES) rp_json(422, ['ok' => false, 'error' => 'too_big']);
    if ($f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) rp_json(422, ['ok' => false, 'error' => 'upload']);
    $type = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    $head = (string) file_get_contents($f['tmp_name'], false, null, 0, 3);
    $isMp3 = in_array($type, ['audio/mpeg', 'audio/mp3', 'audio/x-mpeg', 'application/octet-stream'], true)
        && ($head === 'ID3' || (strlen($head) >= 2 && ord($head[0]) === 0xFF && (ord($head[1]) & 0xE0) === 0xE0));
    if (!$isMp3) rp_json(422, ['ok' => false, 'error' => 'not_mp3']);
    $dir = rp_data_dir() . '/media';
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    $name = 'music-' . date('Ymd-His') . '-' . bin2hex(random_bytes(3)) . '.mp3';
    if (!move_uploaded_file($f['tmp_name'], "$dir/$name")) rp_json(500, ['ok' => false, 'error' => 'upload']);
    $original = mb_substr(preg_replace('/\.mp3$/i', '', rp_clean(basename((string) ($f['name'] ?? '')), 120)), 0, 80);
    $site = save_site($file, function (array $s) use ($name, $original) {
        $s['music'] = array_merge($s['music'], ['enabled' => true, 'mode' => 'file', 'file' => $name, 'name' => $original, 'url' => '']);
        return $s;
    });
    rp_json(200, ['ok' => true, 'site' => $site]);
}

$in = rp_body(8000);
$action = $in['action'] ?? '';

if ($action !== 'schedule') {
    rp_require_perm('ajustes');
    $site = null;
    switch ($action) {
        case 'preloader':
            $on = !empty($in['enabled']);
            $site = save_site($file, function ($s) use ($on) { $s['preloader'] = $on; return $s; });
            break;
        case 'musicEnabled':
            $on = !empty($in['enabled']);
            $site = save_site($file, function ($s) use ($on) { $s['music']['enabled'] = $on; return $s; });
            break;
        case 'musicAutoplay':
            $on = !empty($in['autoplay']);
            $site = save_site($file, function ($s) use ($on) { $s['music']['autoplay'] = $on; return $s; });
            break;
        case 'musicVolume':
            $v = max(0, min(100, (int) ($in['volume'] ?? 60)));
            $site = save_site($file, function ($s) use ($v) { $s['music']['volume'] = $v; return $s; });
            break;
        case 'musicUrl':
            $url = rp_clean($in['url'] ?? '', 500);
            if (!preg_match('#^https://[^\s"\'<>]+$#i', $url)) rp_json(422, ['ok' => false, 'error' => 'url']);
            $site = save_site($file, function ($s) use ($url) {
                $s['music'] = array_merge($s['music'], ['enabled' => true, 'mode' => 'url', 'url' => $url, 'file' => '', 'name' => '']);
                return $s;
            });
            break;
        case 'musicRemove':
            // never delete the song outright: keep it in media/old so it can be recovered
            $site = save_site($file, function ($s) {
                $f = $s['music']['file'];
                $dir = rp_data_dir() . '/media';
                if ($f !== '' && is_file("$dir/$f")) {
                    @mkdir("$dir/old", 0750, true);
                    @rename("$dir/$f", "$dir/old/$f");
                }
                $s['music'] = array_merge($s['music'], ['enabled' => false, 'mode' => 'none', 'file' => '', 'name' => '', 'url' => '']);
                return $s;
            });
            break;
        default:
            rp_json(400, ['ok' => false, 'error' => 'validation']);
    }
    rp_json(200, ['ok' => true, 'site' => $site]);
}

/* ── opening hours ── */
rp_require_perm('ajustes', 'calendario');
if (!is_array($in['schedule']['days'] ?? null) || count($in['schedule']['days']) !== 7) {
    rp_json(400, ['ok' => false, 'error' => 'validation']);
}

$days = [];
$bad = [];
foreach (array_values($in['schedule']['days']) as $i => $d) {
    $open = !empty($d['open']);
    $slots = [];
    foreach (array_slice((array) ($d['slots'] ?? []), 0, MAX_SLOTS) as $s) {
        $from = rp_clean($s['from'] ?? '', 5);
        $to = rp_clean($s['to'] ?? '', 5);
        if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $from) || !preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $to) || $from >= $to) {
            $bad[] = $i;
            continue;
        }
        $slots[] = ['from' => $from, 'to' => $to];
    }
    usort($slots, fn($a, $b) => strcmp($a['from'], $b['from']));
    if ($open && !$slots) $bad[] = $i;
    $days[] = ['open' => $open, 'slots' => $open ? $slots : []];
}
if ($bad) {
    rp_json(422, ['ok' => false, 'error' => 'validation', 'days' => array_values(array_unique($bad))]);
}

$schedule = ['days' => $days];
rp_with_json($file, function (array $data) use ($schedule) {
    $data['schedule'] = $schedule;
    return [$data, null];
});
rp_json(200, ['ok' => true, 'schedule' => $schedule]);
