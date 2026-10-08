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
    }

    // ───────────────────────── printable report cards ─────────────────────────
    /** ?year=&period=<id>|final — staff, or the family of that student (published periods only). */
    public function boletin(Request $req): Response
    {
        $id = $req->intParam('id');
        $family = FamilyAuth::current();
        $isFamily = $family && $family->studentId === $id;
        if (!$isFamily) $this->staff($req, 'calificaciones', 'academico', 'estudiantes');
        $year = $this->year($req);
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
        return Response::html(BoletinView::render([$card + ['general' => $this->general($card['reportCard'], $period)]], $o));
    }

    /** Every active student of a course, one page each. ?period=<id>|final */
    public function courseBoletines(Request $req): Response
    {
        $this->staff($req, 'calificaciones', 'academico');
        $course = $this->db()->one('SELECT id, name, year_id FROM courses WHERE id = ?', [$req->intParam('id')]) ?? throw HttpError::notFound();
        $year = (int) $course['year_id'];
        $ids = array_column($this->db()->all("SELECT e.student_id FROM enrollments e JOIN students s ON s.id = e.student_id WHERE e.course_id = ? AND e.status = 'activo' ORDER BY s.last_name, s.first_name", [$course['id']]), 'student_id');
        $cards = array_map(fn($sid) => $this->card((int) $sid, $year, false), $ids);
        $period = $this->pickPeriod($req, $cards[0]['reportCard'] ?? ['periods' => []]);
        foreach ($cards as &$c) $c['general'] = $this->general($c['reportCard'], $period);
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
        $this->staff($req, 'calificaciones', 'academico');
        $course = (int) $req->query('course');
        $subject = (int) $req->query('subject');
        $period = (int) $req->query('period');
        if (!$course || !$subject || !$period) throw HttpError::validation(['course' => 'Elige curso, materia y periodo.']);
        return $this->grades()->sheet($course, $subject, $period) ?: throw HttpError::notFound();
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
        $n = $this->grades()->saveSheet($subject, $period, $rows, $actor->label());
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
        $this->staff($req, 'calificaciones', 'academico', 'estudiantes');
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
