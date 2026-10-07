<?php
// Admin only — students of the club.
// GET  /api/students.php                                   → { students }
// POST /api/students.php {action:"save", student:{…}}       → { student }
// POST /api/students.php {action:"delete", id}              → { ok }
// POST /api/students.php (multipart: id, photo)             → { student }   photo is stored privately in api/data/photos
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

const MAX_STUDENTS = 500;
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;

$file = rp_data_dir() . '/students.json';
$photoDir = rp_data_dir() . '/photos';
$method = $_SERVER['REQUEST_METHOD'];

function student_list(string $file): array
{
    $list = rp_read_json($file)['students'] ?? [];
    usort($list, fn($a, $b) => [$a['firstName'], $a['lastName']] <=> [$b['firstName'], $b['lastName']]);
    return $list;
}

if ($method === 'GET') {
    rp_require_admin_read();
    rp_json(200, ['ok' => true, 'students' => student_list($file)]);
}
if ($method !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}
rp_require_perm('estudiantes');

/* ── photo upload (multipart) ── */
if (isset($_FILES['photo'])) {
    $id = rp_clean($_POST['id'] ?? '', 32);
    $f = $_FILES['photo'];
    if ($f['error'] !== UPLOAD_ERR_OK || $f['size'] > MAX_PHOTO_BYTES || !is_uploaded_file($f['tmp_name'])) {
        rp_json(422, ['ok' => false, 'error' => 'photo']);
    }
    $type = (new finfo(FILEINFO_MIME_TYPE))->file($f['tmp_name']);
    if (!in_array($type, ['image/jpeg', 'image/png', 'image/webp'], true) || !@getimagesize($f['tmp_name'])) {
        rp_json(422, ['ok' => false, 'error' => 'photo']);
    }
    if (!is_dir($photoDir)) @mkdir($photoDir, 0750, true);
    $saved = rp_with_json($file, function (array $data) use ($id, $f, $type, $photoDir) {
        $list = $data['students'] ?? [];
        $idx = array_search($id, array_column($list, 'id'), true);
        if ($idx === false) return [$data, null];
        foreach (glob("$photoDir/$id.*") ?: [] as $old) @unlink($old);
        $ext = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'][$type];
        if (!move_uploaded_file($f['tmp_name'], "$photoDir/$id.$ext")) return [$data, null];
        $list[$idx]['photo'] = (int) ($list[$idx]['photo'] ?? 0) + 1; // version → busts the browser cache
        $data['students'] = $list;
        return [$data, $list[$idx]];
    });
    if (!$saved) rp_json(404, ['ok' => false, 'error' => 'not_found']);
    rp_json(200, ['ok' => true, 'student' => $saved]);
}

$in = rp_body(8000);
$action = $in['action'] ?? '';

if ($action === 'delete') {
    $id = rp_clean($in['id'] ?? '', 32);
    $found = rp_with_json($file, function (array $data) use ($id) {
        $list = $data['students'] ?? [];
        $left = array_values(array_filter($list, fn($s) => $s['id'] !== $id));
        $data['students'] = $left;
        return [$data, count($left) !== count($list)];
    });
    foreach (glob("$photoDir/$id.*") ?: [] as $old) @unlink($old);
    rp_json($found ? 200 : 404, ['ok' => $found]);
}

if ($action !== 'save' || !is_array($in['student'] ?? null)) {
    rp_json(400, ['ok' => false, 'error' => 'validation']);
}

$s = $in['student'];
$price = $s['price'] ?? null;
$student = [
    'id'            => rp_clean($s['id'] ?? '', 32),
    'firstName'     => rp_clean($s['firstName'] ?? '', 60),
    'lastName'      => rp_clean($s['lastName'] ?? '', 60),
    'age'           => ($s['age'] ?? '') === '' || $s['age'] === null ? null : (int) $s['age'],
    'birthDate'     => rp_clean($s['birthDate'] ?? '', 10) ?: null,
    'startDate'     => rp_clean($s['startDate'] ?? '', 10),
    'planId'        => rp_clean($s['planId'] ?? '', 40),
    // amount to charge this student; null = use the plan price
    'price'         => $price === '' || $price === null ? null : (int) $price,
    'billingDay'    => max(1, min(31, (int) ($s['billingDay'] ?? 1))),
    // null = follow the general setting (Ajustes)
    'monthlyMode'   => in_array($s['monthlyMode'] ?? null, ['vencido', 'anticipado'], true) ? $s['monthlyMode'] : null,
    // take attendance for this student? null = by plan (por día: yes · mensual: no)
    'attendance'    => array_key_exists('attendance', $s) && $s['attendance'] !== null ? (bool) $s['attendance'] : null,
    'guardianName'  => rp_clean($s['guardianName'] ?? '', 100),
    'guardianPhone' => rp_clean($s['guardianPhone'] ?? '', 25),
    'authorized'    => rp_clean($s['authorized'] ?? '', 300),
    'notes'         => rp_clean($s['notes'] ?? '', 300),
    'active'        => !empty($s['active']),
];
$errors = [];
if (mb_strlen($student['firstName']) < 2) $errors[] = 'firstName';
if (mb_strlen($student['lastName']) < 2) $errors[] = 'lastName';
if ($student['age'] !== null && ($student['age'] < 1 || $student['age'] > 25)) $errors[] = 'age';
if (!rp_valid_date($student['startDate'])) $errors[] = 'startDate';
if ($student['birthDate'] !== null && (!rp_valid_date($student['birthDate']) || $student['birthDate'] > date('Y-m-d'))) $errors[] = 'birthDate';
if ($student['planId'] === '') $errors[] = 'planId';
if ($student['price'] !== null && ($student['price'] < 0 || $student['price'] > 100000000)) $errors[] = 'price';
if ($student['guardianPhone'] !== '') {
    $normalized = rp_phone_co($student['guardianPhone']);
    if ($normalized === null) $errors[] = 'guardianPhone';
    else $student['guardianPhone'] = $normalized;
}
// Enrolment periods: [{start, end|null, reason}], oldest first; only the last one may be open.
// The current start date and the active flag always follow the last period.
$periods = [];
foreach (array_slice((array) ($s['periods'] ?? []), 0, 60) as $p) {
    $start = rp_clean($p['start'] ?? '', 10);
    $end = rp_clean($p['end'] ?? '', 10);
    if (!rp_valid_date($start) || ($end !== '' && (!rp_valid_date($end) || $end < $start))) {
        $errors[] = 'periods';
        break;
    }
    $periods[] = ['start' => $start, 'end' => $end === '' ? null : $end, 'reason' => rp_clean($p['reason'] ?? '', 100)];
}
usort($periods, fn($a, $b) => strcmp($a['start'], $b['start']));
foreach ($periods as $i => $p) {
    $last = $i === count($periods) - 1;
    if ((!$last && $p['end'] === null) || ($i > 0 && $p['start'] <= ($periods[$i - 1]['end'] ?? '9999'))) {
        $errors[] = 'periods';
        break;
    }
}
if (!$periods && !$errors) {
    $periods[] = ['start' => $student['startDate'], 'end' => $student['active'] ? null : date('Y-m-d'), 'reason' => ''];
}
if ($periods && !$errors) {
    $current = end($periods);
    $student['startDate'] = $current['start'];
    $student['active'] = $current['end'] === null;
}
$student['periods'] = $periods;

if ($errors) {
    rp_json(422, ['ok' => false, 'error' => 'validation', 'fields' => array_values(array_unique($errors))]);
}

$now = date('c');
$saved = rp_with_json($file, function (array $data) use ($student, $now) {
    $list = $data['students'] ?? [];
    $idx = $student['id'] === '' ? false : array_search($student['id'], array_column($list, 'id'), true);
    if ($idx === false) {
        if (count($list) >= MAX_STUDENTS) return [$data, null];
        $student['id'] = rp_uid();
        $student['photo'] = 0;
        $student['createdAt'] = $now;
        $list[] = $student;
        $idx = count($list) - 1;
    } else {
        $student['photo'] = $list[$idx]['photo'] ?? 0;
        $student['createdAt'] = $list[$idx]['createdAt'] ?? $now;
        $list[$idx] = $student;
    }
    $list[$idx]['updatedAt'] = $now;
    $data['students'] = $list;
    return [$data, $list[$idx]];
});
if (!$saved) rp_json(507, ['ok' => false, 'error' => 'full']);
rp_json(200, ['ok' => true, 'student' => $saved]);
