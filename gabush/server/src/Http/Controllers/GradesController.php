<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Application\Academics\GradesService;
use Gabush\Application\Notifications\Notifier;
use Gabush\Domain\Shared\DomainError;
use Gabush\Http\Auth\FamilyAuth;
use Gabush\Http\HttpError;
use Gabush\Http\Response;
use Gabush\Http\Views\BoletinView;
use Gabush\Http\Request;
use Gabush\Http\Router;
use Gabush\Http\Validate;

/** Grade sheets (teachers) and report cards (panel); publishing a period notifies the families. */
final class GradesController extends Controller
{
    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/grades/sheet', [$c, 'sheet']);
        $r->add('PUT', '/grades/sheet', [$c, 'saveSheet']);
        $r->add('GET', '/grades/progress', [$c, 'progress']);
        $r->add('GET', '/students/{id}/report-card', [$c, 'reportCard']);
        $r->add('POST', '/periods/{id}/publish', [$c, 'publish']);
        $r->add('POST', '/grades/publish', [$c, 'publishCourse']);
        $r->add('GET', '/students/{id}/boletin', [$c, 'boletin']);
        $r->add('GET', '/courses/{id}/boletines', [$c, 'courseBoletines']);
        $r->add('POST', '/students/{id}/boletin/event', [$c, 'boletinEvent']);
        $r->add('GET', '/grades/notes', [$c, 'notes']);
        $r->add('PUT', '/grades/notes', [$c, 'saveNote']);
    }

    // ───────────────────────── general observations of the report card ─────────────────────────
    /** ?student=&year= → the child's enrollment and their general observation per period ('final' = informe final). */
    public function notes(Request $req): array
    {
        $actor = $this->staff($req, 'calificaciones', 'academico');
        $year = $this->year($req);
        $e = $this->db()->one('SELECT e.id, e.course_id, c.name AS course FROM enrollments e LEFT JOIN courses c ON c.id = e.course_id WHERE e.student_id = ? AND e.year_id = ?', [(int) $req->query('student'), $year]) ?? throw HttpError::notFound();
        $this->assertMyCourse($actor, (int) $e['course_id']);
        $notes = [];
        foreach ($this->db()->all('SELECT period_id, body FROM report_card_notes WHERE enrollment_id = ?', [$e['id']]) as $n) {
            $notes[(int) $n['period_id'] === 0 ? 'final' : (string) $n['period_id']] = $n['body'];
        }
        return ['enrollmentId' => (int) $e['id'], 'courseId' => $e['course_id'] !== null ? (int) $e['course_id'] : null, 'course' => $e['course'], 'notes' => (object) $notes];
    }

    /** {enrollmentId, periodId (id or 'final'), body}: empty body removes it. */
    public function saveNote(Request $req): array
    {
        $actor = $this->staffWrite($req, 'calificaciones', 'academico');
        $v = Validate::of($req);
        $enrollment = $v->int('enrollmentId', 1, null, true);
        $body = trim((string) $v->str('body', 2000));
        $v->check();
        $raw = (string) ($req->input('periodId') ?? '');
        $en = $this->db()->one('SELECT year_id, course_id FROM enrollments WHERE id = ?', [$enrollment]) ?? throw HttpError::notFound();
        $this->assertMyCourse($actor, (int) $en['course_id']);
        $year = (int) $en['year_id'];
        if ($raw === 'final') {
            $period = 0;
        } else {
            $p = $this->db()->one('SELECT id, grading_open FROM periods WHERE id = ? AND year_id = ?', [(int) $raw, $year]) ?? throw HttpError::validation(['periodId' => 'Elige el periodo.']);
            if (!$p['grading_open'] && !$actor->can('academico')) throw new DomainError('closed', 'Este periodo está cerrado. Pídele a la rectora que lo abra.');
            $period = (int) $p['id'];
        }
        if ($body === '') {
            $this->db()->run('DELETE FROM report_card_notes WHERE enrollment_id = ? AND period_id = ?', [$enrollment, $period]);
        } else {
            $this->db()->run(
                'INSERT INTO report_card_notes (enrollment_id, period_id, body, updated_by) VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE body = VALUES(body), updated_by = VALUES(updated_by)',
                [$enrollment, $period, $body, $actor->label()],
            );
        }
        $this->audit()->log($actor, 'grades.note', 'enrollment', $enrollment, ['period' => $raw]);
        return ['saved' => true];
    }

    /** A teacher (no "academico" nor "estudiantes") only opens report cards of the children of her courses. */
    private function assertMyStudent(\Gabush\Application\Shared\Actor $a, int $studentId, int $year): void
    {
        if ($a->can('academico') || $a->can('estudiantes')) return;
        $this->assertMyCourse($a, (int) $this->db()->value('SELECT course_id FROM enrollments WHERE student_id = ? AND year_id = ?', [$studentId, $year]));
    }

    /** General observation of each student for the report card being printed. @return array<int,string> student id → text */
    private function notesFor(array $studentIds, int $year, int|string $period): array
    {
        if (!$studentIds) return [];
        $in = implode(',', array_fill(0, count($studentIds), '?'));
        $rows = $this->db()->all(
            "SELECT e.student_id, n.body FROM report_card_notes n JOIN enrollments e ON e.id = n.enrollment_id WHERE e.year_id = ? AND n.period_id = ? AND e.student_id IN ($in)",
            [$year, $period === 'final' ? 0 : $period, ...$studentIds],
        );
        return array_column($rows, 'body', 'student_id');
    }

    // ───────────────────────── printable report cards ─────────────────────────
    /** ?year=&period=<id>|final — staff, or the family of that student (published periods only). */
    public function boletin(Request $req): Response
    {
        $id = $req->intParam('id');
        $family = FamilyAuth::current();
        $isFamily = $family && $family->studentId === $id;
        $actor = $isFamily ? null : $this->staff($req, 'calificaciones', 'academico', 'estudiantes');
        $year = $this->year($req);
        if ($actor) $this->assertMyStudent($actor, $id, $year);
        $card = $this->card($id, $year, $isFamily);
        $period = $this->pickPeriod($req, $card['reportCard']);
        $o = $this->boletinOptions($year, $period, $card['reportCard'], $card['student']['code']);
        if (!$isFamily) {
            // staff: a WhatsApp message to the guardian, ready to send (they can attach the downloaded PDF)
            $g = $this->db()->one('SELECT g.full_name, g.phone FROM guardians g JOIN students s ON s.family_id = g.family_id WHERE s.id = ? AND g.phone IS NOT NULL ORDER BY g.is_primary DESC, g.is_billing DESC, g.id LIMIT 1', [$id]);
            $phone = substr((string) preg_replace('/\D/', '', (string) ($g['phone'] ?? '')), -10);
            if (strlen($phone) === 10) {
                $text = 'Hola ' . trim(explode(' ', (string) $g['full_name'])[0]) . ', te compartimos el boletín de ' . $o['periodName'] . ' ' . $year . ' de ' . $card['student']['name']
                    . '. También lo puedes ver y descargar en el portal de familias: https://gabushkids.com/familia/ — Jardín Infantil Gabush';
                $o['whatsapp'] = 'https://wa.me/57' . $phone . '?text=' . rawurlencode($text);
            }
        }
        // audit: who opened it; the page reports downloads / shares / prints back to boletinEvent
        $viewer = $isFamily ? ['familia', (string) $id, 'Familia (' . $family->name . ')'] : ['personal', $actor->id, $actor->name];
        (new \Gabush\Application\Shared\AccessAudit($this->db()))->boletin($id, $year, (string) $period, $o['periodName'], $viewer[0], $viewer[1], $viewer[2], 'ver');
        $o['track'] = '/api/v2/students/' . $id . '/boletin/event?' . http_build_query(['year' => $year, 'period' => $period]);
        $note = $this->notesFor([$id], $year, $period)[$id] ?? null;
        return Response::html(BoletinView::render([$card + ['general' => $this->general($card['reportCard'], $period), 'note' => $note]], $o));
    }

    /**
     * ?year=&period= {action: descargar|compartir|imprimir} — sent by the report card page itself, so the
     * school knows the family downloaded it. Only the family of that student or staff who can open it.
     */
    public function boletinEvent(Request $req): array
    {
        $id = $req->intParam('id');
        $family = FamilyAuth::current();
        $isFamily = $family && $family->studentId === $id;
        $actor = $isFamily ? null : $this->staff($req, 'calificaciones', 'academico', 'estudiantes');
        $action = (string) ($req->json()['action'] ?? '');
        if (!in_array($action, ['descargar', 'compartir', 'imprimir'], true)) throw HttpError::validation(['action' => 'Acción no válida.']);
        $year = $this->year($req);
        $period = (string) $req->query('period', '');
        $name = $period === 'final' ? 'Informe final' : $this->db()->value('SELECT name FROM periods WHERE id = ? AND year_id = ?', [(int) $period, $year]);
        if ($name === null) throw HttpError::validation(['period' => 'Periodo no válido.']);
        $viewer = $isFamily ? ['familia', (string) $id, 'Familia (' . $family->name . ')'] : ['personal', $actor->id, $actor->name];
        (new \Gabush\Application\Shared\AccessAudit($this->db()))->boletin($id, $year, $period, (string) $name, $viewer[0], $viewer[1], $viewer[2], $action);
        return [];
    }

    /** Every active student of a course, one page each. ?period=<id>|final */
    public function courseBoletines(Request $req): Response
    {
        $actor = $this->staff($req, 'calificaciones', 'academico');
        $course = $this->db()->one('SELECT id, name, year_id FROM courses WHERE id = ?', [$req->intParam('id')]) ?? throw HttpError::notFound();
        $this->assertMyCourse($actor, (int) $course['id']);
        $year = (int) $course['year_id'];
        $ids = array_column($this->db()->all("SELECT e.student_id FROM enrollments e JOIN students s ON s.id = e.student_id WHERE e.course_id = ? AND e.status = 'activo' ORDER BY s.last_name, s.first_name", [$course['id']]), 'student_id');
        $cards = array_map(fn($sid) => $this->card((int) $sid, $year, false), $ids);
        $period = $this->pickPeriod($req, $cards[0]['reportCard'] ?? ['periods' => []]);
        $notes = $this->notesFor(array_map('intval', $ids), $year, $period);
        foreach ($cards as &$c) {
            $c['general'] = $this->general($c['reportCard'], $period);
            $c['note'] = $notes[$c['student']['id']] ?? null;
        }
        unset($c);
        return Response::html(BoletinView::render($cards, $this->boletinOptions($year, $period, $cards[0]['reportCard'] ?? ['periods' => []], 'curso-' . $course['name'])));
    }

    /** @return array{student:array<string,mixed>,reportCard:array<string,mixed>} */
    private function card(int $studentId, int $year, bool $onlyPublished): array
    {
        $s = $this->db()->one(
            'SELECT s.*, c.name AS course, st.full_name AS director, st.signature_path AS director_signature FROM students s
             LEFT JOIN enrollments e ON e.student_id = s.id AND e.year_id = ? LEFT JOIN courses c ON c.id = e.course_id LEFT JOIN staff st ON st.id = c.director_staff_id
             WHERE s.id = ?',
            [$year, $studentId],
        ) ?? throw HttpError::notFound();
        $files = new \Gabush\Infrastructure\Storage\PrivateFiles($this->app->dataDir());
        $photo = $s['photo_path'] && $files->exists($s['photo_path']) ? 'data:' . $files->mime($s['photo_path']) . ';base64,' . base64_encode((string) file_get_contents($files->path($s['photo_path']))) : null;
        return [
            'student' => [
                'id' => (int) $s['id'], 'code' => $s['code'], 'course' => $s['course'], 'director' => $s['director'], 'photo' => $photo,
                'directorSignature' => \Gabush\Application\Billing\Signature::dataUri($files, $s['director_signature']),
                'name' => trim(implode(' ', array_filter([$s['first_name'], $s['middle_name'], $s['last_name'], $s['second_last_name']]))),
                'initials' => mb_strtoupper(mb_substr((string) $s['first_name'], 0, 1) . mb_substr((string) $s['last_name'], 0, 1)),
                'doc' => trim(($s['doc_type'] ? $s['doc_type'] . ' ' : '') . ($s['doc_number'] ?? '')) ?: null,
            ],
            'reportCard' => $this->grades()->reportCard($studentId, $year, $onlyPublished),
        ];
    }

    /** ?period=<id> when it belongs to the year, 'final', else the last period that has grades. */
    private function pickPeriod(Request $req, array $rc): int|string
    {
        $q = (string) $req->query('period', '');
        if ($q === 'final') return 'final';
        $ids = array_map(static fn($p) => (int) $p['id'], $rc['periods'] ?? []);
        if (ctype_digit($q) && in_array((int) $q, $ids, true)) return (int) $q;
        $withGrades = [];
        foreach ($rc['areas'] ?? [] as $a) foreach ($a['subjects'] as $s) foreach (array_keys($s['periods']) as $pid) $withGrades[(int) $pid] = true;
        $last = null;
        foreach ($ids as $id) if (isset($withGrades[$id])) $last = $id;
        return $last ?? ($ids ? end($ids) : 'final');
    }

    /** Overall level of the card for the period: the subject level repeated most (ties → the higher one). */
    private function general(array $rc, int|string $period): ?string
    {
        $rules = $this->grades()->reportCardRules();
        $byName = array_column($this->db()->all('SELECT id, name FROM performance_levels'), 'id', 'name');
        $ids = [];
        foreach ($rc['areas'] as $a) foreach ($a['subjects'] as $s) {
            $name = $period === 'final' ? ($s['final'] ?? null) : ($s['periods'][$period]['level'] ?? null);
            if ($name && isset($byName[$name])) $ids[] = (int) $byName[$name];
        }
        return $rules->name($rules->levelOfAchievements($ids));
    }

    /** @return array<string,mixed> */
    private function boletinOptions(int $year, int|string $period, array $rc, string $fileName): array
    {
        $name = 'Informe final';
        foreach ($rc['periods'] ?? [] as $p) if ($p['id'] === $period) $name = $p['name'];
        $months = [1 => 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        return [
            'period' => $period, 'periodName' => $name, 'year' => $year,
            'school' => $this->settings()->get('school', ['name' => 'Jardín Infantil Gabush']),
            'levels' => $this->db()->all('SELECT name, min_score AS min, max_score AS max FROM performance_levels WHERE max_score > 0 ORDER BY min_score'),
            'percent' => (float) $this->db()->value('SELECT MAX(max_score) FROM performance_levels') > 10, // 0–100 scale → "90%"
            'signature' => \Gabush\Application\Billing\Signature::from($this->app)->get(),
            'issuedOn' => (int) date('j') . ' de ' . $months[(int) date('n')] . ' de ' . date('Y'),
            'fileName' => 'boletin-' . $fileName . '-' . ($period === 'final' ? 'final' : $name) . '-' . $year,
        ];
    }

    /**
     * {courseId, periodId, published}: the teacher publishes (or hides) the report cards of ONE course for a
     * period; publishing notifies the families of that course.
     */
    public function publishCourse(Request $req): array
    {
        $actor = $this->staffWrite($req, 'calificaciones', 'academico');
        $v = Validate::of($req);
        $course = $v->int('courseId', 1, null, true);
        $period = $v->int('periodId', 1, null, true);
        $publish = $v->bool('published', true);
        $v->check();
        $c = $this->db()->one('SELECT c.id, c.name, c.year_id FROM courses c JOIN periods p ON p.year_id = c.year_id AND p.id = ? WHERE c.id = ?', [$period, $course]) ?? throw HttpError::notFound();
        $this->assertMyCourse($actor, $course);
        $was = (bool) $this->db()->value('SELECT 1 FROM course_period_publications WHERE course_id = ? AND period_id = ?', [$course, $period]);
        if ($publish && !$was) {
            $this->db()->run('INSERT INTO course_period_publications (course_id, period_id, published_by) VALUES (?, ?, ?)', [$course, $period, $actor->label()]);
            $name = (string) $this->db()->value('SELECT name FROM periods WHERE id = ?', [$period]);
            $n = Notifier::from($this->app);
            foreach ($this->db()->all("SELECT student_id FROM enrollments WHERE course_id = ? AND status = 'activo'", [$course]) as $e) {
                $n->gradesPublished((int) $e['student_id'], $name);
            }
        } elseif (!$publish) {
            $this->db()->run('DELETE FROM course_period_publications WHERE course_id = ? AND period_id = ?', [$course, $period]);
        }
        $this->audit()->log($actor, $publish ? 'grades.publish' : 'grades.unpublish', 'course', $course, ['period' => $period]);
        return ['published' => $publish];
    }

    private function grades(): GradesService
    {
        return GradesService::from($this->app);
    }

    /** ?course=&subject=&period= */
    public function sheet(Request $req): array
    {
        $actor = $this->staff($req, 'calificaciones', 'academico');
        $course = (int) $req->query('course');
        $subject = (int) $req->query('subject');
        $period = (int) $req->query('period');
        if (!$course || !$subject || !$period) throw HttpError::validation(['course' => 'Elige curso, materia y periodo.']);
        $this->assertMyCourse($actor, $course);
        $this->assertMySubject($actor, $course, $subject);
        $sheet = $this->grades()->sheet($course, $subject, $period) ?: throw HttpError::notFound();
        // which achievements this user may edit or delete: all for the rectora, her own for a teacher
        $ids = array_column($sheet['achievements'], 'id');
        $own = $ids ? array_map('intval', array_column($this->db()->all(
            'SELECT id FROM achievements WHERE owner_user_id = ? AND id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')',
            [$actor->id, ...$ids],
        ), 'id')) : [];
        foreach ($sheet['achievements'] as &$a) $a['editable'] = $actor->can('academico') || in_array((int) $a['id'], $own, true);
        unset($a);
        // the final observation of each child's report card for this period (same text in every subject sheet)
        $eids = array_column($sheet['students'], 'enrollmentId');
        $notes = $eids ? array_column($this->db()->all(
            'SELECT enrollment_id, body FROM report_card_notes WHERE period_id = ? AND enrollment_id IN (' . implode(',', array_fill(0, count($eids), '?')) . ')',
            [$period, ...$eids],
        ), 'body', 'enrollment_id') : [];
        foreach ($sheet['students'] as &$s) $s['note'] = $notes[$s['enrollmentId']] ?? '';
        unset($s);
        return $sheet;
    }

    public function saveSheet(Request $req): array
    {
        $actor = $this->staffWrite($req, 'calificaciones', 'academico');
        $v = Validate::of($req);
        $subject = $v->int('subjectId', 1, null, true);
        $period = $v->int('periodId', 1, null, true);
        $rows = $v->arr('rows');
        $v->check();
        $open = $this->db()->value('SELECT grading_open FROM periods WHERE id = ?', [$period]);
        if (!$open && !$actor->can('academico')) throw new DomainError('closed', 'Este periodo está cerrado para calificar. Pídele a la rectora que lo abra.');
        // every row must be a child of one of the user's courses
        $courses = array_unique(array_map('intval', array_column($this->db()->all(
            'SELECT DISTINCT course_id FROM enrollments WHERE id IN (' . implode(',', array_fill(0, max(1, count($rows)), '?')) . ')',
            $rows ? array_map(static fn($r) => (int) ($r['enrollmentId'] ?? 0), $rows) : [0],
        ), 'course_id')));
        foreach ($courses as $cid) {
            $this->assertMyCourse($actor, $cid);
            $this->assertMySubject($actor, $cid, (int) $subject);
        }
        $n = $this->grades()->saveSheet($subject, $period, $rows, $actor->label());
        // rows may carry the child's final observation of the period ("note"): saved for the whole report card
        foreach ($rows as $r) {
            if (!is_array($r) || !array_key_exists('note', $r) || empty($r['enrollmentId'])) continue;
            $body = mb_substr(trim((string) $r['note']), 0, 2000);
            if ($body === '') {
                $this->db()->run('DELETE FROM report_card_notes WHERE enrollment_id = ? AND period_id = ?', [(int) $r['enrollmentId'], $period]);
            } else {
                $this->db()->run(
                    'INSERT INTO report_card_notes (enrollment_id, period_id, body, updated_by) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE body = VALUES(body), updated_by = VALUES(updated_by)',
                    [(int) $r['enrollmentId'], $period, $body, $actor->label()],
                );
            }
        }
        $this->audit()->log($actor, 'grades.save', 'period', $period, ['subject' => $subject, 'rows' => $n]);
        return ['saved' => $n];
    }

    /** How complete the grading of a period is, per course and subject (for the rectora). */
    public function progress(Request $req): array
    {
        $this->staff($req, 'calificaciones', 'academico');
        $period = (int) $req->query('period');
        $rows = $this->db()->all(
            "SELECT c.id AS courseId, c.name AS course, sub.id AS subjectId, sub.name AS subject, st.full_name AS teacher,
                    (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'activo') AS students,
                    (SELECT COUNT(*) FROM grade_entries ge JOIN enrollments e ON e.id = ge.enrollment_id WHERE e.course_id = c.id AND e.status = 'activo' AND ge.subject_id = sub.id AND ge.period_id = p.id AND ge.performance_level_id IS NOT NULL) AS graded
             FROM periods p JOIN courses c ON c.year_id = p.year_id
             JOIN course_subjects cs ON cs.course_id = c.id JOIN subjects sub ON sub.id = cs.subject_id LEFT JOIN staff st ON st.id = cs.teacher_staff_id
             WHERE p.id = ? ORDER BY c.name, sub.name",
            [$period],
        );
        return ['progress' => self::intsAll($rows, 'courseId', 'subjectId', 'students', 'graded')];
    }

    public function reportCard(Request $req): array
    {
        $actor = $this->staff($req, 'calificaciones', 'academico', 'estudiantes');
        $this->assertMyStudent($actor, $req->intParam('id'), $this->year($req));
        return ['reportCard' => $this->grades()->reportCard($req->intParam('id'), $this->year($req))];
    }

    /** Publish (or hide) a period's report cards for the families; publishing sends a notice to each family. */
    public function publish(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico');
        $id = $req->intParam('id');
        $p = $this->db()->one('SELECT id, year_id, name, published FROM periods WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        $v = Validate::of($req);
        $publish = $v->bool('published', true);
        $this->db()->update('periods', ['published' => $publish, 'grading_open' => $publish ? 0 : 1], ['id' => $id]);
        if ($publish && !$p['published']) {
            $n = Notifier::from($this->app);
            foreach ($this->db()->all("SELECT student_id FROM enrollments WHERE year_id = ? AND status = 'activo'", [$p['year_id']]) as $e) {
                $n->gradesPublished((int) $e['student_id'], $p['name']);
            }
        }
        $this->audit()->log($actor, $publish ? 'period.publish' : 'period.unpublish', 'period', $id);
        return [];
    }
}
