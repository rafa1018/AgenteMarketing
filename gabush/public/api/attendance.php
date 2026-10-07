<?php
// Admin only — daily attendance.
// GET  /api/attendance.php?from=YYYY-MM-DD&to=YYYY-MM-DD           → { days: { date: { studentId: {s, p?} } } }
// POST /api/attendance.php {action:"mark", date, studentId, status}  → { record }
//   status: "a" (asistió) | "f" (no asistió) | null (borrar la marca)
//   For "por día" plans the day's price is stored with the mark, so later price changes don't alter old charges.
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

$file = rp_data_dir() . '/attendance.json';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    rp_require_admin_read();
    $from = rp_clean($_GET['from'] ?? '', 10);
    $to = rp_clean($_GET['to'] ?? '', 10);
    if (!rp_valid_date($from) || !rp_valid_date($to) || $to < $from) {
        rp_json(422, ['ok' => false, 'error' => 'validation']);
    }
    $days = rp_read_json($file)['days'] ?? [];
    $out = array_filter($days, fn($d) => $d >= $from && $d <= $to, ARRAY_FILTER_USE_KEY);
    rp_json(200, ['ok' => true, 'days' => (object) $out]);
}
if ($method !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}
rp_require_perm('asistencia');
$in = rp_body(2000);
if (($in['action'] ?? '') !== 'mark') {
    rp_json(400, ['ok' => false, 'error' => 'validation']);
}

$date = rp_clean($in['date'] ?? '', 10);
$studentId = rp_clean($in['studentId'] ?? '', 32);
$status = $in['status'] ?? null;
if (!rp_valid_date($date) || $studentId === '' || !in_array($status, ['a', 'f', null], true)) {
    rp_json(422, ['ok' => false, 'error' => 'validation']);
}

// price of a "por día" plan at the moment of marking
$students = rp_read_json(rp_data_dir() . '/students.json')['students'] ?? [];
$student = current(array_filter($students, fn($s) => $s['id'] === $studentId));
if (!$student) {
    rp_json(404, ['ok' => false, 'error' => 'not_found']);
}
$billing = rp_read_json(rp_data_dir() . '/billing.json');
$plan = current(array_filter($billing['plans'] ?? [], fn($p) => $p['id'] === $student['planId']));

$record = null;
if ($status !== null) {
    $record = ['s' => $status];
    // the student's own price wins over the plan price
    if ($status === 'a' && $plan && $plan['type'] === 'dia') $record['p'] = (int) ($student['price'] ?? $plan['price']);
}

rp_with_json($file, function (array $data) use ($date, $studentId, $record) {
    if ($record === null) {
        unset($data['days'][$date][$studentId]);
        if (empty($data['days'][$date])) unset($data['days'][$date]);
    } else {
        $data['days'][$date][$studentId] = $record;
    }
    return [$data, null];
});
rp_json(200, ['ok' => true, 'record' => $record]);
