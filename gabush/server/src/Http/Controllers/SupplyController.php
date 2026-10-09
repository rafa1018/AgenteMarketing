<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Http\Auth\FamilyAuth;
use Gabush\Http\HttpError;
use Gabush\Http\Request;
use Gabush\Http\Router;
use Gabush\Http\Validate;

/**
 * Lista de útiles escolares por año y grado (or one for every grade). The school manages it in Matrículas;
 * families see the published list of their child's year and grade in the app.
 */
final class SupplyController extends Controller
{
    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/supplies', [$c, 'index']);
        $r->add('PUT', '/supplies', [$c, 'save']);
        $r->add('DELETE', '/supplies/{id}', [$c, 'delete']);
        $r->add('POST', '/supplies/copy', [$c, 'copy']);
        $r->add('GET', '/portal/supplies', [$c, 'forFamily']);
    }

    /** ?year= → the lists of the year (one per grade, plus the one for every grade). */
    public function index(Request $req): array
    {
        $this->staff($req, 'matriculas', 'academico');
        $year = $this->year($req);
        $rows = $this->db()->all(
            'SELECT l.id, l.grade_level_id AS gradeLevelId, g.name AS grade, l.notes, l.items, l.published, l.updated_by AS updatedBy, l.updated_at AS updatedAt
             FROM supply_lists l LEFT JOIN grade_levels g ON g.id = l.grade_level_id WHERE l.year_id = ? ORDER BY l.grade_level_id IS NOT NULL, g.sort',
            [$year],
        );
        return ['year' => $year, 'lists' => array_map(fn($r) => self::decode($r), $rows)];
    }

    /** {year, gradeLevelId|null, notes, items:[{name, qty, note}], published} */
    public function save(Request $req): array
    {
        $actor = $this->staffWrite($req, 'matriculas', 'academico');
        $v = Validate::of($req);
        $year = $v->int('year', 2000, 2100, true);
        $grade = $v->int('gradeLevelId', 1);
        $notes = $v->text('notes', 2000);
        $published = $v->bool('published', false);
        $raw = $v->arr('items');
        $v->check();
        if (!$this->db()->value('SELECT 1 FROM academic_years WHERE id = ?', [$year])) throw HttpError::validation(['year' => 'Ese año no existe.']);
        $items = [];
        foreach ($raw as $it) {
            $name = mb_substr(trim((string) ($it['name'] ?? '')), 0, 120);
            if ($name === '') continue;
            $items[] = ['name' => $name, 'qty' => mb_substr(trim((string) ($it['qty'] ?? '')), 0, 30), 'note' => mb_substr(trim((string) ($it['note'] ?? '')), 0, 160)];
        }
        if ($published && !$items) throw HttpError::validation(['items' => 'Agrega al menos un artículo antes de publicar.']);
        $row = ['notes' => $notes ?: null, 'items' => json_encode($items, JSON_UNESCAPED_UNICODE), 'published' => $published ? 1 : 0, 'updated_by' => $actor->label()];
        $id = $this->db()->value('SELECT id FROM supply_lists WHERE year_id = ? AND grade_level_id <=> ?', [$year, $grade]);
        if ($id) {
            $this->db()->update('supply_lists', $row, ['id' => $id]);
        } else {
            $id = $this->db()->insert('supply_lists', $row + ['year_id' => $year, 'grade_level_id' => $grade]);
        }
        $this->audit()->log($actor, 'supplies.save', 'supply_list', $id, ['year' => $year, 'grade' => $grade, 'items' => count($items), 'published' => $published]);
        return ['id' => (int) $id];
    }

    public function delete(Request $req): array
    {
        $actor = $this->staffWrite($req, 'matriculas', 'academico');
        $this->db()->run('DELETE FROM supply_lists WHERE id = ?', [$req->intParam('id')]);
        $this->audit()->log($actor, 'supplies.delete', 'supply_list', $req->intParam('id'));
        return [];
    }

    /** {from, to}: copies the lists of a year to another (not published), skipping grades that already have one. */
    public function copy(Request $req): array
    {
        $actor = $this->staffWrite($req, 'matriculas', 'academico');
        $v = Validate::of($req);
        $from = $v->int('from', 2000, 2100, true);
        $to = $v->int('to', 2000, 2100, true);
        $v->check();
        if (!$this->db()->value('SELECT 1 FROM academic_years WHERE id = ?', [$to])) throw HttpError::validation(['to' => 'Ese año no existe.']);
        $n = 0;
        foreach ($this->db()->all('SELECT grade_level_id, notes, items FROM supply_lists WHERE year_id = ?', [$from]) as $l) {
            if ($this->db()->value('SELECT 1 FROM supply_lists WHERE year_id = ? AND grade_level_id <=> ?', [$to, $l['grade_level_id']])) continue;
            $this->db()->insert('supply_lists', ['year_id' => $to, 'grade_level_id' => $l['grade_level_id'], 'notes' => $l['notes'], 'items' => $l['items'], 'published' => 0, 'updated_by' => $actor->label()]);
            $n++;
        }
        $this->audit()->log($actor, 'supplies.copy', 'supply_list', null, compact('from', 'to', 'n'));
        return ['copied' => $n];
    }

    /**
     * Family: the published lists of the years the child is enrolled or pre-enrolled in, from the current one on
     * (so a family enrolled for next year already sees next year's list): the list of the grade, and the one for
     * every grade.
     */
    public function forFamily(Request $req): array
    {
        $f = FamilyAuth::require($req);
        $current = $this->settings()->activeYear();
        $enrollments = $this->db()->all(
            "SELECT e.year_id, c.name AS course, c.grade_level_id, g.name AS grade FROM enrollments e
             LEFT JOIN courses c ON c.id = e.course_id LEFT JOIN grade_levels g ON g.id = c.grade_level_id
             WHERE e.student_id = ? AND e.year_id >= ? AND e.status IN ('activo','prematricula') ORDER BY e.year_id",
            [$f->studentId, $current],
        );
        $out = [];
        foreach ($enrollments as $e) {
            $lists = $this->db()->all(
                'SELECT l.id, l.grade_level_id AS gradeLevelId, g.name AS grade, l.notes, l.items, l.published, l.updated_at AS updatedAt
                 FROM supply_lists l LEFT JOIN grade_levels g ON g.id = l.grade_level_id
                 WHERE l.year_id = ? AND l.published = 1 AND (l.grade_level_id IS NULL OR l.grade_level_id <=> ?) ORDER BY l.grade_level_id IS NOT NULL',
                [$e['year_id'], $e['grade_level_id']],
            );
            if ($lists) $out[] = ['year' => (int) $e['year_id'], 'course' => $e['course'], 'grade' => $e['grade'], 'lists' => array_map(fn($r) => self::decode($r), $lists)];
        }
        return ['years' => $out];
    }

    /** @param array<string,mixed> $r */
    private static function decode(array $r): array
    {
        $r['id'] = (int) $r['id'];
        $r['gradeLevelId'] = $r['gradeLevelId'] !== null ? (int) $r['gradeLevelId'] : null;
        $r['published'] = (bool) $r['published'];
        $r['items'] = json_decode((string) $r['items'], true) ?: [];
        return $r;
    }
}
