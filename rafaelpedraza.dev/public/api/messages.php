<?php
// Admin only — inbox of the public contact form.
// GET  /api/messages.php                         → { messages: [...newest first], unread }
// POST /api/messages.php {action:"read", id, read:bool}
// POST /api/messages.php {action:"readAll"}
// POST /api/messages.php {action:"delete", id}
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

$file = rp_data_dir() . '/messages.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    rp_require_admin_read();
    $all = array_reverse(rp_read_json($file));
    rp_json(200, ['ok' => true, 'messages' => $all, 'unread' => count(array_filter($all, fn($m) => empty($m['read'])))]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}
rp_require_admin();
$in = rp_body(2000);
$action = $in['action'] ?? '';
$id = (string) ($in['id'] ?? '');

if ($action === 'readAll') {
    rp_with_json($file, function (array $data) {
        foreach ($data as $i => $m) $data[$i]['read'] = true;
        return [$data, null];
    });
    rp_json(200, ['ok' => true]);
}
if ($id === '') {
    rp_json(422, ['ok' => false, 'error' => 'validation']);
}
if ($action === 'read') {
    $read = (bool) ($in['read'] ?? true);
    rp_with_json($file, function (array $data) use ($id, $read) {
        foreach ($data as $i => $m) if (($m['id'] ?? '') === $id) $data[$i]['read'] = $read;
        return [$data, null];
    });
    rp_json(200, ['ok' => true]);
}
if ($action === 'delete') {
    rp_with_json($file, fn(array $data) => [array_values(array_filter($data, fn($m) => ($m['id'] ?? '') !== $id)), null]);
    rp_json(200, ['ok' => true]);
}
rp_json(400, ['ok' => false, 'error' => 'validation']);
