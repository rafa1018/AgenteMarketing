<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Application\Notifications\Notifier;
use Gabush\Http\HttpError;
use Gabush\Http\Request;
use Gabush\Http\Router;
use Gabush\Http\Validate;

/** Daily attendance per course (presente / ausente / justificada / tarde) and each student's history. */
final class AttendanceController extends Controller
{
    public const STATES = ['presente', 'ausente', 'justificada', 'tarde'];

    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/attendance', [$c, 'day']);
        $r->add('PUT', '/attendance', [$c, 'save']);
        $r->add('GET', '/attendance/summary', [$c, 'summary']);
        $r->add('GET', '/students/{id}/attendance', [$c, 'history']);
    }

    /** ?date=YYYY-MM-DD&course=ID → the course roster with the day's marks. */
    public function day(Request $req): array
    {
        $this->staff($req, 'asistencia');
        $date = (string) $req->query('date', date('Y-m-d'));
        $course = (int) $req->query('course');
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !$course) throw HttpError::validation(['date' => 'Elige el curso y la fecha.']);
        $rows = $this->db()->all(
            "SELECT s.id, s.code, s.first_name AS firstName, s.last_name AS lastName, s.second_last_name AS secondLastName, s.photo_path IS NOT NULL AS hasPhoto,
                    a.status, a.note, a.recorded_by AS recordedBy, a.recorded_at AS recordedAt
             FROM enrollments e JOIN students s ON s.id = e.student_id
             LEFT JOIN attendance a ON a.student_id = s.id AND a.day = ?
             WHERE e.course_id = ? AND e.status = 'activo' ORDER BY s.first_name, s.last_name",
            [$date, $course],
        );
        return ['date' => $date, 'course' => $course, 'students' => self::intsAll($rows, 'id', 'hasPhoto')];
    }

    /** {date, items:[{studentId, status, note}]} — families get a notice for ausente / tarde (once a day). */
    public function save(Request $req): array
    {
        $actor = $this->staffWrite($req, 'asistencia');
        $v = Validate::of($req);
        $date = $v->date('date', true);
        $items = $v->arr('items');
        $notify = $v->bool('notify', true);
        $v->check();
        if ($date > date('Y-m-d')) throw HttpError::validation(['date' => 'No se puede tomar asistencia de un día futuro.']);
        $changed = [];
        $this->db()->transaction(function ($db) use ($items, $date, $actor, &$changed): void {
            foreach ($items as $it) {
                $sid = (int) ($it['studentId'] ?? 0);
                $status = (string) ($it['status'] ?? '');
                if ($sid <= 0) continue;
                if ($status === '') { $db->run('DELETE FROM attendance WHERE student_id = ? AND day = ?', [$sid, $date]); continue; }
                if (!in_array($status, self::STATES, true)) continue;
                $before = $db->value('SELECT status FROM attendance WHERE student_id = ? AND day = ?', [$sid, $date]);
                $db->run(
                    'INSERT INTO attendance (student_id, day, status, note, recorded_by) VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note), recorded_by = VALUES(recorded_by)',
                    [$sid, $date, $status, mb_substr(trim((string) ($it['note'] ?? '')), 0, 200) ?: null, $actor->label()],
                );
                if ($before !== $status) $changed[] = [$sid, $status];
            }
        });
        if ($notify && $date === date('Y-m-d')) {
            $n = Notifier::from($this->app);
            foreach ($changed as [$sid, $status]) if (in_array($status, ['ausente', 'tarde'], true)) $n->absence($sid, $date, $status);
        }
        $this->audit()->log($actor, 'attendance.save', 'attendance', $date, ['items' => count($items)]);
        return ['saved' => count($items)];
    }

    /** Counts per student for a course and month (or the whole year). */
    public function summary(Request $req): array
    {
        $this->staff($req, 'asistencia');
        $course = (int) $req->query('course');
        $from = (string) $req->query('from', date('Y-m-01'));
        $to = (string) $req->query('to', date('Y-m-t'));
        $rows = $this->db()->all(
            "SELECT s.id, s.code, s.first_name AS firstName, s.last_name AS lastName,
                    SUM(a.status = 'presente') AS presente, SUM(a.status = 'ausente') AS ausente, SUM(a.status = 'justificada') AS justificada, SUM(a.status = 'tarde') AS tarde
             FROM enrollments e JOIN students s ON s.id = e.student_id
             LEFT JOIN attendance a ON a.student_id = s.id AND a.day BETWEEN ? AND ?
             WHERE e.course_id = ? AND e.status = 'activo' GROUP BY s.id ORDER BY s.first_name",
            [$from, $to, $course],
        );
        $days = array_column($this->db()->all('SELECT DISTINCT a.day FROM attendance a JOIN enrollments e ON e.student_id = a.student_id WHERE e.course_id = ? AND a.day BETWEEN ? AND ? ORDER BY a.day', [$course, $from, $to]), 'day');
        return ['from' => $from, 'to' => $to, 'days' => $days, 'students' => self::intsAll($rows, 'id', 'presente', 'ausente', 'justificada', 'tarde')];
    }

    public function history(Request $req): array
    {
        $this->staff($req, 'asistencia', 'estudiantes');
        return self::historyOf($this->app, $req->intParam('id'), $this->year($req));
    }

    /** Shared with the portal. @return array<string,mixed> */
    public static function historyOf(App $app, int $studentId, int $year): array
    {
        $rows = $app->db()->all('SELECT day, status, note FROM attendance WHERE student_id = ? AND YEAR(day) = ? ORDER BY day DESC', [$studentId, $year]);
        $count = array_count_values(array_column($rows, 'status'));
        return ['year' => $year, 'days' => $rows, 'totals' => ['presente' => $count['presente'] ?? 0, 'ausente' => $count['ausente'] ?? 0, 'justificada' => $count['justificada'] ?? 0, 'tarde' => $count['tarde'] ?? 0]];
    }
}
