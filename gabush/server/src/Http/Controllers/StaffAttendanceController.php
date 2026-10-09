<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Http\HttpError;
use Gabush\Http\Request;
use Gabush\Http\Response;
use Gabush\Http\Router;
use Gabush\Http\Validate;

/**
 * Attendance of the school's own staff (permission "personal": the rectora / administration only, never the
 * teachers themselves): the day's sheet with entry / exit time, a summary per person and the Excel export.
 */
final class StaffAttendanceController extends Controller
{
    public const STATES = ['presente', 'tarde', 'ausente', 'permiso', 'incapacidad', 'vacaciones'];

    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/staff-attendance', [$c, 'day']);
        $r->add('PUT', '/staff-attendance', [$c, 'save']);
        $r->add('GET', '/staff-attendance/summary', [$c, 'summary']);
        $r->add('GET', '/staff-attendance/person/{id}', [$c, 'person']);
        $r->add('GET', '/staff-attendance/export', [$c, 'export']);
    }

    /** ?date= → active staff (plus anyone already marked that day) with their mark. */
    public function day(Request $req): array
    {
        $this->staff($req, 'personal');
        $date = $this->date($req, 'date', date('Y-m-d'));
        $rows = $this->db()->all(
            "SELECT s.id, s.full_name AS name, s.position, s.active, a.status, TIME_FORMAT(a.check_in, '%H:%i') AS checkIn, TIME_FORMAT(a.check_out, '%H:%i') AS checkOut,
                    a.note, a.recorded_by AS recordedBy, a.recorded_at AS recordedAt
             FROM staff s LEFT JOIN staff_attendance a ON a.staff_id = s.id AND a.day = ?
             WHERE s.active = 1 OR a.staff_id IS NOT NULL ORDER BY s.full_name",
            [$date],
        );
        return ['date' => $date, 'staff' => self::intsAll($rows, 'id', 'active')];
    }

    /** {date, items:[{staffId, status ('' clears), checkIn, checkOut, note}]} */
    public function save(Request $req): array
    {
        $actor = $this->staffWrite($req, 'personal');
        $v = Validate::of($req);
        $date = $v->date('date', true);
        $items = $v->arr('items');
        $v->check();
        if ($date > date('Y-m-d')) throw HttpError::validation(['date' => 'No se puede marcar un día futuro.']);
        $time = static fn($t) => is_string($t) && preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $t) ? $t . ':00' : null;
        $n = 0;
        $this->db()->transaction(function ($db) use ($items, $date, $actor, $time, &$n): void {
            foreach ($items as $it) {
                $sid = (int) ($it['staffId'] ?? 0);
                $status = (string) ($it['status'] ?? '');
                if ($sid <= 0) continue;
                if ($status === '') {
                    $db->run('DELETE FROM staff_attendance WHERE staff_id = ? AND day = ?', [$sid, $date]);
                    continue;
                }
                if (!in_array($status, self::STATES, true)) continue;
                $db->run(
                    'INSERT INTO staff_attendance (staff_id, day, status, check_in, check_out, note, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE status = VALUES(status), check_in = VALUES(check_in), check_out = VALUES(check_out), note = VALUES(note), recorded_by = VALUES(recorded_by)',
                    [$sid, $date, $status, $time($it['checkIn'] ?? null), $time($it['checkOut'] ?? null), mb_substr(trim((string) ($it['note'] ?? '')), 0, 200) ?: null, $actor->label()],
                );
                $n++;
            }
        });
        $this->audit()->log($actor, 'staff_attendance.save', 'staff_attendance', $date, ['items' => $n]);
        return ['saved' => $n];
    }

    /** ?from=&to= → counts per person and the days marked. */
    public function summary(Request $req): array
    {
        $this->staff($req, 'personal');
        [$from, $to] = [$this->date($req, 'from', date('Y-m-01')), $this->date($req, 'to', date('Y-m-t'))];
        $rows = $this->db()->all(
            "SELECT s.id, s.full_name AS name, s.position, s.active,
                    SUM(a.status = 'presente') AS presente, SUM(a.status = 'tarde') AS tarde, SUM(a.status = 'ausente') AS ausente,
                    SUM(a.status = 'permiso') AS permiso, SUM(a.status = 'incapacidad') AS incapacidad, SUM(a.status = 'vacaciones') AS vacaciones,
                    COUNT(a.day) AS marcados
             FROM staff s LEFT JOIN staff_attendance a ON a.staff_id = s.id AND a.day BETWEEN ? AND ?
             WHERE s.active = 1 OR a.staff_id IS NOT NULL
             GROUP BY s.id ORDER BY s.full_name",
            [$from, $to],
        );
        $days = (int) $this->db()->value('SELECT COUNT(DISTINCT day) FROM staff_attendance WHERE day BETWEEN ? AND ?', [$from, $to]);
        return ['from' => $from, 'to' => $to, 'days' => $days, 'staff' => self::intsAll($rows, 'id', 'active', 'presente', 'tarde', 'ausente', 'permiso', 'incapacidad', 'vacaciones', 'marcados')];
    }

    /** One person's days in the range (traceability). */
    public function person(Request $req): array
    {
        $this->staff($req, 'personal');
        $id = $req->intParam('id');
        [$from, $to] = [$this->date($req, 'from', date('Y-m-01')), $this->date($req, 'to', date('Y-m-t'))];
        $p = $this->db()->one('SELECT id, full_name AS name, position FROM staff WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        $rows = $this->db()->all(
            "SELECT day, status, TIME_FORMAT(check_in, '%H:%i') AS checkIn, TIME_FORMAT(check_out, '%H:%i') AS checkOut, note, recorded_by AS recordedBy, recorded_at AS recordedAt
             FROM staff_attendance WHERE staff_id = ? AND day BETWEEN ? AND ? ORDER BY day DESC",
            [$id, $from, $to],
        );
        return ['person' => self::ints($p, 'id'), 'days' => $rows];
    }

    /** ?from=&to= → Excel (CSV) with every mark. */
    public function export(Request $req): Response
    {
        $this->staff($req, 'personal');
        [$from, $to] = [$this->date($req, 'from', date('Y-m-01')), $this->date($req, 'to', date('Y-m-t'))];
        $rows = $this->db()->all(
            "SELECT a.day, s.full_name, s.position, a.status, TIME_FORMAT(a.check_in, '%H:%i'), TIME_FORMAT(a.check_out, '%H:%i'), a.note, a.recorded_by, a.recorded_at
             FROM staff_attendance a JOIN staff s ON s.id = a.staff_id WHERE a.day BETWEEN ? AND ? ORDER BY a.day, s.full_name",
            [$from, $to],
        );
        return Response::csv("asistencia-personal-$from-a-$to.csv", ['Fecha', 'Persona', 'Cargo', 'Estado', 'Entrada', 'Salida', 'Nota', 'Registrado por', 'Registrado el'], array_map('array_values', $rows));
    }

    private function date(Request $req, string $key, string $default): string
    {
        $d = (string) $req->query($key, $default);
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) throw HttpError::validation([$key => 'Fecha no válida.']);
        return $d;
    }
}
