<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Domain\Shared\DomainError;
use Gabush\Http\HttpError;
use Gabush\Http\Request;
use Gabush\Http\Router;
use Gabush\Http\Validate;

/** Academic years and their periods: create the next year (copying courses and prices), activate, close. */
final class AcademicYearController extends Controller
{
    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/years', [$c, 'index']);
        $r->add('POST', '/years', [$c, 'create']);
        $r->add('PUT', '/years/{id}', [$c, 'update']);
        $r->add('POST', '/years/{id}/activate', [$c, 'activate']);
        $r->add('PUT', '/periods/{id}', [$c, 'updatePeriod']);
    }

    public function index(Request $req): array
    {
        $this->staff($req);
        $rows = $this->db()->all(
            "SELECT y.id, y.name, y.starts_on AS startsOn, y.ends_on AS endsOn, y.status,
                    (SELECT COUNT(*) FROM enrollments e WHERE e.year_id = y.id AND e.status = 'activo') AS active,
                    (SELECT COUNT(*) FROM enrollments e WHERE e.year_id = y.id AND e.status = 'retirado') AS withdrawn,
                    (SELECT COUNT(*) FROM enrollments e WHERE e.year_id = y.id AND e.status = 'prematricula') AS pre,
                    (SELECT COUNT(*) FROM courses c WHERE c.year_id = y.id) AS courses
             FROM academic_years y ORDER BY y.id DESC"
        );
        $periods = $this->db()->all('SELECT id, year_id AS yearId, number, name, starts_on AS startsOn, ends_on AS endsOn, weight, grading_open AS gradingOpen, published FROM periods ORDER BY year_id DESC, number');
        $byYear = [];
        foreach ($periods as $p) $byYear[(int) $p['yearId']][] = self::ints($p, 'id', 'yearId', 'number', 'gradingOpen', 'published');
        return ['years' => array_map(fn($y) => self::ints($y, 'id', 'active', 'withdrawn', 'pre', 'courses') + ['periods' => $byYear[(int) $y['id']] ?? []], $rows)];
    }

    /** New academic year: 4 periods, courses copied from the previous year (and its prices, if asked). */
    public function create(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico');
        $v = Validate::of($req);
        $year = $v->int('year', 2020, 2100, true);
        $start = $v->date('startsOn');
        $end = $v->date('endsOn');
        $copyFrom = $v->int('copyFrom');
        $copyPrices = $v->bool('copyPrices', true);
        $v->check();
        if ($this->db()->value('SELECT 1 FROM academic_years WHERE id = ?', [$year])) {
            throw HttpError::conflict('exists', "El año $year ya existe.");
        }
        $this->db()->transaction(function ($db) use ($year, $start, $end, $copyFrom, $copyPrices): void {
            $db->insert('academic_years', ['id' => $year, 'name' => "Año académico $year", 'starts_on' => $start ?? "$year-02-01", 'ends_on' => $end ?? "$year-11-30", 'status' => 'planned']);
            for ($p = 1; $p <= 4; $p++) $db->insert('periods', ['year_id' => $year, 'number' => $p, 'name' => "Periodo $p", 'weight' => 25]);
            if ($copyFrom) {
                $db->run('INSERT INTO courses (year_id, grade_level_id, name, alias, classroom_id, capacity, director_staff_id, shift, active)
                          SELECT ?, grade_level_id, name, alias, classroom_id, capacity, director_staff_id, shift, active FROM courses WHERE year_id = ?', [$year, $copyFrom]);
                $db->run('INSERT INTO course_subjects (course_id, subject_id, teacher_staff_id, weekly_hours)
                          SELECT nc.id, cs.subject_id, cs.teacher_staff_id, cs.weekly_hours FROM course_subjects cs
                          JOIN courses oc ON oc.id = cs.course_id AND oc.year_id = ?
                          JOIN courses nc ON nc.year_id = ? AND nc.name = oc.name', [$copyFrom, $year]);
                if ($copyPrices) {
                    $db->run('INSERT INTO prices (year_id, concept_id, grade_level_id, amount, months) SELECT ?, concept_id, grade_level_id, amount, months FROM prices WHERE year_id = ?', [$year, $copyFrom]);
                }
            }
        });
        $this->audit()->log($actor, 'year.create', 'academic_year', $year, ['copyFrom' => $copyFrom]);
        return $this->index($req);
    }

    public function update(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico');
        $id = $req->intParam('id');
        $v = Validate::of($req);
        $row = array_filter([
            'name' => $v->str('name', 40),
            'starts_on' => $v->date('startsOn'),
            'ends_on' => $v->date('endsOn'),
            'status' => $v->oneOf('status', ['planned', 'active', 'closed']),
        ], static fn($x) => $x !== null);
        $v->check();
        if (($row['status'] ?? null) === 'active') return $this->activate($req);
        if ($row) $this->db()->update('academic_years', $row, ['id' => $id]);
        $this->audit()->log($actor, 'year.update', 'academic_year', $id, $row);
        return $this->index($req);
    }

    /** Only one active year: the one the panel and the families see by default. */
    public function activate(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico');
        $id = $req->intParam('id');
        if (!$this->db()->value('SELECT 1 FROM academic_years WHERE id = ?', [$id])) throw HttpError::notFound();
        $this->db()->transaction(function ($db) use ($id): void {
            $db->run("UPDATE academic_years SET status = 'closed' WHERE status = 'active' AND id <> ?", [$id]);
            $db->run("UPDATE academic_years SET status = 'active' WHERE id = ?", [$id]);
        });
        $this->audit()->log($actor, 'year.activate', 'academic_year', $id);
        return $this->index($req);
    }

    public function updatePeriod(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico');
        $id = $req->intParam('id');
        $v = Validate::of($req);
        $row = array_filter([
            'name' => $v->str('name', 40),
            'starts_on' => $v->date('startsOn'),
            'ends_on' => $v->date('endsOn'),
            'weight' => $v->decimal('weight', 0, 100),
        ], static fn($x) => $x !== null);
        if ($v->has('gradingOpen')) $row['grading_open'] = $v->bool('gradingOpen');
        if ($v->has('published')) $row['published'] = $v->bool('published');
        $v->check();
        if (isset($row['starts_on'], $row['ends_on']) && $row['starts_on'] > $row['ends_on']) {
            throw new DomainError('dates', 'La fecha de inicio debe ser anterior a la de cierre.');
        }
        if ($row) $this->db()->update('periods', $row, ['id' => $id]);
        $this->audit()->log($actor, 'period.update', 'period', $id, $row);
        return $this->index($req);
    }
}
