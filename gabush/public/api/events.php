<?php
// GET  /api/events.php                                   → { events: [...] }   (public)
// POST /api/events.php {action:"save", event:{...}}       → { event }           (admin + X-CSRF-Token)
// POST /api/events.php {action:"delete", id}              → { ok }              (admin + X-CSRF-Token)
// POST /api/events.php {action:"sync_holidays", year}     → { added, existing, events } (admin + X-CSRF-Token)
// Only GET/POST are used because some shared hosts block PUT/DELETE.
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

const FESTIVO_COLOR = '#dc2626';
const MAX_EVENTS = 1000;
const MAX_SPAN_DAYS = 366;

$file = rp_data_dir() . '/events.json';
$method = $_SERVER['REQUEST_METHOD'];

function sort_events(array $events): array
{
    usort($events, fn($a, $b) => [$a['start'], $a['end'], $a['title']] <=> [$b['start'], $b['end'], $b['title']]);
    return array_values($events);
}

function valid_date(string $d): bool
{
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $d, $m)) return false;
    return checkdate((int) $m[2], (int) $m[3], (int) $m[1]) && (int) $m[1] >= 2000 && (int) $m[1] <= 2100;
}

/** Easter Sunday (anonymous Gregorian algorithm — no calendar extension needed). */
function easter(int $y): DateTimeImmutable
{
    $a = $y % 19; $b = intdiv($y, 100); $c = $y % 100; $d = intdiv($b, 4); $e = $b % 4;
    $f = intdiv($b + 8, 25); $g = intdiv($b - $f + 1, 3); $h = (19 * $a + $b - $d - $g + 15) % 30;
    $i = intdiv($c, 4); $k = $c % 4; $l = (32 + 2 * $e + 2 * $i - $h - $k) % 7;
    $m = intdiv($a + 11 * $h + 22 * $l, 451);
    $month = intdiv($h + $l - 7 * $m + 114, 31); $day = (($h + $l - 7 * $m + 114) % 31) + 1;
    return new DateTimeImmutable(sprintf('%04d-%02d-%02d', $y, $month, $day), new DateTimeZone('UTC'));
}

/** Colombian public holidays for a year (Ley 51 de 1983 "Emiliani": some move to the next Monday). */
function colombia_holidays(int $y): array
{
    $utc = new DateTimeZone('UTC');
    $date = fn(int $m, int $d) => new DateTimeImmutable(sprintf('%04d-%02d-%02d', $y, $m, $d), $utc);
    $monday = fn(DateTimeImmutable $d) => $d->format('N') === '1' ? $d : $d->modify('next monday');
    $e = easter($y);
    $list = [
        [$date(1, 1), 'Año Nuevo'],
        [$monday($date(1, 6)), 'Día de los Reyes Magos'],
        [$monday($date(3, 19)), 'Día de San José'],
        [$e->modify('-3 days'), 'Jueves Santo'],
        [$e->modify('-2 days'), 'Viernes Santo'],
        [$date(5, 1), 'Día del Trabajo'],
        [$monday($e->modify('+39 days')), 'Ascensión del Señor'],
        [$monday($e->modify('+60 days')), 'Corpus Christi'],
        [$monday($e->modify('+68 days')), 'Sagrado Corazón de Jesús'],
        [$monday($date(6, 29)), 'San Pedro y San Pablo'],
        [$date(7, 20), 'Día de la Independencia'],
        [$date(8, 7), 'Batalla de Boyacá'],
        [$monday($date(8, 15)), 'La Asunción de la Virgen'],
        [$monday($date(10, 12)), 'Día de la Raza'],
        [$monday($date(11, 1)), 'Día de Todos los Santos'],
        [$monday($date(11, 11)), 'Independencia de Cartagena'],
        [$date(12, 8), 'Día de la Inmaculada Concepción'],
        [$date(12, 25), 'Navidad'],
    ];
    return array_map(fn($h) => ['date' => $h[0]->format('Y-m-d'), 'title' => $h[1]], $list);
}

/**
 * Students' birthdays as private, read-only events (staff only): built on the fly from each active or
 * pre-enrolled student's birth date, so they are always in sync (new students, corrected dates, withdrawals).
 * Last year, this year and next year, so the calendar can be browsed around.
 */
function birthday_events(): array
{
    global $CONFIG;
    if (empty($CONFIG['db'])) return [];
    try {
        require_once dirname(__DIR__, 2) . '/server/bootstrap.php';
        $app = Gabush\App::boot();
        $db = $app->db();
        $year = (new Gabush\Application\Shared\Settings($db))->activeYear();
        $rows = $db->all(
            "SELECT s.id, s.first_name, s.last_name, s.birth_date, c.name AS course
             FROM students s JOIN enrollments e ON e.student_id = s.id AND e.year_id = ? AND e.status IN ('activo','prematricula')
             LEFT JOIN courses c ON c.id = e.course_id
             WHERE s.birth_date IS NOT NULL",
            [$year],
        );
    } catch (Throwable $e) {
        error_log('[gabush birthdays] ' . $e->getMessage());
        return [];
    }
    $out = [];
    $now = (int) date('Y');
    foreach ($rows as $r) {
        [$by, $bm, $bd] = array_map('intval', explode('-', substr((string) $r['birth_date'], 0, 10)));
        if (!$by || !$bm || !$bd) continue;
        foreach ([$now - 1, $now, $now + 1] as $y) {
            $age = $y - $by;
            if ($age < 1) continue;
            $d = checkdate($bm, $bd, $y) ? $bd : 28; // 29 Feb in a non-leap year → 28 Feb
            $date = sprintf('%04d-%02d-%02d', $y, $bm, $d);
            $name = trim($r['first_name'] . ' ' . $r['last_name']);
            $out[] = [
                'id' => "cumple-{$r['id']}-$y", 'title' => "🎂 $name", 'type' => 'evento', 'visibility' => 'privado',
                'description' => 'Cumple ' . $age . ' año' . ($age === 1 ? '' : 's') . ($r['course'] ? ' · ' . $r['course'] : ''),
                'color' => '#e5197e', 'start' => $date, 'end' => $date, 'source' => 'cumpleanos', 'readonly' => true, 'studentId' => (int) $r['id'],
            ];
        }
    }
    return $out;
}

if ($method === 'GET') {
    $data = is_file($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : [];
    $events = $data['events'] ?? [];
    if (rp_is_admin()) {
        // staff also see the students' birthdays (automatic, private)
        $events = array_merge($events, birthday_events());
    } else {
        // private events ("privado") are only sent to the logged-in admin
        $events = array_values(array_filter($events, fn($e) => ($e['visibility'] ?? 'publico') !== 'privado'));
    }
    rp_json(200, ['ok' => true, 'events' => sort_events($events)]);
}
if ($method !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}

rp_require_perm('calendario');
$in = rp_body(8000);
$action = $in['action'] ?? '';

if ($action === 'delete') {
    $id = rp_clean($in['id'] ?? '', 32);
    $found = rp_with_json($file, function (array $data) use ($id) {
        $events = $data['events'] ?? [];
        $left = array_values(array_filter($events, fn($e) => $e['id'] !== $id));
        $data['events'] = $left;
        return [$data, count($left) !== count($events)];
    });
    rp_json($found ? 200 : 404, ['ok' => $found]);
}

if ($action === 'sync_holidays') {
    $year = (int) ($in['year'] ?? 0);
    if ($year < 2000 || $year > 2100) {
        rp_json(422, ['ok' => false, 'error' => 'validation', 'fields' => ['year']]);
    }
    $now = date('c');
    $result = rp_with_json($file, function (array $data) use ($year, $now) {
        $events = $data['events'] ?? [];
        $added = 0;
        $existing = 0;
        foreach (colombia_holidays($year) as $h) {
            // skip a day that already has a holiday (synced earlier or created by hand)
            $dup = array_filter($events, fn($e) => $e['type'] === 'festivo' && $e['start'] <= $h['date'] && $e['end'] >= $h['date']);
            if ($dup) {
                $existing++;
                continue;
            }
            if (count($events) >= MAX_EVENTS) break;
            $events[] = ['id' => bin2hex(random_bytes(8)), 'title' => $h['title'], 'description' => '', 'type' => 'festivo', 'visibility' => 'publico', 'color' => FESTIVO_COLOR, 'start' => $h['date'], 'end' => $h['date'], 'source' => 'festivos-co', 'createdAt' => $now, 'updatedAt' => $now];
            $added++;
        }
        $data['events'] = sort_events($events);
        return [$data, ['added' => $added, 'existing' => $existing, 'events' => $data['events']]];
    });
    rp_json(200, ['ok' => true] + $result);
}

if ($action !== 'save' || !is_array($in['event'] ?? null)) {
    rp_json(400, ['ok' => false, 'error' => 'validation']);
}

$e = $in['event'];
$id = rp_clean($e['id'] ?? '', 32);
$title = rp_clean($e['title'] ?? '', 80);
$description = rp_clean($e['description'] ?? '', 300);
$type = ($e['type'] ?? '') === 'festivo' ? 'festivo' : 'evento';
$visibility = ($e['visibility'] ?? '') === 'privado' ? 'privado' : 'publico';
$color = strtolower(rp_clean($e['color'] ?? '', 7));
$start = rp_clean($e['start'] ?? '', 10);
$end = rp_clean($e['end'] ?? '', 10) ?: $start;

$errors = [];
if (mb_strlen($title) < 2) $errors[] = 'title';
if (!valid_date($start)) $errors[] = 'start';
if (!valid_date($end) || $end < $start) $errors[] = 'end';
if ($type === 'festivo') $color = FESTIVO_COLOR;
elseif (!preg_match('/^#[0-9a-f]{6}$/', $color)) $errors[] = 'color';
if (!$errors && (strtotime($end) - strtotime($start)) / 86400 > MAX_SPAN_DAYS) $errors[] = 'end';
if ($errors) {
    rp_json(422, ['ok' => false, 'error' => 'validation', 'fields' => $errors]);
}

$now = date('c');
$saved = rp_with_json($file, function (array $data) use ($id, $title, $description, $type, $visibility, $color, $start, $end, $now) {
    $events = $data['events'] ?? [];
    $event = ['id' => $id, 'title' => $title, 'description' => $description, 'type' => $type, 'visibility' => $visibility, 'color' => $color, 'start' => $start, 'end' => $end, 'updatedAt' => $now];
    $idx = $id === '' ? false : array_search($id, array_column($events, 'id'), true);
    if ($idx === false) {
        if (count($events) >= MAX_EVENTS) return [$data, null];
        $event['id'] = bin2hex(random_bytes(8));
        $event['createdAt'] = $now;
        $events[] = $event;
    } else {
        $event['createdAt'] = $events[$idx]['createdAt'] ?? $now;
        if (isset($events[$idx]['source'])) $event['source'] = $events[$idx]['source'];
        $events[$idx] = $event;
    }
    $data['events'] = sort_events($events);
    return [$data, $event];
});
if ($saved === null) {
    rp_json(507, ['ok' => false, 'error' => 'full']);
}
rp_json(200, ['ok' => true, 'event' => $saved]);
