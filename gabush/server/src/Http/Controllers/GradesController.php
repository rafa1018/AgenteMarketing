<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Application\Academics\GradesService;
use Gabush\Application\Notifications\Notifier;
use Gabush\Domain\Shared\DomainError;
use Gabush\Http\HttpError;
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
