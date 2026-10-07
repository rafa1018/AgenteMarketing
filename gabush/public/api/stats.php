<?php
// Visits of the public site (permission "ajustes").
// GET  /api/stats.php                       → { count, log:[…newest first] }
// POST /api/stats.php {action:"setVisits", count} → sets the public counter (the history is kept)
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

$dir = rp_data_dir();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    rp_require_perm_read('ajustes');
    rp_json(200, [
        'ok' => true,
        'count' => (int) (rp_read_json("$dir/visits.json")['count'] ?? 0),
        'log' => array_reverse(rp_read_json("$dir/visitlog.json")),
    ]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}
rp_require_perm('ajustes');
$in = rp_body(2000);

if (($in['action'] ?? '') === 'setVisits') {
    $count = filter_var($in['count'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 99999999]]);
    if ($count === false) rp_json(422, ['ok' => false, 'error' => 'validation']);
    rp_with_json("$dir/visits.json", function (array $data) use ($count) {
        $data['count'] = $count;
        return [$data, null];
    });
    rp_json(200, ['ok' => true, 'count' => $count]);
}

rp_json(400, ['ok' => false, 'error' => 'validation']);
