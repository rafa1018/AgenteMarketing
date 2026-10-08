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
        $rows = $this->db()->all('SELECT id, year_id AS year, observed_on AS date, category, body, visible_to_family AS visible, created_by AS createdBy, created_at AS createdAt FROM observations WHERE student_id = ? ORDER BY observed_on DESC, id DESC', [$req->intParam('id')]);
        return ['observations' => self::intsAll($rows, 'id', 'year', 'visible')];
    }

    public function save(Request $req): array
    {
        $actor = $this->staffWrite($req, 'observador');
        $v = Validate::of($req);
        $row = [
            'observed_on' => $v->date('date') ?? date('Y-m-d'),
            'category' => $v->oneOf('category', self::CATEGORIES, 'general'),
            'body' => $v->text('body', 4000, true),
            'visible_to_family' => $v->bool('visible'),
        ];
        $v->check();
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
