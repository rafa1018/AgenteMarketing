<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Application\Notifications\Notifier;
use Gabush\Http\HttpError;
use Gabush\Http\Request;
use Gabush\Http\Router;
use Gabush\Http\Validate;

/** Observador del estudiante: dated notes (health, behaviour, progress…), optionally visible to the family. */
final class ObservationController extends Controller
{
    private const CATEGORIES = ['general', 'salud', 'convivencia', 'logro', 'familia', 'aprendizaje'];

    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/students/{id}/observations', [$c, 'index']);
        $r->add('POST', '/students/{id}/observations', [$c, 'save']);
        $r->add('PUT', '/observations/{id}', [$c, 'save']);
        $r->add('DELETE', '/observations/{id}', [$c, 'delete']);
    }

    public function index(Request $req): array
    {
        $this->staff($req, 'observador', 'estudiantes');
        $rows = $this->db()->all(
            'SELECT o.id, o.year_id AS year, o.period_id AS periodId, p.name AS period, o.observed_on AS date, o.category, o.body,
                    o.improvement_actions AS actions, o.recommendations, o.visible_to_family AS visible, o.created_by AS createdBy, o.created_at AS createdAt
             FROM observations o LEFT JOIN periods p ON p.id = o.period_id WHERE o.student_id = ? ORDER BY o.observed_on DESC, o.id DESC',
            [$req->intParam('id')],
        );
        return ['observations' => self::intsAll($rows, 'id', 'year', 'periodId', 'visible')];
    }

    /** {date, category, periodId, body, actions (acciones de mejora), recommendations, visible} */
    public function save(Request $req): array
    {
        $actor = $this->staffWrite($req, 'observador');
        $v = Validate::of($req);
        $row = [
            'observed_on' => $v->date('date') ?? date('Y-m-d'),
            'category' => $v->oneOf('category', self::CATEGORIES, 'general'),
            'body' => $v->text('body', 4000, true),
            'improvement_actions' => $v->text('actions', 4000) ?: null,
            'recommendations' => $v->text('recommendations', 4000) ?: null,
            'visible_to_family' => $v->bool('visible'),
        ];
        $periodId = $v->int('periodId', 1);
        $v->check();
        // the note belongs to the chosen period (and to its year)
        $periodYear = null;
        if ($periodId) {
            $periodYear = $this->db()->value('SELECT year_id FROM periods WHERE id = ?', [$periodId]) ?? throw HttpError::validation(['periodId' => 'Ese periodo no existe.']);
            $row['period_id'] = $periodId;
            $row['year_id'] = (int) $periodYear;
        }
        $isNew = str_contains($req->path, '/students/');
        if ($isNew) {
            $sid = $req->intParam('id');
            $row += ['student_id' => $sid, 'year_id' => $this->settings()->activeYear(), 'created_by' => $actor->label()];
            $id = $this->db()->insert('observations', $row);
        } else {
            $id = $req->intParam('id');
            $sid = (int) ($this->db()->value('SELECT student_id FROM observations WHERE id = ?', [$id]) ?? throw HttpError::notFound());
            $this->db()->update('observations', $row, ['id' => $id]);
        }
        if ($row['visible_to_family'] && $isNew) {
            Notifier::from($this->app)->toStudent($sid, 'observador', 'Nueva anotación del jardín', mb_substr($row['body'], 0, 140), '/familia/#/observador');
        }
        $this->audit()->log($actor, 'observation.save', 'observation', $id);
        return ['id' => $id];
    }

    public function delete(Request $req): array
    {
        $actor = $this->staffWrite($req, 'observador');
        $id = $req->intParam('id');
        $this->db()->run('DELETE FROM observations WHERE id = ?', [$id]);
        $this->audit()->log($actor, 'observation.delete', 'observation', $id);
        return [];
    }
}
