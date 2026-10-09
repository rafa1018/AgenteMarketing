<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Application\Shared\Actor;
use Gabush\Application\Shared\Audit;
use Gabush\Application\Shared\Settings;
use Gabush\Http\Auth\StaffAuth;
use Gabush\Http\Request;
use Gabush\Http\Router;
use Gabush\Infrastructure\Database\Database;

/**
 * Base of the module controllers: thin HTTP adapters that authenticate, validate input and delegate to
 * the application services. Each module declares its routes in routes().
 */
abstract class Controller
{
    public function __construct(protected readonly App $app)
    {
    }

    abstract public static function routes(Router $r, App $app): void;

    protected function db(): Database
    {
        return $this->app->db();
    }

    protected function settings(): Settings
    {
        return $this->app->service(Settings::class, static fn(App $a) => new Settings($a->db()));
    }

    protected function audit(): Audit
    {
        return $this->app->service(Audit::class, static fn(App $a) => new Audit($a->db()));
    }

    /**
     * Courses of the year a staff user works on in Calificaciones: everything for the rectora (permission
     * "academico"); otherwise the courses where the person linked to that user (Usuarios → Ficha de personal)
     * is group director or teaches a subject. No link or nothing assigned → none.
     * @return list<int>|null null = every course
     */
    protected function myCourses(Actor $a, int $year): ?array
    {
        if ($a->can('academico')) return null;
        return array_map('intval', array_column($this->db()->all(
            'SELECT c.id FROM courses c JOIN staff s ON s.user_id = ? AND s.active = 1
             WHERE c.year_id = ? AND c.active = 1 AND (c.director_staff_id = s.id OR EXISTS (SELECT 1 FROM course_subjects cs WHERE cs.course_id = c.id AND cs.teacher_staff_id = s.id))
             ORDER BY c.name',
            [$a->id, $year],
        ), 'id'));
    }

    /**
     * Subjects a teacher grades in each of her courses: the ones assigned to her in the course (Gestión académica →
     * Cursos → Materias del curso y docente). @return array<int,list<int>>|null courseId → subject ids; null = all
     */
    protected function mySubjects(Actor $a, int $year): ?array
    {
        if ($a->can('academico')) return null;
        $out = [];
        foreach ($this->db()->all(
            'SELECT cs.course_id, cs.subject_id FROM course_subjects cs JOIN courses c ON c.id = cs.course_id JOIN staff s ON s.id = cs.teacher_staff_id
             WHERE s.user_id = ? AND s.active = 1 AND c.year_id = ?',
            [$a->id, $year],
        ) as $r) $out[(int) $r['course_id']][] = (int) $r['subject_id'];
        return $out;
    }

    /** 403 unless the course is one of the user's (see myCourses). */
    protected function assertMyCourse(Actor $a, int $courseId): void
    {
        if ($a->can('academico')) return;
        $year = (int) $this->db()->value('SELECT year_id FROM courses WHERE id = ?', [$courseId]);
        if (!in_array($courseId, $this->myCourses($a, $year) ?? [], true)) {
            throw new \Gabush\Domain\Shared\DomainError('not_your_course', 'Solo puedes ver los cursos donde eres director(a) de grupo o tienes materias asignadas.');
        }
    }

    /** 403 unless the subject is assigned to the user in that course (see mySubjects). */
    protected function assertMySubject(Actor $a, int $courseId, int $subjectId): void
    {
        if ($a->can('academico')) return;
        $year = (int) $this->db()->value('SELECT year_id FROM courses WHERE id = ?', [$courseId]);
        if (!in_array($subjectId, $this->mySubjects($a, $year)[$courseId] ?? [], true)) {
            throw new \Gabush\Domain\Shared\DomainError('not_your_subject', 'Esa materia no está asignada a ti en este curso. Pídele a la rectora que te la asigne (Gestión académica → Cursos).');
        }
    }

    /** Staff with read access (any of the permissions). */
    protected function staff(Request $req, string ...$perms): Actor
    {
        return StaffAuth::require($req, $perms, false);
    }

    /** Staff allowed to change data (CSRF checked). */
    protected function staffWrite(Request $req, string ...$perms): Actor
    {
        return StaffAuth::require($req, $perms, true);
    }

    /** Update the row when $id is given, insert it otherwise; returns the id. */
    protected function persist(string $table, array $row, ?int $id): int
    {
        if ($id) {
            $this->db()->update($table, $row, ['id' => $id]);
            return $id;
        }
        return $this->db()->insert($table, $row);
    }

    /** Route {id} when present (PUT /x/{id}), null for POST /x. */
    protected static function optionalId(Request $req): ?int
    {
        return $req->param('id') !== '' ? $req->intParam('id') : null;
    }

    /** Year from ?year= or the active one. */
    protected function year(Request $req): int
    {
        $y = $req->query('year');
        return ctype_digit((string) $y) ? (int) $y : $this->settings()->activeYear();
    }

    /** Cast numeric strings coming from PDO rows to int for the listed keys. */
    protected static function ints(array $row, string ...$keys): array
    {
        foreach ($keys as $k) if (isset($row[$k])) $row[$k] = (int) $row[$k];
        return $row;
    }

    protected static function intsAll(array $rows, string ...$keys): array
    {
        return array_map(static fn($r) => self::ints($r, ...$keys), $rows);
    }
}
