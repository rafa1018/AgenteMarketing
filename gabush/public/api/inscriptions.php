<?php
// Admin only — enrolments sent from the public form (kept forever as history).
// GET  /api/inscriptions.php                                      → { items }   newest first
// POST /api/inscriptions.php {action:"status", id, status, note?}  → { item }    status: pendiente | contactado | atendido
// POST /api/inscriptions.php {action:"delete", id}                 → { ok }      e.g. test submissions
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

$file = rp_data_dir() . '/inscriptions.json';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    rp_require_perm_read('inscripciones');
    $items = rp_read_json($file)['items'] ?? [];
    usort($items, fn($a, $b) => strcmp($b['createdAt'], $a['createdAt']));
    rp_json(200, ['ok' => true, 'items' => $items]);
}
if ($method !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}
rp_require_perm('inscripciones');
$in = rp_body(4000);
$id = rp_clean($in['id'] ?? '', 32);

if (($in['action'] ?? '') === 'delete') {
    $found = rp_with_json($file, function (array $data) use ($id) {
        $items = $data['items'] ?? [];
        $left = array_values(array_filter($items, fn($it) => $it['id'] !== $id));
        $data['items'] = $left;
        return [$data, count($left) !== count($items)];
    });
    rp_json($found ? 200 : 404, ['ok' => $found]);
}

$status = $in['status'] ?? '';
if (($in['action'] ?? '') !== 'status' || !in_array($status, ['pendiente', 'contactado', 'atendido'], true)) {
    rp_json(422, ['ok' => false, 'error' => 'validation']);
}
$note = array_key_exists('note', $in) ? rp_clean($in['note'], 500) : null;

$item = rp_with_json($file, function (array $data) use ($id, $status, $note) {
    foreach ($data['items'] ?? [] as $i => $it) {
        if ($it['id'] !== $id) continue;
        $data['items'][$i]['status'] = $status;
        $data['items'][$i]['statusAt'] = date('c');
        if ($note !== null) $data['items'][$i]['note'] = $note;
        return [$data, $data['items'][$i]];
    }
    return [$data, null];
});
if (!$item) rp_json(404, ['ok' => false, 'error' => 'not_found']);
rp_json(200, ['ok' => true, 'item' => $item]);
