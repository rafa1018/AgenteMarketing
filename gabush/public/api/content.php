<?php
// Editable content of the public page: the gallery ("Así se vive Gabush") and the levels & programmes.
// Permission "feed" (Contenido de la página). Starts with the content the site was published with
// (seed/content.json) and, once edited, lives in <data>/content.json + images in <data>/content/.
//
// GET  /api/content.php?c=gallery|programs                → { items }  public: active ones, in order
// GET  /api/content.php?c=…&all=1                          → { items }  staff: also inactive ones
// GET  /api/content.php?img=<id>-<v>&s=1280|640            → image (public, cached)
// POST {action:"save", c, item}                            → { item }   create (no id) or update
// POST {action:"delete", c, id}                            → { ok }     (its images are moved to content/old, not deleted)
// POST {action:"order", c, ids:[…]}                        → { items }
// POST multipart: action=image, c, id, photo, thumb        → { item }   new picture for an item
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

const COLLECTIONS = ['gallery', 'programs'];
const MAX_ITEMS = 60;
const MAX_IMG_BYTES = 5 * 1024 * 1024;
const ICONS = ['Baby', 'Blocks', 'Palette', 'GraduationCap', 'Music2', 'Globe2', 'Sun', 'Heart', 'BookOpen', 'Star', 'Smile', 'Puzzle', 'Drama', 'Bike', 'Apple', 'Sparkles'];
const TONES = ['pink', 'yellow', 'indigo', 'blue', 'green', 'orange'];

$file = rp_data_dir() . '/content.json';
$imgDir = rp_data_dir() . '/content';
$method = $_SERVER['REQUEST_METHOD'];

/** Content the site was published with (shipped next to the API; in local dev, read from src/data). */
function content_seed(): array
{
    static $seed = null;
    if ($seed !== null) return $seed;
    foreach ([__DIR__ . '/seed/content.json', dirname(__DIR__, 2) . '/src/data/content-seed.json'] as $f) {
        if (is_file($f)) return $seed = (json_decode((string) file_get_contents($f), true) ?: []);
    }
    return $seed = [];
}

function content_items(array $data, string $c): array
{
    return array_key_exists($c, $data) ? (array) $data[$c] : (array) (content_seed()[$c] ?? []);
}

/** { es, en } with both strings cleaned; English falls back to '' (the page then shows Spanish). */
function l10n($v, int $max): array
{
    $v = is_array($v) ? $v : [];
    return ['es' => rp_clean($v['es'] ?? '', $max), 'en' => rp_clean($v['en'] ?? '', $max)];
}

/** Validates and normalises an item sent by the panel. Returns [item, badFields]. */
function clean_item(string $c, array $in, array $old): array
{
    $bad = [];
    $item = ['id' => $old['id'] ?? '', 'active' => !empty($in['active']), 'img' => $old['img'] ?? '', 'thumb' => $old['thumb'] ?? ($old['img'] ?? '')];
    if (isset($old['v'])) $item['v'] = $old['v'];
    if ($c === 'gallery') {
        $item['caption'] = l10n($in['caption'] ?? [], 60);
        $item['alt'] = l10n($in['alt'] ?? [], 200);
        if (mb_strlen($item['caption']['es']) < 2) $bad[] = 'caption';
    } else {
        $item['grade'] = !empty($in['grade']);
        $item['icon'] = in_array($in['icon'] ?? '', ICONS, true) ? $in['icon'] : 'Star';
        $item['tone'] = in_array($in['tone'] ?? '', TONES, true) ? $in['tone'] : 'pink';
        $item['title'] = l10n($in['title'] ?? [], 60);
        $item['level'] = l10n($in['level'] ?? [], 40);
        $item['short'] = l10n($in['short'] ?? [], 120);
        $item['detail'] = l10n($in['detail'] ?? [], 900);
        $item['alt'] = l10n($in['alt'] ?? [], 200);
        $item['includes'] = [];
        foreach (array_slice((array) ($in['includes'] ?? []), 0, 12) as $x) {
            $x = l10n($x, 70);
            if ($x['es'] !== '') $item['includes'][] = $x;
        }
        if (mb_strlen($item['title']['es']) < 2) $bad[] = 'title';
        if (mb_strlen($item['short']['es']) < 3) $bad[] = 'short';
    }
    return [$item, $bad];
}

/* ── image ── */
if ($method === 'GET' && isset($_GET['img'])) {
    $name = preg_replace('/[^a-z0-9-]/', '', (string) $_GET['img']);
    $size = ($_GET['s'] ?? '') === '640' ? '640' : '1280';
    $path = "$imgDir/$name-$size.jpg";
    if ($name === '' || !is_file($path)) rp_json(404, ['ok' => false, 'error' => 'not_found']);
    header('Content-Type: image/jpeg');
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: public, max-age=31536000, immutable'); // a new picture gets a new name
    readfile($path);
    exit;
}

$c = (string) ($_GET['c'] ?? $_POST['c'] ?? '');

/* ── list ── */
if ($method === 'GET') {
    if (!in_array($c, COLLECTIONS, true)) rp_json(400, ['ok' => false, 'error' => 'validation']);
    $all = !empty($_GET['all']);
    if ($all) rp_require_perm_read('feed');
    else header('Cache-Control: no-cache');
    $items = content_items(rp_read_json($file), $c);
    // public: only active items (and gallery photos that actually have a picture)
    if (!$all) $items = array_values(array_filter($items, fn($x) => !empty($x['active']) && ($c !== 'gallery' || !empty($x['img']))));
    rp_json(200, ['ok' => true, 'items' => $items]);
}
if ($method !== 'POST') rp_json(405, ['ok' => false, 'error' => 'method']);
rp_require_perm('feed');

/** Validates an uploaded JPEG/PNG/WebP and stores it as $dest (the panel already sends JPEG). */
function store_img(array $f, string $dest): bool
{
    if (($f['error'] ?? 1) !== UPLOAD_ERR_OK || $f['size'] > MAX_IMG_BYTES || !is_uploaded_file($f['tmp_name'])) return false;
    $type = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    if (!in_array($type, ['image/jpeg', 'image/png', 'image/webp'], true) || !@getimagesize($f['tmp_name'])) return false;
    return move_uploaded_file($f['tmp_name'], $dest);
}

/** Moves an item's uploaded pictures to content/old (kept, never deleted). */
function retire_images(array $item, string $imgDir): void
{
    if (!preg_match('#img=([a-z0-9-]+)#', (string) ($item['img'] ?? ''), $m)) return; // seed pictures stay where they are
    @mkdir("$imgDir/old", 0750, true);
    foreach (glob("$imgDir/{$m[1]}-*.jpg") ?: [] as $f) @rename($f, "$imgDir/old/" . basename($f));
}

/* ── new picture (multipart) ── */
if (($_POST['action'] ?? '') === 'image') {
    if (!in_array($c, COLLECTIONS, true)) rp_json(400, ['ok' => false, 'error' => 'validation']);
    $id = preg_replace('/[^a-z0-9-]/', '', (string) ($_POST['id'] ?? ''));
    if (!is_dir($imgDir)) @mkdir($imgDir, 0750, true);
    $name = "$c-$id-" . bin2hex(random_bytes(3));
    if (!isset($_FILES['photo']) || !store_img($_FILES['photo'], "$imgDir/$name-1280.jpg")) rp_json(422, ['ok' => false, 'error' => 'photo']);
    if (!isset($_FILES['thumb']) || !store_img($_FILES['thumb'], "$imgDir/$name-640.jpg")) @copy("$imgDir/$name-1280.jpg", "$imgDir/$name-640.jpg");
    $saved = rp_with_json($file, function (array $data) use ($c, $id, $name, $imgDir) {
        $items = content_items($data, $c);
        foreach ($items as $i => $x) {
            if ($x['id'] !== $id) continue;
            retire_images($x, $imgDir);
            $items[$i]['img'] = "/api/content.php?img=$name&s=1280";
            $items[$i]['thumb'] = "/api/content.php?img=$name&s=640";
            $data[$c] = $items;
            return [$data, $items[$i]];
        }
        return [$data, null];
    });
    if (!$saved) {
        foreach (glob("$imgDir/$name-*.jpg") ?: [] as $f) @unlink($f);
        rp_json(404, ['ok' => false, 'error' => 'not_found']);
    }
    rp_json(200, ['ok' => true, 'item' => $saved]);
}

$in = rp_body(30000);
$action = $in['action'] ?? '';
$c = (string) ($in['c'] ?? '');
if (!in_array($c, COLLECTIONS, true)) rp_json(400, ['ok' => false, 'error' => 'validation']);

if ($action === 'save') {
    $src = (array) ($in['item'] ?? []);
    $id = preg_replace('/[^a-z0-9-]/', '', (string) ($src['id'] ?? ''));
    $res = rp_with_json($file, function (array $data) use ($c, $id, $src) {
        $items = content_items($data, $c);
        $idx = $id === '' ? false : array_search($id, array_column($items, 'id'), true);
        if ($id !== '' && $idx === false) return [$data, ['error' => 'not_found']];
        if ($idx === false && count($items) >= MAX_ITEMS) return [$data, ['error' => 'full']];
        [$item, $bad] = clean_item($c, $src, $idx === false ? [] : $items[$idx]);
        if ($bad) return [$data, ['error' => 'validation', 'fields' => $bad]];
        if ($idx === false) {
            $item['id'] = rp_uid();
            $items[] = $item;
        } else {
            $items[$idx] = $item;
        }
        $data[$c] = array_values($items);
        return [$data, ['item' => $item]];
    });
    if (isset($res['error'])) rp_json($res['error'] === 'not_found' ? 404 : 422, ['ok' => false] + $res);
    rp_json(200, ['ok' => true, 'item' => $res['item']]);
}

if ($action === 'delete') {
    $id = preg_replace('/[^a-z0-9-]/', '', (string) ($in['id'] ?? ''));
    rp_with_json($file, function (array $data) use ($c, $id, $imgDir) {
        $items = content_items($data, $c);
        foreach ($items as $x) if ($x['id'] === $id) retire_images($x, $imgDir);
        $data[$c] = array_values(array_filter($items, fn($x) => $x['id'] !== $id));
        return [$data, null];
    });
    rp_json(200, ['ok' => true]);
}

if ($action === 'order') {
    $ids = array_values(array_filter((array) ($in['ids'] ?? []), 'is_string'));
    $items = rp_with_json($file, function (array $data) use ($c, $ids) {
        $items = content_items($data, $c);
        $pos = array_flip($ids);
        usort($items, fn($a, $b) => ($pos[$a['id']] ?? PHP_INT_MAX) <=> ($pos[$b['id']] ?? PHP_INT_MAX));
        $data[$c] = $items;
        return [$data, $items];
    });
    rp_json(200, ['ok' => true, 'items' => $items]);
}

rp_json(400, ['ok' => false, 'error' => 'validation']);
