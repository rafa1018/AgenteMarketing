<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Http\Request;
use Gabush\Http\Router;

/** One call with every catalog the panel needs to draw its forms (years, courses, subjects, concepts…). */
final class SetupController extends Controller
{
    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/setup', [$c, 'show']);
    }

    public function show(Request $req): array
    {
        $actor = $this->staff($req);
        $year = $this->year($req);
        $db = $this->db();
        $me = $db->one('SELECT id, full_name FROM staff WHERE user_id = ? AND active = 1', [$actor->id]);
        // subjects of each course this year (Gestión académica → Cursos → Materias del curso)
        $courseSubjects = [];
        foreach ($db->all('SELECT cs.course_id, cs.subject_id FROM course_subjects cs JOIN courses c ON c.id = cs.course_id WHERE c.year_id = ?', [$year]) as $r) {
            $courseSubjects[(int) $r['course_id']][] = (int) $r['subject_id'];
        }
        return [
            // who is working: their staff record and, for teachers, the courses they direct this year (null = all)
            'me' => ['staffId' => $me ? (int) $me['id'] : null, 'staffName' => $me['full_name'] ?? null, 'courses' => $this->myCourses($actor, $year), 'subjects' => ($s = $this->mySubjects($actor, $year)) === null ? null : (object) $s],
            'courseSubjects' => (object) $courseSubjects,
            'activeYear' => $this->settings()->activeYear(),
            'year' => $year,
            'years' => self::intsAll($db->all('SELECT id, name, starts_on AS startsOn, ends_on AS endsOn, status FROM academic_years ORDER BY id DESC'), 'id'),
            'periods' => self::intsAll($db->all('SELECT id, number, name, starts_on AS startsOn, ends_on AS endsOn, weight, grading_open AS gradingOpen, published FROM periods WHERE year_id = ? ORDER BY number', [$year]), 'id', 'number', 'gradingOpen', 'published'),
            'gradeLevels' => self::intsAll($db->all('SELECT id, name, sort, min_age_months AS minAgeMonths, max_age_months AS maxAgeMonths, active FROM grade_levels ORDER BY sort, name'), 'id', 'sort', 'active'),
            'classrooms' => self::intsAll($db->all('SELECT id, name, capacity, location, active FROM classrooms ORDER BY name'), 'id', 'capacity', 'active'),
            'courses' => self::intsAll($db->all(
                "SELECT c.id, c.name, c.alias, c.grade_level_id AS gradeLevelId, c.classroom_id AS classroomId, c.capacity, c.director_staff_id AS directorId, c.shift, c.active,
                        (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status IN ('activo','prematricula')) AS enrolled
                 FROM courses c JOIN grade_levels g ON g.id = c.grade_level_id WHERE c.year_id = ? ORDER BY g.sort, c.name",
                [$year],
            ), 'id', 'gradeLevelId', 'classroomId', 'capacity', 'directorId', 'active', 'enrolled'),
            'staff' => self::intsAll($db->all('SELECT id, full_name AS name, position, phone, email, user_id AS userId, active FROM staff ORDER BY active DESC, full_name'), 'id', 'active'),
            'areas' => self::intsAll($db->all('SELECT id, name, report_position AS position FROM areas ORDER BY report_position, name'), 'id', 'position'),
            'subjects' => self::intsAll($db->all('SELECT id, name, area_id AS areaId, active FROM subjects ORDER BY name'), 'id', 'areaId', 'active'),
            'levels' => self::intsAll($db->all('SELECT id, name, min_score AS min, max_score AS max FROM performance_levels ORDER BY sort'), 'id'),
            'concepts' => self::intsAll($db->all('SELECT id, code, name, frequency, apply_on_enrollment AS onEnrollment, late_fee_applies AS lateFee, online_payable AS online, active FROM billing_concepts ORDER BY id'), 'id', 'onEnrollment', 'lateFee', 'online', 'active'),
            'documentTypes' => self::intsAll($db->all('SELECT id, name, description, required, applies_to AS appliesTo, family_can_upload AS familyUpload, sort, active FROM document_types ORDER BY sort, name'), 'id', 'required', 'familyUpload', 'sort', 'active'),
            'school' => $this->settings()->get('school', ['name' => 'Jardín Infantil Gabush', 'nit' => '', 'address' => 'Manzana E 19-12A, Urbanización Colombia, Valledupar', 'phone' => '+57 322 834 7109', 'email' => 'gabushjardin@gmail.com']),
        ];
    }
}
