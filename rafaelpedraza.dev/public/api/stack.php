<?php
// Technology stack (section 04 of the site), editable from the admin panel.
// GET  /api/stack.php                                          → { stack: {backend:[...], frontend:[...], ...} }  (public)
// POST /api/stack.php {action:"save", category, item}           → create / update a technology   (admin)
// POST /api/stack.php {action:"delete", category, id}
// POST /api/stack.php {action:"move", category, id, dir:-1|1}   → reorder inside its category
// POST /api/stack.php {action:"restoreSeed"}                     → back to the original stack
//
// The data lives in <data>/stack.json. The first time it doesn't exist it is copied from
// api/seed/stack.json (shipped with the site); after that publishing never replaces it.
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

const STACK_SEED = __DIR__ . '/seed/stack.json';
const STACK_CATEGORIES = ['backend', 'frontend', 'databases', 'devops', 'data', 'ai'];
$file = rp_data_dir() . '/stack.json';

function stack_seed(): array
{
    return is_file(STACK_SEED) ? (json_decode((string) file_get_contents(STACK_SEED), true) ?: []) : [];
}

/** Always returns every category (empty ones as []). */
function stack_normalize(array $data): array
{
    $out = [];
    foreach (STACK_CATEGORIES as $c) $out[$c] = array_values((array) ($data[$c] ?? []));
    return $out;
}

function stack_read(string $file): array
{
    if (!is_file($file)) {
        $fp = fopen($file, 'x'); // only one request creates it
        if ($fp) {
            fwrite($fp, json_encode(stack_normalize(stack_seed()), JSON_UNESCAPED_UNICODE));
            fclose($fp);
        }
    }
    return stack_normalize(rp_read_json($file));
}

function stack_clean(array $in): ?array
{
    $name = rp_clean($in['name'] ?? '', 40);
    if ($name === '') return null;
    $note = (array) ($in['note'] ?? []);
    return [
        'id' => preg_match('/^[a-z0-9]{4,20}$/', (string) ($in['id'] ?? '')) ? $in['id'] : rp_uid(),
        'name' => $name,
        'icon' => preg_match('/^[A-Za-z0-9]{1,40}$/', (string) ($in['icon'] ?? '')) ? $in['icon'] : 'CodeXml',
        'note' => ['es' => rp_clean($note['es'] ?? '', 60), 'en' => rp_clean($note['en'] ?? '', 60)],
        'active' => (bool) ($in['active'] ?? true),
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $stack = stack_read($file);
    rp_json(200, ['ok' => true, 'stack' => $stack]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}
rp_require_admin();
$in = rp_body(20000);
$action = $in['action'] ?? '';
$cat = (string) ($in['category'] ?? '');
stack_read($file); // make sure the seed is in place before editing

if ($action === 'restoreSeed') {
    $seed = stack_normalize(stack_seed());
    rp_with_json($file, fn() => [$seed, null]);
    rp_json(200, ['ok' => true, 'stack' => $seed]);
}
if (!in_array($cat, STACK_CATEGORIES, true)) {
    rp_json(422, ['ok' => false, 'error' => 'validation']);
}

if ($action === 'save') {
    $item = stack_clean((array) ($in['item'] ?? []));
    if (!$item) rp_json(422, ['ok' => false, 'error' => 'validation']);
    $stack = rp_with_json($file, function (array $data) use ($cat, $item) {
        $data = stack_normalize($data);
        $found = false;
        foreach (STACK_CATEGORIES as $c) {
            foreach ($data[$c] as $i => $t) {
                if (($t['id'] ?? '') !== $item['id']) continue;
                if ($c === $cat) {
                    $data[$c][$i] = $item;
                    $found = true;
                } else {
                    unset($data[$c][$i]); // moved to another category
                    $data[$c] = array_values($data[$c]);
                }
            }
        }
        if (!$found) $data[$cat][] = $item;
        if (count($data[$cat]) > 40) $data[$cat] = array_slice($data[$cat], -40);
        return [$data, $data];
    });
    rp_json(200, ['ok' => true, 'stack' => $stack]);
}

$id = (string) ($in['id'] ?? '');

if ($action === 'delete') {
    $stack = rp_with_json($file, function (array $data) use ($cat, $id) {
        $data = stack_normalize($data);
        $data[$cat] = array_values(array_filter($data[$cat], fn($t) => ($t['id'] ?? '') !== $id));
        return [$data, $data];
    });
    rp_json(200, ['ok' => true, 'stack' => $stack]);
}

if ($action === 'move') {
    $dir = (int) ($in['dir'] ?? 0) < 0 ? -1 : 1;
    $stack = rp_with_json($file, function (array $data) use ($cat, $id, $dir) {
        $data = stack_normalize($data);
        $list = $data[$cat];
        foreach ($list as $i => $t) {
            $j = $i + $dir;
            if (($t['id'] ?? '') === $id && $j >= 0 && $j < count($list)) {
                [$list[$i], $list[$j]] = [$list[$j], $list[$i]];
                break;
            }
        }
        $data[$cat] = $list;
        return [$data, $data];
    });
    rp_json(200, ['ok' => true, 'stack' => $stack]);
}

rp_json(400, ['ok' => false, 'error' => 'validation']);
