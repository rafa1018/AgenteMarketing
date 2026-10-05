<?php
// Admin only — visits and CV downloads.
// GET  /api/stats.php                                   → { visits:{count, unique}, visitLog:[...], downloads:{count, log:[...]}, unread }
// POST /api/stats.php {action:"setVisits", count}         → sets the public counter to a value
// POST /api/stats.php {action:"resetVisits", clearUnique, clearLog}
// POST /api/stats.php {action:"resetDownloads", clearLog}
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

$dir = rp_data_dir();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    rp_require_admin_read();
    $visits = rp_read_json("$dir/visits.json");
    $downloads = rp_read_json("$dir/downloads.json");
    $messages = rp_read_json("$dir/messages.json");
    rp_json(200, [
        'ok' => true,
        'visits' => ['count' => (int) ($visits['count'] ?? 0), 'unique' => count((array) ($visits['seen'] ?? []))],
        'visitLog' => array_reverse(rp_read_json("$dir/visitlog.json")),
        'downloads' => ['count' => (int) ($downloads['count'] ?? 0), 'log' => array_reverse((array) ($downloads['log'] ?? []))],
        'unread' => count(array_filter($messages, fn($m) => empty($m['read']))),
    ]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}
rp_require_admin();
$in = rp_body(2000);
$action = $in['action'] ?? '';

if ($action === 'setVisits') {
    $count = filter_var($in['count'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 0, 'max_range' => 99999999]]);
    if ($count === false) rp_json(422, ['ok' => false, 'error' => 'validation']);
    rp_with_json("$dir/visits.json", function (array $data) use ($count) {
        $data['count'] = $count;
        return [$data, null];
    });
    rp_json(200, ['ok' => true, 'count' => $count]);
}

if ($action === 'resetVisits') {
    rp_with_json("$dir/visits.json", function (array $data) use ($in) {
        $data['count'] = 0;
        if (!empty($in['clearUnique'])) $data['seen'] = [];
        return [$data, null];
    });
    if (!empty($in['clearLog'])) rp_with_json("$dir/visitlog.json", fn() => [[], null]);
    rp_json(200, ['ok' => true, 'count' => 0]);
}

if ($action === 'resetDownloads') {
    rp_with_json("$dir/downloads.json", function (array $data) use ($in) {
        $data['count'] = 0;
        if (!empty($in['clearLog'])) $data['log'] = [];
        return [$data, null];
    });
    rp_json(200, ['ok' => true]);
}

rp_json(400, ['ok' => false, 'error' => 'validation']);
