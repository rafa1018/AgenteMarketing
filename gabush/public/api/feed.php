<?php
// "Momentos Gabush" — Instagram-style feed managed from the admin panel (NOT connected to Instagram).
// GET  /api/feed.php                         → { items }  public: visible posts, newest first in the admin's order
// GET  /api/feed.php?all=1                   → { items }  admin: also hidden posts
// GET  /api/feed.php?img=<id>&s=1080|480     → the image (public, cached)
// POST /api/feed.php (multipart: photo, thumb, caption, date)   → { item }    admin + X-CSRF-Token
// POST /api/feed.php {action:"update", id, caption, date, hidden} → { item }
// POST /api/feed.php {action:"delete", id}   → { ok }
// POST /api/feed.php {action:"order", ids:[…]} → { items }
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

const MAX_POSTS = 120;
const MAX_FEED_BYTES = 4 * 1024 * 1024;

$file = rp_data_dir() . '/feed.json';
$dir = rp_data_dir() . '/feed';
$method = $_SERVER['REQUEST_METHOD'];

/** The posts the site starts with (static images shipped in /images/feed). */
function feed_seed(): array
{
    $captions = [
        '01' => '¡Te invitamos a celebrar con nosotros el Día de la Independencia! 🇨🇴 Ponte tu camiseta.',
        '02' => 'Gabush, nuestro león, vino a visitar a las profes 🦁💛',
        '03' => 'En familia celebramos Amor y Amistad 💕 #gabushkids',
        '04' => 'Show de magia, disfraces y muchas risas ✨🎩',
        '05' => '¡Fiesta de colores en el jardín! 🎈🎉',
    ];
    $out = [];
    foreach ($captions as $n => $c) {
        $out[] = ['id' => "seed-$n", 'caption' => $c, 'date' => '', 'hidden' => false, 'static' => "/images/feed/$n"];
    }
    return $out;
}

function feed_items(string $file): array
{
    return is_file($file) ? (rp_read_json($file)['items'] ?? []) : feed_seed();
}

/** Adds the image URLs the browser needs. */
function feed_public(array $p): array
{
    if (!empty($p['static'])) {
        $img = $p['static'] . '-1080.webp';
        $thumb = $p['static'] . '-480.webp';
    } else {
        $v = (int) ($p['v'] ?? 1);
        $img = "/api/feed.php?img={$p['id']}&s=1080&v=$v";
        $thumb = "/api/feed.php?img={$p['id']}&s=480&v=$v";
    }
    return ['id' => $p['id'], 'caption' => $p['caption'], 'date' => $p['date'] ?? '', 'hidden' => !empty($p['hidden']), 'img' => $img, 'thumb' => $thumb];
}

/* ── image ── */
if ($method === 'GET' && isset($_GET['img'])) {
    $id = preg_replace('/[^a-f0-9]/', '', (string) $_GET['img']);
    $size = ($_GET['s'] ?? '') === '480' ? '480' : '1080';
    $path = "$dir/$id-$size.jpg";
    if ($id === '' || !is_file($path)) rp_json(404, ['ok' => false, 'error' => 'not_found']);
    header('Content-Type: image/jpeg');
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: public, max-age=2592000'); // the URL carries a version number
    readfile($path);
    exit;
}

/* ── list ── */
if ($method === 'GET') {
    $all = !empty($_GET['all']);
    if ($all) rp_require_perm_read('feed');
    else header('Cache-Control: no-cache'); // new posts show up right away
    $items = feed_items($file);
    if (!$all) $items = array_values(array_filter($items, fn($p) => empty($p['hidden'])));
    rp_json(200, ['ok' => true, 'items' => array_map('feed_public', $items)]);
}
if ($method !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}
rp_require_perm('feed');

/** Validates an uploaded JPEG/PNG/WebP and stores it as <dir>/<id>-<size>.jpg (the browser already sends JPEG). */
function feed_store(array $f, string $dest): bool
{
    if (($f['error'] ?? 1) !== UPLOAD_ERR_OK || $f['size'] > MAX_FEED_BYTES || !is_uploaded_file($f['tmp_name'])) return false;
    $type = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    if (!in_array($type, ['image/jpeg', 'image/png', 'image/webp'], true) || !@getimagesize($f['tmp_name'])) return false;
    return move_uploaded_file($f['tmp_name'], $dest);
}

/* ── new post (multipart) ── */
if (isset($_FILES['photo'])) {
    $caption = rp_clean($_POST['caption'] ?? '', 600);
    $date = rp_clean($_POST['date'] ?? '', 10);
    if ($date !== '' && !rp_valid_date($date)) $date = '';
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    $id = rp_uid();
    if (!feed_store($_FILES['photo'], "$dir/$id-1080.jpg")) rp_json(422, ['ok' => false, 'error' => 'photo']);
    if (!isset($_FILES['thumb']) || !feed_store($_FILES['thumb'], "$dir/$id-480.jpg")) @copy("$dir/$id-1080.jpg", "$dir/$id-480.jpg");
    $item = ['id' => $id, 'caption' => $caption, 'date' => $date, 'hidden' => false, 'v' => 1, 'createdAt' => date('c')];
    $ok = rp_with_json($file, function (array $data) use ($item, $file) {
        $items = array_key_exists('items', $data) ? $data['items'] : feed_seed();
        if (count($items) >= MAX_POSTS) return [$data, false];
        array_unshift($items, $item); // newest first
        $data['items'] = $items;
        return [$data, true];
    });
    if (!$ok) {
        @unlink("$dir/$id-1080.jpg");
        @unlink("$dir/$id-480.jpg");
        rp_json(422, ['ok' => false, 'error' => 'full']);
    }
    rp_json(200, ['ok' => true, 'item' => feed_public($item)]);
}

$in = rp_body(20000);
$action = $in['action'] ?? '';

if ($action === 'update') {
    $id = rp_clean($in['id'] ?? '', 40);
    $caption = rp_clean($in['caption'] ?? '', 600);
    $date = rp_clean($in['date'] ?? '', 10);
    if ($date !== '' && !rp_valid_date($date)) rp_json(422, ['ok' => false, 'error' => 'validation', 'fields' => ['date']]);
    $saved = rp_with_json($file, function (array $data) use ($id, $caption, $date, $in) {
        $items = array_key_exists('items', $data) ? $data['items'] : feed_seed();
        foreach ($items as &$p) {
            if ($p['id'] !== $id) continue;
            $p['caption'] = $caption;
            $p['date'] = $date;
            $p['hidden'] = !empty($in['hidden']);
            $data['items'] = $items;
            return [$data, $p];
        }
        return [$data, null];
    });
    if (!$saved) rp_json(404, ['ok' => false, 'error' => 'not_found']);
    rp_json(200, ['ok' => true, 'item' => feed_public($saved)]);
}

if ($action === 'delete') {
    $id = rp_clean($in['id'] ?? '', 40);
    rp_with_json($file, function (array $data) use ($id) {
        $items = array_key_exists('items', $data) ? $data['items'] : feed_seed();
        $data['items'] = array_values(array_filter($items, fn($p) => $p['id'] !== $id));
        return [$data, null];
    });
    $safe = preg_replace('/[^a-f0-9]/', '', $id);
    if ($safe !== '') foreach (glob("$dir/$safe-*.jpg") ?: [] as $f) @unlink($f);
    rp_json(200, ['ok' => true]);
}

if ($action === 'order') {
    $ids = array_values(array_filter((array) ($in['ids'] ?? []), 'is_string'));
    $items = rp_with_json($file, function (array $data) use ($ids) {
        $items = array_key_exists('items', $data) ? $data['items'] : feed_seed();
        $pos = array_flip($ids);
        usort($items, fn($a, $b) => ($pos[$a['id']] ?? PHP_INT_MAX) <=> ($pos[$b['id']] ?? PHP_INT_MAX));
        $data['items'] = $items;
        return [$data, $items];
    });
    rp_json(200, ['ok' => true, 'items' => array_map('feed_public', $items)]);
}

rp_json(400, ['ok' => false, 'error' => 'validation']);
