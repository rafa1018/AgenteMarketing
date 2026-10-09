<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Domain\Shared\DomainError;
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
        $r->add('DELETE', '/areas/{id}', [$c, 'deleteArea']);
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
        if ($this->db()->value('SELECT id FROM areas WHERE name = ? AND id <> ?', [$row['name'], self::optionalId($req) ?? 0])) $v->fail('name', 'Ya existe una dimensión con ese nombre.');
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

    /** Only a dimension without subjects (move its subjects to another one first). */
    public function deleteArea(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico');
        $id = $req->intParam('id');
        $n = (int) $this->db()->value('SELECT COUNT(*) FROM subjects WHERE area_id = ?', [$id]);
        if ($n > 0) throw new DomainError('in_use', "Esta dimensión tiene $n materia(s). Pásalas a otra dimensión antes de eliminarla.");
        $this->db()->run('DELETE FROM areas WHERE id = ?', [$id]);
        $this->audit()->log($actor, 'area.delete', 'area', $id);
        return [];
    }

    /**
     * [{id?, name, min, max}] ordered from lowest to highest; levels left out of the list are removed when no
     * grade nor achievement uses them. Ranges must not overlap ("No clasificado" 0–0 is allowed).
     */
    public function saveLevels(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico');
        $v = Validate::of($req);
        $levels = $v->arr('levels');
        $v->check();
        $rows = [];
        foreach (array_values($levels) as $l) {
            $name = mb_substr(trim((string) ($l['name'] ?? '')), 0, 40);
            if ($name === '') continue;
            $min = round((float) str_replace(',', '.', (string) ($l['min'] ?? 0)), 1);
            $max = round((float) str_replace(',', '.', (string) ($l['max'] ?? 0)), 1);
            if ($min < 0 || $max > 100 || $min > $max) throw new DomainError('range', "Revisa el rango de «{$name}»: de 0 a 100 y el mínimo no puede ser mayor que el máximo.");
            $rows[] = ['id' => (int) ($l['id'] ?? 0), 'name' => $name, 'min_score' => $min, 'max_score' => $max];
        }
        if (!$rows) throw new DomainError('empty', 'Deja al menos un nivel de desempeño.');
        if (count(array_unique(array_map('mb_strtolower', array_column($rows, 'name')))) !== count($rows)) throw new DomainError('dup', 'Hay dos niveles con el mismo nombre.');
        $graded = array_values(array_filter($rows, static fn($r) => $r['max_score'] > 0));
        usort($graded, static fn($a, $b) => $a['min_score'] <=> $b['min_score']);
        for ($i = 1; $i < count($graded); $i++) {
            if ($graded[$i]['min_score'] <= $graded[$i - 1]['max_score']) throw new DomainError('overlap', "Los rangos de «{$graded[$i - 1]['name']}» y «{$graded[$i]['name']}» se cruzan.");
        }
        $this->db()->transaction(function ($db) use ($rows): void {
            $keep = [];
            usort($rows, static fn($a, $b) => [$a['min_score'], $a['max_score']] <=> [$b['min_score'], $b['max_score']]);
            // names are unique: park the current ones first so renames/swaps don't collide
            $before = array_column($db->all('SELECT id, name FROM performance_levels'), 'name', 'id');
            $db->run("UPDATE performance_levels SET name = CONCAT('~', id)");
            foreach ($rows as $i => $r) {
                $row = ['name' => $r['name'], 'min_score' => $r['min_score'], 'max_score' => $r['max_score'], 'sort' => $i + 1];
                if ($r['id'] && $db->value('SELECT 1 FROM performance_levels WHERE id = ?', [$r['id']])) {
                    $db->update('performance_levels', $row, ['id' => $r['id']]);
                    $keep[] = $r['id'];
                } else {
                    $keep[] = (int) $db->insert('performance_levels', $row);
                }
            }
            foreach ($db->all("SELECT id FROM performance_levels WHERE name LIKE '~%'") as $old) {
                $used = (int) $db->value(
                    'SELECT (SELECT COUNT(*) FROM grade_entries WHERE performance_level_id = ?) + (SELECT COUNT(*) FROM achievements WHERE performance_level_id = ?) + (SELECT COUNT(*) FROM grade_entry_achievements WHERE performance_level_id = ?)',
                    [$old['id'], $old['id'], $old['id']],
                );
                $name = $before[$old['id']] ?? '';
                if ($used) throw new DomainError('in_use', "«{$name}» ya está en notas o logros: no se puede quitar (puedes cambiarle el nombre o el rango).");
                $db->run('DELETE FROM performance_levels WHERE id = ?', [$old['id']]);
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
                    a.description, a.active, a.created_by AS createdBy, a.created_at AS createdAt, a.owner_user_id IS NOT NULL AS byTeacher,
                    (SELECT COUNT(*) FROM grade_entry_achievements gea WHERE gea.achievement_id = a.id) AS used
             FROM achievements a WHERE ' . implode(' AND ', $where) . ' ORDER BY a.grade_level_id, a.subject_id, a.period_number, a.description LIMIT 1000',
            $p,
        );
        return ['achievements' => self::intsAll($rows, 'id', 'gradeLevelId', 'subjectId', 'period', 'levelId', 'active', 'used', 'byTeacher')];
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
        if (!$actor->can('academico')) {
            // a teacher: only for the grades of the courses she directs, and only her own achievements
            if ($id) $this->assertOwnAchievement($actor, $id);
            $mine = $this->db()->value(
                'SELECT 1 FROM course_subjects cs JOIN courses c ON c.id = cs.course_id JOIN staff s ON s.id = cs.teacher_staff_id
                 WHERE s.user_id = ? AND c.grade_level_id = ? AND cs.subject_id = ? LIMIT 1',
                [$actor->id, $row['grade_level_id'], $row['subject_id']],
            );
            if (!$mine) throw new DomainError('not_your_subject', 'Solo puedes crear logros de las materias que tienes asignadas en ese grado.');
        }
        if (!$id) {
            $row['created_by'] = $actor->label();
            $row['owner_user_id'] = $actor->can('academico') ? null : $actor->id;
        }
        $id = $this->persist('achievements', $row, $id);
        $this->audit()->log($actor, 'achievement.save', 'achievement', $id);
        return ['id' => $id];
    }

    public function deleteAchievement(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico', 'calificaciones');
        $id = $req->intParam('id');
        if (!$actor->can('academico')) $this->assertOwnAchievement($actor, $id);
        if ($this->db()->value('SELECT 1 FROM grade_entry_achievements WHERE achievement_id = ? LIMIT 1', [$id])) {
            $this->db()->update('achievements', ['active' => 0], ['id' => $id]); // used in report cards: hide it, keep history
        } else {
            $this->db()->run('DELETE FROM achievements WHERE id = ?', [$id]) ?: throw HttpError::notFound();
        }
        $this->audit()->log($actor, 'achievement.delete', 'achievement', $id);
        return [];
    }

    /** The bank of the rectora is read-only for teachers: they change only the achievements they created. */
    private function assertOwnAchievement(\Gabush\Application\Shared\Actor $a, int $id): void
    {
        $owner = $this->db()->one('SELECT owner_user_id FROM achievements WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        if ($owner['owner_user_id'] !== $a->id) throw new DomainError('not_yours', 'Solo puedes cambiar los logros que tú creaste. Los del banco del jardín los maneja la rectora.');
    }
}
