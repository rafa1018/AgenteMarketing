<?php
// Professional experience (section 03 of the site), editable from the admin panel.
// GET  /api/experience.php                           → { items: [...] }   (public)
// POST /api/experience.php {action:"save", item}      → create / update one role   (admin)
// POST /api/experience.php {action:"delete", id}
// POST /api/experience.php {action:"restoreSeed"}     → back to the original CV data
//
// The data lives in <data>/experience.json. The first time it doesn't exist it is copied from
// api/seed/experience.json (shipped with the site); after that publishing never replaces it.
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

const SEED_FILE = __DIR__ . '/seed/experience.json';
$file = rp_data_dir() . '/experience.json';

function exp_seed(): array
{
    return is_file(SEED_FILE) ? (json_decode((string) file_get_contents(SEED_FILE), true) ?: []) : [];
}

function exp_items(string $file): array
{
    if (!is_file($file)) {
        $fp = fopen($file, 'x'); // only one request creates it
        if ($fp) {
            fwrite($fp, json_encode(exp_seed(), JSON_UNESCAPED_UNICODE));
            fclose($fp);
        }
    }
    return rp_read_json($file);
}

function exp_ym($v): ?string
{
    return is_string($v) && preg_match('/^(19|20)\d\d-(0[1-9]|1[0-2])$/', $v) ? $v : null;
}

/** Validated role or null. */
function exp_clean(array $in): ?array
{
    $l = fn($v, int $max) => ['es' => rp_clean($v['es'] ?? '', $max), 'en' => rp_clean($v['en'] ?? '', $max)];
    $role = $l((array) ($in['role'] ?? []), 120);
    $start = exp_ym($in['start'] ?? '');
    $end = ($in['end'] ?? '') === '' ? '' : exp_ym($in['end']);
    $company = rp_clean($in['company'] ?? '', 120);
    if (mb_strlen($role['es']) < 2 || mb_strlen($company) < 2 || !$start || $end === null || ($end !== '' && $end < $start)) return null;

    $techs = [];
    foreach (array_slice((array) ($in['technologies'] ?? []), 0, 40) as $t) {
        $t = rp_clean($t, 40);
        if ($t !== '' && !in_array(mb_strtolower($t), array_map('mb_strtolower', $techs), true)) $techs[] = $t;
    }
    $resp = [];
    foreach (array_slice((array) ($in['responsibilities'] ?? []), 0, 25) as $r) {
        $r = $l((array) $r, 800);
        if (mb_strlen($r['es']) >= 2) $resp[] = $r;
    }
    $id = preg_match('/^[a-z0-9]{4,20}$/', (string) ($in['id'] ?? '')) ? $in['id'] : rp_uid();
    return [
        'id' => $id,
        'company' => $company,
        'location' => rp_clean($in['location'] ?? '', 80),
        'role' => $role,
        'start' => $start,
        'end' => $end,
        'technologies' => $techs,
        'responsibilities' => $resp,
        'highlight' => (bool) ($in['highlight'] ?? false),
    ];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    rp_json(200, ['ok' => true, 'items' => exp_items($file)]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}
rp_require_admin();
$in = rp_body(60000);
$action = $in['action'] ?? '';
exp_items($file); // make sure the seed is in place before editing

if ($action === 'save') {
    $item = exp_clean((array) ($in['item'] ?? []));
    if (!$item) rp_json(422, ['ok' => false, 'error' => 'validation']);
    $items = rp_with_json($file, function (array $data) use ($item) {
        $found = false;
        foreach ($data as $i => $e) {
            if (($e['id'] ?? '') === $item['id']) {
                $data[$i] = $item;
                $found = true;
            }
        }
        if (!$found) $data[] = $item;
        if (count($data) > 100) $data = array_slice($data, -100);
        return [$data, $data];
    });
    rp_json(200, ['ok' => true, 'item' => $item, 'items' => $items]);
}

if ($action === 'delete') {
    $id = (string) ($in['id'] ?? '');
    $items = rp_with_json($file, function (array $data) use ($id) {
        $data = array_values(array_filter($data, fn($e) => ($e['id'] ?? '') !== $id));
        return [$data, $data];
    });
    rp_json(200, ['ok' => true, 'items' => $items]);
}

if ($action === 'restoreSeed') {
    $seed = exp_seed();
    rp_with_json($file, fn() => [$seed, null]);
    rp_json(200, ['ok' => true, 'items' => $seed]);
}

rp_json(400, ['ok' => false, 'error' => 'validation']);
