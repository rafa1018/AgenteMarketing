<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use DateTimeImmutable;
use Gabush\App;
use Gabush\Application\Billing\BillingService;
use Gabush\Domain\Billing\LateFeePolicy;
use Gabush\Domain\Shared\DomainError;
use Gabush\Http\Auth\FamilyAuth;
use Gabush\Http\HttpError;
use Gabush\Http\Request;
use Gabush\Http\Response;
use Gabush\Http\Router;
use Gabush\Http\Validate;
use Gabush\Http\Views\ReceiptView;

/** Cartera in the panel: statements, charges, adjustments, payments, receipts, reports and billing settings. */
final class BillingController extends Controller
{
    private const METHODS = ['efectivo', 'colegio', 'nequi', 'daviplata', 'bancolombia', 'transferencia', 'tarjeta', 'consignacion', 'otro'];

    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/billing/overview', [$c, 'overview']);
        $r->add('GET', '/billing/students/{id}', [$c, 'statement']);
        $r->add('POST', '/billing/students/{id}/apply-credit', [$c, 'applyCredit']);
        $r->add('POST', '/billing/charges', [$c, 'createCharge']);
        $r->add('POST', '/billing/charges/{id}/void', [$c, 'voidCharge']);
        $r->add('POST', '/billing/charges/{id}/adjustments', [$c, 'addAdjustment']);
        $r->add('DELETE', '/billing/adjustments/{id}', [$c, 'deleteAdjustment']);
        $r->add('POST', '/billing/charges/{id}/late-fee', [$c, 'lateFee']);
        $r->add('POST', '/billing/payments', [$c, 'createPayment']);
        $r->add('POST', '/billing/payments/{id}/void', [$c, 'voidPayment']);
        $r->add('GET', '/billing/payments/{id}/receipt', [$c, 'receipt']);
        $r->add('GET', '/billing/payments', [$c, 'paymentsReport']);
        $r->add('GET', '/billing/debtors', [$c, 'debtors']);
        $r->add('POST', '/billing/generate', [$c, 'generate']);
        $r->add('POST', '/billing/late-fees/run', [$c, 'runLateFees']);
        $r->add('GET', '/billing/settings', [$c, 'settingsShow']);
        $r->add('PUT', '/billing/settings', [$c, 'settingsSave']);
        $r->add('GET', '/billing/prices', [$c, 'prices']);
        $r->add('PUT', '/billing/prices', [$c, 'savePrices']);
        $r->add('PUT', '/billing/student-prices', [$c, 'saveStudentPrice']);
        $r->add('POST', '/billing/concepts', [$c, 'saveConcept']);
        $r->add('GET', '/billing/plans', [$c, 'plans']);
        $r->add('POST', '/billing/plans', [$c, 'savePlan']);
        $r->add('PUT', '/billing/plans/{id}', [$c, 'savePlan']);
        $r->add('POST', '/billing/days', [$c, 'chargeDays']);
        $r->add('PUT', '/billing/concepts/{id}', [$c, 'saveConcept']);
    }

    private function billing(): BillingService
    {
        return BillingService::from($this->app);
    }

    /** Totals of the year by month: billed, collected, pending; and today's figures. */
    public function overview(Request $req): array
    {
        $this->staff($req, 'pagos');
        $year = $this->year($req);
        $db = $this->db();
        $billed = $db->all("SELECT DATE_FORMAT(COALESCE(period_month, due_on, created_at), '%Y-%m') AS month, SUM(amount) AS amount FROM charges WHERE year_id = ? AND status <> 'anulado' GROUP BY month ORDER BY month", [$year]);
        $collected = $db->all("SELECT DATE_FORMAT(paid_on, '%Y-%m') AS month, SUM(amount) AS amount, COUNT(*) AS n FROM payments WHERE status = 'aprobado' AND YEAR(paid_on) = ? GROUP BY month ORDER BY month", [$year]);
        $byMethod = $db->all("SELECT method, SUM(amount) AS amount, COUNT(*) AS n FROM payments WHERE status = 'aprobado' AND YEAR(paid_on) = ? GROUP BY method ORDER BY amount DESC", [$year]);
        $debtors = $this->billing()->debtors($year);
        return [
            'year' => $year,
            'billed' => self::intsAll($billed, 'amount'),
            'collected' => self::intsAll($collected, 'amount', 'n'),
            'byMethod' => self::intsAll($byMethod, 'amount', 'n'),
            'pending' => array_sum(array_column($debtors, 'balance')),
            'overdue' => array_sum(array_column($debtors, 'overdue')),
            'debtors' => count($debtors),
            'today' => self::ints($db->one("SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS n FROM payments WHERE status = 'aprobado' AND paid_on = CURDATE()") ?? [], 'amount', 'n'),
            'online' => self::ints($db->one("SELECT COALESCE(SUM(amount), 0) AS amount, COUNT(*) AS n FROM payments WHERE status = 'aprobado' AND source = 'en_linea' AND YEAR(paid_on) = ?", [$year]) ?? [], 'amount', 'n'),
        ];
    }

    public function statement(Request $req): array
    {
        $this->staff($req, 'pagos');
        $id = $req->intParam('id');
        $year = $req->query('year') ? (int) $req->query('year') : null;
        $b = $this->billing();
        return [
            'summary' => $b->summary($id, $year),
            'total' => $b->summary($id),
            'charges' => $b->charges($id, $year),
            'payments' => $b->payments($id, $year),
            'checkouts' => self::intsAll($this->db()->all("SELECT id, reference, provider, amount, status, payment_id AS paymentId, created_at AS createdAt FROM checkouts WHERE student_id = ? ORDER BY id DESC LIMIT 20", [$id]), 'id', 'amount', 'paymentId'),
        ];
    }

    public function applyCredit(Request $req): array
    {
        $actor = $this->staffWrite($req, 'pagos');
        $applied = $this->billing()->applyCredit($req->intParam('id'), $actor);
        return ['applied' => $applied];
    }

    public function createCharge(Request $req): array
    {
        $actor = $this->staffWrite($req, 'pagos');
        $v = Validate::of($req);
        $studentId = $v->int('studentId', 1, null, true);
        $conceptId = $v->int('conceptId', 1, null, true);
        $description = $v->str('description', 160, true, 'La descripción');
        $amount = $v->money('amount', true);
        $dueOn = $v->date('dueOn');
        $year = $v->int('year', 2000, 2100);
        $v->check();
        $id = $this->billing()->createCharge($studentId, $conceptId, $description, $amount, $dueOn, $year, $actor);
        return ['id' => $id];
    }

    public function voidCharge(Request $req): array
    {
        $actor = $this->staffWrite($req, 'pagos');
        $v = Validate::of($req);
        $reason = $v->str('reason', 200, true, 'El motivo');
        $v->check();
        $this->billing()->voidCharge($req->intParam('id'), $reason, $actor);
        return [];
    }

    public function addAdjustment(Request $req): array
    {
        $actor = $this->staffWrite($req, 'pagos');
        $v = Validate::of($req);
        $kind = $v->oneOf('kind', ['descuento', 'recargo'], null, true);
        $amount = $v->money('amount', true);
        $reason = $v->str('reason', 200, true, 'El motivo');
        $v->check();
        $this->billing()->addAdjustment($req->intParam('id'), $kind, $amount, $reason, $actor);
        return [];
    }

    public function deleteAdjustment(Request $req): array
    {
        $actor = $this->staffWrite($req, 'pagos');
        $this->billing()->deleteAdjustment($req->intParam('id'), $actor);
        return [];
    }

    public function lateFee(Request $req): array
    {
        $actor = $this->staffWrite($req, 'pagos');
        $v = Validate::of($req);
        $waive = $v->bool('waive', true);
        $this->billing()->waiveLateFee($req->intParam('id'), $waive, $actor);
        return [];
    }

    public function createPayment(Request $req): array
    {
        $actor = $this->staffWrite($req, 'pagos');
        $v = Validate::of($req);
        $studentId = $v->int('studentId', 1, null, true);
        $amount = $v->money('amount', true);
        $paidOn = $v->date('paidOn') ?? date('Y-m-d');
        $method = $v->oneOf('method', self::METHODS, 'efectivo');
        $reference = $v->str('reference', 120);
        $notes = $v->str('notes', 300);
        $chargeIds = $v->has('chargeIds') ? $v->ids('chargeIds') : null;
        $v->check();
        if ($paidOn > date('Y-m-d')) throw HttpError::validation(['paidOn' => 'La fecha no puede ser futura.']);
        $id = $this->billing()->registerPayment($studentId, $amount, $paidOn, $method, $reference, $notes, $chargeIds ?: null, $actor);
        return ['id' => $id, 'receipt' => $this->billing()->receipt($id)];
    }

    public function voidPayment(Request $req): array
    {
        $actor = $this->staffWrite($req, 'pagos');
        $v = Validate::of($req);
        $reason = $v->str('reason', 200, true, 'El motivo');
        $v->check();
        $this->billing()->voidPayment($req->intParam('id'), $reason, $actor);
        return [];
    }

    /** Printable receipt (HTML) — staff, or the family of that student. */
    public function receipt(Request $req): Response
    {
        $id = $req->intParam('id');
        $r = $this->billing()->receipt($id);
        $family = FamilyAuth::current();
        if (!$family || $family->studentId !== $r['studentId']) $this->staff($req, 'pagos');
        if ($req->query('format') === 'json') return Response::json(['ok' => true, 'receipt' => $r]);
        return Response::html(ReceiptView::render($r));
    }

    public function paymentsReport(Request $req): array
    {
        $this->staff($req, 'pagos');
        $from = (string) $req->query('from', date('Y-m-01'));
        $to = (string) $req->query('to', date('Y-m-d'));
        $params = [$from, $to];
        $where = '';
        if ($m = $req->query('method')) { $where .= ' AND p.method = ?'; $params[] = $m; }
        if ($s = $req->query('source')) { $where .= ' AND p.source = ?'; $params[] = $s; }
        $rows = $this->db()->all(
            "SELECT p.id, p.receipt_number AS receipt, p.paid_on AS paidOn, p.amount, p.method, p.reference, p.status, p.source, p.created_by AS createdBy,
                    s.id AS studentId, s.code, s.first_name AS firstName, s.last_name AS lastName,
                    (SELECT GROUP_CONCAT(c.description ORDER BY pa.id SEPARATOR ' · ') FROM payment_allocations pa JOIN charges c ON c.id = pa.charge_id WHERE pa.payment_id = p.id) AS concepts
             FROM payments p JOIN students s ON s.id = p.student_id
             WHERE p.paid_on BETWEEN ? AND ? $where ORDER BY p.paid_on DESC, p.id DESC LIMIT 2000",
            $params,
        );
        $rows = self::intsAll($rows, 'id', 'amount', 'studentId');
        $ok = array_filter($rows, static fn($r) => $r['status'] === 'aprobado');
        return ['from' => $from, 'to' => $to, 'payments' => $rows, 'total' => array_sum(array_column($ok, 'amount')), 'count' => count($ok)];
    }

    public function debtors(Request $req): array
    {
        $this->staff($req, 'pagos');
        return ['debtors' => $this->billing()->debtors($this->year($req), max(1, (int) $req->query('min', 1)))];
    }

    /** "Generar pensiones del mes" (the cron does it on the 1st; this is for doing it by hand). */
    public function generate(Request $req): array
    {
        $actor = $this->staffWrite($req, 'pagos');
        $v = Validate::of($req);
        $month = $v->str('month', 7) ?? date('Y-m');
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) $v->fail('month', 'Mes inválido (AAAA-MM).');
        $v->check();
        return $this->billing()->generateMonthlyCharges(new DateTimeImmutable("$month-01"), $actor);
    }

    public function runLateFees(Request $req): array
    {
        $actor = $this->staffWrite($req, 'pagos');
        return $this->billing()->applyLateFees($actor);
    }

    public function settingsShow(Request $req): array
    {
        $this->staff($req, 'pagos', 'ajustes');
        return ['lateFee' => $this->billing()->lateFeePolicy()->toArray(), 'pensionMonths' => $this->billing()->pensionMonths()];
    }

    /** Late-fee rule and the months in which the pension is charged. */
    public function settingsSave(Request $req): array
    {
        $actor = $this->staffWrite($req, 'ajustes', 'pagos');
        $v = Validate::of($req);
        $lf = $v->arr('lateFee');
        $months = array_values(array_unique(array_filter(array_map('intval', $v->arr('pensionMonths')), static fn($m) => $m >= 1 && $m <= 12)));
        if ($v->has('pensionMonths') && !$months) $v->fail('pensionMonths', 'Elige al menos un mes.');
        $v->check();
        if ($lf) {
            $policy = LateFeePolicy::fromSettings($lf + $this->billing()->lateFeePolicy()->toArray());
            $this->settings()->set('late_fee', $policy->toArray());
        }
        if ($months) $this->settings()->patch('billing', ['pensionMonths' => $months]);
        $this->audit()->log($actor, 'billing.settings', 'settings', 'billing', ['lateFee' => $lf, 'months' => $months]);
        return $this->settingsShow($req);
    }

    /** Price table of a year: concept × grade level. */
    public function prices(Request $req): array
    {
        $this->staff($req, 'pagos', 'ajustes');
        $year = $this->year($req);
        $rows = $this->db()->all('SELECT id, concept_id AS conceptId, grade_level_id AS gradeLevelId, amount FROM prices WHERE year_id = ?', [$year]);
        $special = $this->db()->all(
            'SELECT sp.id, sp.enrollment_id AS enrollmentId, sp.concept_id AS conceptId, sp.amount, sp.reason, s.id AS studentId, s.code, s.first_name AS firstName, s.last_name AS lastName
             FROM student_prices sp JOIN enrollments e ON e.id = sp.enrollment_id JOIN students s ON s.id = e.student_id WHERE e.year_id = ? ORDER BY s.last_name',
            [$year],
        );
        return ['year' => $year, 'prices' => self::intsAll($rows, 'id', 'conceptId', 'gradeLevelId', 'amount'), 'studentPrices' => self::intsAll($special, 'id', 'enrollmentId', 'conceptId', 'amount', 'studentId')];
    }

    /** [{conceptId, gradeLevelId|null, amount|null}] — null amount removes the price. */
    public function savePrices(Request $req): array
    {
        $actor = $this->staffWrite($req, 'ajustes', 'pagos');
        $v = Validate::of($req);
        $year = $v->int('year', 2000, 2100, true);
        $items = $v->arr('prices');
        $v->check();
        $this->db()->transaction(function ($db) use ($year, $items): void {
            foreach ($items as $p) {
                $concept = (int) ($p['conceptId'] ?? 0);
                $grade = isset($p['gradeLevelId']) && $p['gradeLevelId'] !== null ? (int) $p['gradeLevelId'] : null;
                $amount = isset($p['amount']) && $p['amount'] !== '' && $p['amount'] !== null ? (int) preg_replace('/\D/', '', (string) $p['amount']) : null;
                if ($concept <= 0) continue;
                if ($amount === null) {
                    $db->run('DELETE FROM prices WHERE year_id = ? AND concept_id = ? AND grade_level_id <=> ?', [$year, $concept, $grade]);
                } else {
                    $exists = $db->value('SELECT id FROM prices WHERE year_id = ? AND concept_id = ? AND grade_level_id <=> ?', [$year, $concept, $grade]);
                    $exists ? $db->update('prices', ['amount' => $amount], ['id' => $exists]) : $db->insert('prices', ['year_id' => $year, 'concept_id' => $concept, 'grade_level_id' => $grade, 'amount' => $amount]);
                }
            }
        });
        $this->audit()->log($actor, 'prices.save', 'prices', $year, ['items' => count($items)]);
        return $this->prices($req);
    }

    /** Special price of one student for a concept in the year (null amount = back to the grade price). */
    public function saveStudentPrice(Request $req): array
    {
        $actor = $this->staffWrite($req, 'pagos');
        $v = Validate::of($req);
        $enrollmentId = $v->int('enrollmentId', 1, null, true);
        $conceptId = $v->int('conceptId', 1, null, true);
        $amount = $v->money('amount', false, true);
        $reason = $v->str('reason', 200);
        $v->check();
        if ($amount === null) {
            $this->db()->run('DELETE FROM student_prices WHERE enrollment_id = ? AND concept_id = ?', [$enrollmentId, $conceptId]);
        } else {
            $this->db()->run('INSERT INTO student_prices (enrollment_id, concept_id, amount, reason) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE amount = VALUES(amount), reason = VALUES(reason)', [$enrollmentId, $conceptId, $amount, $reason]);
        }
        $this->audit()->log($actor, 'student_price.save', 'enrollment', $enrollmentId, compact('conceptId', 'amount', 'reason'));
        return [];
    }

    public function saveConcept(Request $req): array
    {
        $actor = $this->staffWrite($req, 'ajustes', 'pagos');
        $v = Validate::of($req);
        $row = [
            'code' => strtoupper((string) ($v->str('code', 24, true, 'El código') ?? '')),
            'name' => $v->str('name', 80, true, 'El nombre'),
            'frequency' => $v->oneOf('frequency', ['mensual', 'anual', 'eventual'], 'eventual'),
            'apply_on_enrollment' => $v->bool('onEnrollment'),
            'late_fee_applies' => $v->bool('lateFee'),
            'online_payable' => $v->bool('online', true),
            'active' => $v->bool('active', true),
        ];
        if (!preg_match('/^[A-Z0-9_]{2,24}$/', $row['code'])) $v->fail('code', 'Solo letras, números y _ (ej. TRANSPORTE).');
        $v->check();
        $id = $this->persist('billing_concepts', $row, self::optionalId($req));
        $this->audit()->log($actor, 'concept.save', 'billing_concept', $id, $row);
        return ['id' => $id];
    }

    // ───────────────────────── plans ─────────────────────────
    /** Plans (mensual / por día) with how many active students use each one this year. */
    public function plans(Request $req): array
    {
        $this->staff($req, 'pagos', 'ajustes', 'matriculas', 'estudiantes');
        $rows = $this->db()->all(
            "SELECT p.id, p.name, p.type, p.shift, p.price, p.active, p.sort,
                    (SELECT COUNT(*) FROM enrollments e WHERE e.plan_id = p.id AND e.year_id = ? AND e.status IN ('activo','prematricula')) AS students
             FROM plans p ORDER BY p.active DESC, p.sort, p.name",
            [$this->settings()->activeYear()],
        );
        return ['plans' => self::intsAll($rows, 'id', 'price', 'active', 'sort', 'students')];
    }

    public function savePlan(Request $req): array
    {
        $actor = $this->staffWrite($req, 'ajustes', 'pagos');
        $v = Validate::of($req);
        $row = [
            'name' => $v->str('name', 60, true, 'El nombre'),
            'type' => $v->oneOf('type', ['mensual', 'dia'], 'mensual'),
            'shift' => $v->oneOf('shift', ['manana', 'tarde', 'completa'], null),
            'price' => $v->int('price', 0, 100_000_000, true),
            'active' => $v->bool('active', true),
            'sort' => $v->int('sort', 0, 99) ?? 0,
        ];
        $v->check();
        $id = $this->persist('plans', $row, self::optionalId($req));
        $this->audit()->log($actor, 'plan.save', 'plan', $id, $row);
        return ['id' => $id];
    }

    /** {month: AAAA-MM} — charges the attended days of per-day plans for a month that already ended. */
    public function chargeDays(Request $req): array
    {
        $actor = $this->staffWrite($req, 'pagos');
        $v = Validate::of($req);
        $month = $v->str('month', 7) ?? date('Y-m', strtotime('first day of last month'));
        if (!preg_match('/^\d{4}-\d{2}$/', $month)) $v->fail('month', 'Mes inválido (AAAA-MM).');
        $v->check();
        if ("$month-01" >= date('Y-m-01')) throw new DomainError('month', 'Los días se cobran cuando el mes termina.');
        return $this->billing()->generateDayCharges(new DateTimeImmutable("$month-01"), $actor);
    }
}
