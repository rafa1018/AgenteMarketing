<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Http\HttpError;
use Gabush\Http\Request;
use Gabush\Http\Router;
use Gabush\Http\Validate;

/** Dimensions (areas), subjects, performance levels and the achievements bank (banco de logros). */
final class AcademicController extends Controller
{
    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('POST', '/areas', [$c, 'saveArea']);
        $r->add('PUT', '/areas/{id}', [$c, 'saveArea']);
        $r->add('POST', '/subjects', [$c, 'saveSubject']);
        $r->add('PUT', '/subjects/{id}', [$c, 'saveSubject']);
        $r->add('PUT', '/levels', [$c, 'saveLevels']);
        $r->add('GET', '/achievements', [$c, 'achievements']);
        $r->add('POST', '/achievements', [$c, 'saveAchievement']);
        $r->add('PUT', '/achievements/{id}', [$c, 'saveAchievement']);
        $r->add('DELETE', '/achievements/{id}', [$c, 'deleteAchievement']);
    }

    public function saveArea(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico');
        $v = Validate::of($req);
        $row = ['name' => $v->str('name', 80, true, 'El nombre'), 'report_position' => $v->int('position', 0, 99) ?? 0];
        $v->check();
        $id = $this->persist('areas', $row, self::optionalId($req));
        $this->audit()->log($actor, 'area.save', 'area', $id, $row);
        return ['id' => $id];
    }

    public function saveSubject(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico');
        $v = Validate::of($req);
        $row = ['name' => $v->str('name', 80, true, 'El nombre'), 'area_id' => $v->int('areaId', 1), 'active' => $v->bool('active', true)];
        $v->check();
        $id = $this->persist('subjects', $row, self::optionalId($req));
        $this->audit()->log($actor, 'subject.save', 'subject', $id, $row);
        return ['id' => $id];
    }

    /** [{id?, name, min, max}] ordered from lowest to highest. */
    public function saveLevels(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico');
        $v = Validate::of($req);
        $levels = $v->arr('levels');
        $v->check();
        $this->db()->transaction(function ($db) use ($levels): void {
            foreach (array_values($levels) as $i => $l) {
                $row = ['name' => mb_substr(trim((string) ($l['name'] ?? '')), 0, 40), 'min_score' => (float) ($l['min'] ?? 0), 'max_score' => (float) ($l['max'] ?? 0), 'sort' => $i + 1];
                if ($row['name'] === '') continue;
                !empty($l['id']) ? $db->update('performance_levels', $row, ['id' => (int) $l['id']]) : $db->insert('performance_levels', $row);
            }
        });
        $this->audit()->log($actor, 'levels.save', 'performance_levels', null);
        return [];
    }

    /** Bank filtered by grade level / subject / period / text, with how many times each one was used. */
    public function achievements(Request $req): array
    {
        $this->staff($req, 'academico', 'calificaciones');
        $where = ['1=1'];
        $p = [];
        foreach (['grade' => 'a.grade_level_id', 'subject' => 'a.subject_id', 'period' => 'a.period_number', 'level' => 'a.performance_level_id'] as $q => $col) {
            if (($val = $req->query($q)) !== null && $val !== '') { $where[] = "$col = ?"; $p[] = (int) $val; }
        }
        if (($t = trim((string) $req->query('q', ''))) !== '') { $where[] = 'a.description LIKE ?'; $p[] = "%$t%"; }
        if ($req->query('active') !== 'all') $where[] = 'a.active = 1';
        $rows = $this->db()->all(
            'SELECT a.id, a.grade_level_id AS gradeLevelId, a.subject_id AS subjectId, a.period_number AS period, a.performance_level_id AS levelId,
                    a.description, a.active, a.created_by AS createdBy, a.created_at AS createdAt,
                    (SELECT COUNT(*) FROM grade_entry_achievements gea WHERE gea.achievement_id = a.id) AS used
             FROM achievements a WHERE ' . implode(' AND ', $where) . ' ORDER BY a.grade_level_id, a.subject_id, a.period_number, a.description LIMIT 1000',
            $p,
        );
        return ['achievements' => self::intsAll($rows, 'id', 'gradeLevelId', 'subjectId', 'period', 'levelId', 'active', 'used')];
    }

    public function saveAchievement(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico', 'calificaciones');
        $v = Validate::of($req);
        $row = [
            'grade_level_id' => $v->int('gradeLevelId', 1, null, true),
            'subject_id' => $v->int('subjectId', 1, null, true),
            'period_number' => $v->int('period', 1, 6),
            'performance_level_id' => $v->int('levelId', 1),
            'description' => $v->text('description', 600, true),
            'active' => $v->bool('active', true),
        ];
        $v->check();
        $id = self::optionalId($req);
        if (!$id) $row['created_by'] = $actor->label();
        $id = $this->persist('achievements', $row, $id);
        $this->audit()->log($actor, 'achievement.save', 'achievement', $id);
        return ['id' => $id];
    }

    public function deleteAchievement(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico', 'calificaciones');
        $id = $req->intParam('id');
        if ($this->db()->value('SELECT 1 FROM grade_entry_achievements WHERE achievement_id = ? LIMIT 1', [$id])) {
            $this->db()->update('achievements', ['active' => 0], ['id' => $id]); // used in report cards: hide it, keep history
        } else {
            $this->db()->run('DELETE FROM achievements WHERE id = ?', [$id]) ?: throw HttpError::notFound();
        }
        $this->audit()->log($actor, 'achievement.delete', 'achievement', $id);
        return [];
    }
}
