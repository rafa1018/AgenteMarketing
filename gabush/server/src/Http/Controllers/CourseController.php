<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Http\HttpError;
use Gabush\Http\Request;
use Gabush\Http\Router;
use Gabush\Http\Validate;

/** Grade levels, classrooms (with capacity) and the courses of each year, plus staff records. */
final class CourseController extends Controller
{
    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('POST', '/grade-levels', [$c, 'saveGrade']);
        $r->add('PUT', '/grade-levels/{id}', [$c, 'saveGrade']);
        $r->add('POST', '/classrooms', [$c, 'saveRoom']);
        $r->add('PUT', '/classrooms/{id}', [$c, 'saveRoom']);
        $r->add('DELETE', '/classrooms/{id}', [$c, 'deleteRoom']);
        $r->add('GET', '/courses', [$c, 'index']);
        $r->add('GET', '/courses/{id}', [$c, 'show']);
        $r->add('POST', '/courses', [$c, 'saveCourse']);
        $r->add('PUT', '/courses/{id}', [$c, 'saveCourse']);
        $r->add('DELETE', '/courses/{id}', [$c, 'deleteCourse']);
        $r->add('POST', '/staff', [$c, 'saveStaff']);
        $r->add('PUT', '/staff/{id}', [$c, 'saveStaff']);
    }

    public function saveGrade(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico');
        $v = Validate::of($req);
        $row = ['name' => $v->str('name', 40, true, 'El nombre'), 'sort' => $v->int('sort', 0, 99) ?? 0, 'min_age_months' => $v->int('minAgeMonths', 0, 120), 'max_age_months' => $v->int('maxAgeMonths', 0, 120), 'active' => $v->bool('active', true)];
        $v->check();
        $id = $this->persist('grade_levels', $row, self::optionalId($req));
        $this->audit()->log($actor, 'grade_level.save', 'grade_level', $id, $row);
        return ['id' => $id];
    }

    public function saveRoom(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico');
        $v = Validate::of($req);
        $row = ['name' => $v->str('name', 60, true, 'El nombre'), 'capacity' => $v->int('capacity', 1, 99, true) ?? 12, 'location' => $v->str('location', 80), 'active' => $v->bool('active', true)];
        $v->check();
        $id = self::optionalId($req);
        if ($this->db()->value('SELECT id FROM classrooms WHERE name = ? AND id <> ?', [$row['name'], $id ?? 0])) $v->fail('name', 'Ya existe un salón con ese nombre.');
        $v->check();
        $id = $this->persist('classrooms', $row, $id);
        $this->audit()->log($actor, 'classroom.save', 'classroom', $id, $row);
        return ['id' => $id];
    }

    public function deleteRoom(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico');
        $id = $req->intParam('id');
        if ($this->db()->value('SELECT 1 FROM courses WHERE classroom_id = ? LIMIT 1', [$id])) {
            $this->db()->update('classrooms', ['active' => 0], ['id' => $id]); // in use by some course: just deactivate
        } else {
            $this->db()->run('DELETE FROM classrooms WHERE id = ?', [$id]);
        }
        $this->audit()->log($actor, 'classroom.delete', 'classroom', $id);
        return [];
    }

    /** Courses of a year with occupancy (enrolled vs capacity) and the director's name. */
    public function index(Request $req): array
    {
        $this->staff($req);
        $year = $this->year($req);
        $rows = $this->db()->all(
            "SELECT c.id, c.name, c.alias, c.capacity, c.shift, c.active, g.id AS gradeLevelId, g.name AS gradeLevel,
                    r.id AS classroomId, r.name AS classroom, s.id AS directorId, s.full_name AS director,
                    SUM(e.status = 'activo') AS active_students, SUM(e.status = 'prematricula') AS pre, SUM(e.status = 'retirado') AS withdrawn
             FROM courses c
             JOIN grade_levels g ON g.id = c.grade_level_id
             LEFT JOIN classrooms r ON r.id = c.classroom_id
             LEFT JOIN staff s ON s.id = c.director_staff_id
             LEFT JOIN enrollments e ON e.course_id = c.id
             WHERE c.year_id = ?
             GROUP BY c.id ORDER BY g.sort, c.name",
            [$year],
        );
        return ['year' => $year, 'courses' => array_map(static fn($r) => self::ints($r, 'id', 'capacity', 'active', 'gradeLevelId', 'classroomId', 'directorId', 'active_students', 'pre', 'withdrawn'), $rows)];
    }

    /** Course roster (students with their status) and its subjects/teachers. */
    public function show(Request $req): array
    {
        $this->staff($req);
        $id = $req->intParam('id');
        $course = $this->db()->one('SELECT c.*, g.name AS grade_level FROM courses c JOIN grade_levels g ON g.id = c.grade_level_id WHERE c.id = ?', [$id]) ?? throw HttpError::notFound();
        $students = $this->db()->all(
            "SELECT s.id, s.code, s.first_name AS firstName, s.middle_name AS middleName, s.last_name AS lastName, s.second_last_name AS secondLastName,
                    s.birth_date AS birthDate, s.gender, s.photo_path IS NOT NULL AS hasPhoto, e.id AS enrollmentId, e.status, e.order_number AS orderNumber
             FROM enrollments e JOIN students s ON s.id = e.student_id
             WHERE e.course_id = ? ORDER BY e.status = 'retirado', s.last_name, s.first_name",
            [$id],
        );
        $subjects = $this->db()->all(
            'SELECT cs.id, sub.id AS subjectId, sub.name AS subject, st.id AS teacherId, st.full_name AS teacher
             FROM course_subjects cs JOIN subjects sub ON sub.id = cs.subject_id LEFT JOIN staff st ON st.id = cs.teacher_staff_id
             WHERE cs.course_id = ? ORDER BY sub.name',
            [$id],
        );
        return ['course' => self::ints($course, 'id', 'year_id', 'grade_level_id', 'classroom_id', 'capacity', 'director_staff_id', 'active'), 'students' => self::intsAll($students, 'id', 'enrollmentId', 'orderNumber', 'hasPhoto'), 'subjects' => self::intsAll($subjects, 'id', 'subjectId', 'teacherId')];
    }

    public function saveCourse(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico');
        $v = Validate::of($req);
        $row = [
            'year_id' => $v->int('yearId', 2000, 2100, true),
            'grade_level_id' => $v->int('gradeLevelId', 1, null, true),
            'name' => $v->str('name', 60, true, 'El nombre'),
            'alias' => $v->str('alias', 40),
            'classroom_id' => $v->int('classroomId', 1),
            'capacity' => $v->int('capacity', 1, 99) ?? 12,
            'director_staff_id' => $v->int('directorId', 1),
            'shift' => $v->oneOf('shift', ['manana', 'tarde', 'completa']),
            'active' => $v->bool('active', true),
        ];
        $v->check();
        $id = $req->param('id') !== '' ? $req->intParam('id') : null;
        if ($this->db()->value('SELECT id FROM courses WHERE year_id = ? AND name = ? AND id <> ?', [$row['year_id'], $row['name'], $id ?? 0])) {
            $v->fail('name', 'Ese curso ya existe en el año.');
            $v->check();
        }
        $id = $this->persist('courses', $row, $id);
        // subjects of the course: [{subjectId, teacherId}]
        if ($v->has('subjects')) {
            $this->db()->transaction(function ($db) use ($id, $v): void {
                $keep = [];
                foreach ($v->arr('subjects') as $s) {
                    $sid = (int) ($s['subjectId'] ?? 0);
                    if ($sid <= 0) continue;
                    $keep[] = $sid;
                    $db->run('INSERT INTO course_subjects (course_id, subject_id, teacher_staff_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE teacher_staff_id = VALUES(teacher_staff_id)', [$id, $sid, ($s['teacherId'] ?? null) ?: null]);
                }
                $db->run('DELETE FROM course_subjects WHERE course_id = ?' . ($keep ? ' AND subject_id NOT IN (' . implode(',', $keep) . ')' : ''), [$id]);
            });
        }
        $this->audit()->log($actor, 'course.save', 'course', $id, $row);
        return ['id' => $id];
    }

    public function deleteCourse(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico');
        $id = $req->intParam('id');
        if ($this->db()->value('SELECT 1 FROM enrollments WHERE course_id = ? LIMIT 1', [$id])) {
            throw HttpError::conflict('in_use', 'El curso tiene estudiantes: muévelos a otro curso o desactívalo.');
        }
        $this->db()->run('DELETE FROM courses WHERE id = ?', [$id]);
        $this->audit()->log($actor, 'course.delete', 'course', $id);
        return [];
    }

    public function saveStaff(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico', 'usuarios');
        $v = Validate::of($req);
        $row = ['full_name' => $v->str('name', 120, true, 'El nombre'), 'phone' => $v->str('phone', 40), 'email' => $v->email('email'), 'position' => $v->str('position', 60), 'user_id' => $v->str('userId', 64), 'active' => $v->bool('active', true)];
        $v->check();
        $id = $this->persist('staff', $row, self::optionalId($req));
        $this->audit()->log($actor, 'staff.save', 'staff', $id, $row);
        return ['id' => $id];
    }
}
