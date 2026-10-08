<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Http\HttpError;
use Gabush\Http\Request;
use Gabush\Http\Router;
use Gabush\Http\Validate;

/** Cash flow: boxes, income/expense concepts and movements (student payments enter automatically). */
final class CashController extends Controller
{
    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/cash', [$c, 'index']);
        $r->add('POST', '/cash/movements', [$c, 'saveMovement']);
        $r->add('PUT', '/cash/movements/{id}', [$c, 'saveMovement']);
        $r->add('DELETE', '/cash/movements/{id}', [$c, 'deleteMovement']);
        $r->add('POST', '/cash/concepts', [$c, 'saveConcept']);
        $r->add('PUT', '/cash/concepts/{id}', [$c, 'saveConcept']);
        $r->add('POST', '/cash/boxes', [$c, 'saveBox']);
        $r->add('PUT', '/cash/boxes/{id}', [$c, 'saveBox']);
    }

    /** ?from&to&kind&concept → movements, totals by concept, balance of every box, month by month of the year. */
    public function index(Request $req): array
    {
        $this->staff($req, 'caja');
        $from = (string) $req->query('from', date('Y-m-01'));
        $to = (string) $req->query('to', date('Y-m-t'));
        $where = 'm.occurred_on BETWEEN ? AND ?';
        $p = [$from, $to];
        if (in_array($req->query('kind'), ['ingreso', 'egreso'], true)) { $where .= ' AND m.kind = ?'; $p[] = $req->query('kind'); }
        if ($req->query('concept')) { $where .= ' AND m.concept_id = ?'; $p[] = (int) $req->query('concept'); }
        if ($req->query('box')) { $where .= ' AND m.box_id = ?'; $p[] = (int) $req->query('box'); }
        $db = $this->db();
        $moves = $db->all(
            "SELECT m.id, m.kind, m.amount, m.occurred_on AS date, m.description, m.payment_id AS paymentId, m.created_by AS createdBy, m.created_at AS createdAt,
                    c.id AS conceptId, c.name AS concept, b.id AS boxId, b.name AS box
             FROM cash_movements m JOIN cash_boxes b ON b.id = m.box_id LEFT JOIN cash_concepts c ON c.id = m.concept_id
             WHERE $where ORDER BY m.occurred_on DESC, m.id DESC LIMIT 2000",
            $p,
        );
        $byConcept = $db->all("SELECT m.kind, COALESCE(c.name, 'Sin concepto') AS concept, SUM(m.amount) AS amount FROM cash_movements m LEFT JOIN cash_concepts c ON c.id = m.concept_id WHERE $where GROUP BY m.kind, concept ORDER BY m.kind, amount DESC", $p);
        $year = (int) substr($from, 0, 4);
        $monthly = $db->all("SELECT DATE_FORMAT(occurred_on, '%Y-%m') AS month, SUM(kind = 'ingreso') AS nin, SUM(CASE WHEN kind = 'ingreso' THEN amount ELSE 0 END) AS income, SUM(CASE WHEN kind = 'egreso' THEN amount ELSE 0 END) AS expense FROM cash_movements WHERE YEAR(occurred_on) = ? GROUP BY month ORDER BY month", [$year]);
        $boxes = $db->all("SELECT b.id, b.name, b.active, COALESCE(SUM(CASE WHEN m.kind = 'ingreso' THEN m.amount ELSE -m.amount END), 0) AS balance FROM cash_boxes b LEFT JOIN cash_movements m ON m.box_id = b.id GROUP BY b.id ORDER BY b.id");
        $concepts = $db->all('SELECT id, kind, name, description, active FROM cash_concepts ORDER BY kind, name');
        $income = array_sum(array_map(static fn($m) => $m['kind'] === 'ingreso' ? (int) $m['amount'] : 0, $moves));
        $expense = array_sum(array_map(static fn($m) => $m['kind'] === 'egreso' ? (int) $m['amount'] : 0, $moves));
        return [
            'from' => $from, 'to' => $to, 'income' => $income, 'expense' => $expense, 'net' => $income - $expense,
            'movements' => self::intsAll($moves, 'id', 'amount', 'paymentId', 'conceptId', 'boxId'),
            'byConcept' => self::intsAll($byConcept, 'amount'),
            'monthly' => self::intsAll($monthly, 'nin', 'income', 'expense'),
            'boxes' => self::intsAll($boxes, 'id', 'active', 'balance'),
            'concepts' => self::intsAll($concepts, 'id', 'active'),
        ];
    }

    public function saveMovement(Request $req): array
    {
        $actor = $this->staffWrite($req, 'caja');
        $v = Validate::of($req);
        $row = [
            'kind' => $v->oneOf('kind', ['ingreso', 'egreso'], null, true),
            'box_id' => $v->int('boxId', 1) ?? (int) $this->db()->value('SELECT id FROM cash_boxes WHERE active = 1 ORDER BY id LIMIT 1'),
            'concept_id' => $v->int('conceptId', 1),
            'amount' => $v->money('amount', true),
            'occurred_on' => $v->date('date') ?? date('Y-m-d'),
            'description' => $v->str('description', 300),
        ];
        $v->check();
        $id = self::optionalId($req);
        if ($id && $this->db()->value('SELECT payment_id FROM cash_movements WHERE id = ?', [$id])) {
            throw HttpError::conflict('payment', 'Este ingreso viene de un pago de un estudiante: se corrige desde la cartera.');
        }
        if (!$id) $row['created_by'] = $actor->label();
        $id = $this->persist('cash_movements', $row, $id);
        $this->audit()->log($actor, 'cash.save', 'cash_movement', $id, $row);
        return ['id' => $id];
    }

    public function deleteMovement(Request $req): array
    {
        $actor = $this->staffWrite($req, 'caja');
        $id = $req->intParam('id');
        $m = $this->db()->one('SELECT * FROM cash_movements WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        if ($m['payment_id']) throw HttpError::conflict('payment', 'Este ingreso viene de un pago: anúlalo desde la cartera.');
        $this->db()->run('DELETE FROM cash_movements WHERE id = ?', [$id]);
        $this->audit()->log($actor, 'cash.delete', 'cash_movement', $id, $m);
        return [];
    }

    public function saveConcept(Request $req): array
    {
        $actor = $this->staffWrite($req, 'caja');
        $v = Validate::of($req);
        $row = ['kind' => $v->oneOf('kind', ['ingreso', 'egreso'], null, true), 'name' => $v->str('name', 80, true, 'El nombre'), 'description' => $v->str('description', 300), 'active' => $v->bool('active', true)];
        $v->check();
        $id = $this->persist('cash_concepts', $row, self::optionalId($req));
        $this->audit()->log($actor, 'cash_concept.save', 'cash_concept', $id);
        return ['id' => $id];
    }

    public function saveBox(Request $req): array
    {
        $actor = $this->staffWrite($req, 'caja');
        $v = Validate::of($req);
        $row = ['name' => $v->str('name', 60, true, 'El nombre'), 'active' => $v->bool('active', true)];
        $v->check();
        $id = $this->persist('cash_boxes', $row, self::optionalId($req));
        $this->audit()->log($actor, 'cash_box.save', 'cash_box', $id);
        return ['id' => $id];
    }
}
