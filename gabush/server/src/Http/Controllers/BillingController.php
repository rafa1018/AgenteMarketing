<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use DateTimeImmutable;
use Gabush\App;
use Gabush\Application\Billing\BillingService;
use Gabush\Application\Billing\Signature;
use Gabush\Domain\Billing\LateFeePolicy;
use Gabush\Domain\Shared\DomainError;
use Gabush\Http\Auth\FamilyAuth;
use Gabush\Http\HttpError;
use Gabush\Http\Request;
use Gabush\Http\Response;
use Gabush\Http\Router;
use Gabush\Http\Validate;
use Gabush\Http\Views\PazYSalvoView;
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
        $r->add('PUT', '/billing/students/{id}/grades-unlock', [$c, 'gradesUnlock']);
        $r->add('POST', '/billing/students/{id}/write-off', [$c, 'writeOff']);
        $r->add('POST', '/billing/charges', [$c, 'createCharge']);
        $r->add('POST', '/billing/charges/{id}/void', [$c, 'voidCharge']);
        $r->add('POST', '/billing/charges/{id}/due', [$c, 'changeDue']);
        $r->add('POST', '/billing/charges/{id}/amount', [$c, 'changeAmount']);
        $r->add('POST', '/billing/charges/{id}/adjustments', [$c, 'addAdjustment']);
        $r->add('DELETE', '/billing/adjustments/{id}', [$c, 'deleteAdjustment']);
        $r->add('POST', '/billing/charges/{id}/late-fee', [$c, 'lateFee']);
        $r->add('POST', '/billing/payments', [$c, 'createPayment']);
        $r->add('POST', '/billing/payments/{id}/void', [$c, 'voidPayment']);
        $r->add('GET', '/billing/payments/{id}/receipt', [$c, 'receipt']);
        $r->add('GET', '/billing/students/{id}/paz-y-salvo', [$c, 'clearance']);
        $r->add('POST', '/billing/concepts', [$c, 'createConcept']);
        $r->add('PUT', '/billing/concepts/{id}', [$c, 'updateConcept']);
        $r->add('DELETE', '/billing/concepts/{id}', [$c, 'deleteConcept']);
        $r->add('GET', '/billing/concept-charges', [$c, 'conceptChargesPending']);
        $r->add('POST', '/billing/concept-charges', [$c, 'chargeConceptToEnrolled']);
        $r->add('GET', '/billing/signature', [$c, 'signature']);
        $r->add('POST', '/billing/signature', [$c, 'saveSignature']);
        $r->add('DELETE', '/billing/signature', [$c, 'deleteSignature']);
        $r->add('GET', '/billing/payments', [$c, 'paymentsReport']);
        $r->add('GET', '/billing/debtors', [$c, 'debtors']);
        $r->add('POST', '/billing/generate', [$c, 'generate']);
        $r->add('POST', '/billing/late-fees/run', [$c, 'runLateFees']);
        $r->add('GET', '/billing/settings', [$c, 'settingsShow']);
        $r->add('PUT', '/billing/settings', [$c, 'settingsSave']);
        $r->add('GET', '/billing/prices', [$c, 'prices']);
        $r->add('PUT', '/billing/prices', [$c, 'savePrices']);
        $r->add('PUT', '/billing/student-prices', [$c, 'saveStudentPrice']);
        $r->add('GET', '/billing/plans', [$c, 'plans']);
        $r->add('POST', '/billing/plans', [$c, 'savePlan']);
        $r->add('PUT', '/billing/plans/{id}', [$c, 'savePlan']);
        $r->add('POST', '/billing/days', [$c, 'chargeDays']);
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
            // students of this year vs. withdrawn / not enrolled any more (old debts to collect or close)
            'pendingActive' => array_sum(array_map(static fn($d) => self::isCurrent($d) ? $d['balance'] : 0, $debtors)),
            'debtorsActive' => count(array_filter($debtors, [self::class, 'isCurrent'])),
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
            // when the student joined the school (first enrollment) and how many years they have: default
            // reason of a discount ("Estudiante antiguo (ingresó en febrero de 2022)")
            'since' => $this->db()->value("SELECT COALESCE(MIN(enrolled_on), CONCAT(MIN(year_id), '-02-01')) FROM enrollments WHERE student_id = ? AND status <> 'prematricula'", [$id]),
            'years' => (int) $this->db()->value("SELECT COUNT(*) FROM enrollments WHERE student_id = ? AND status <> 'prematricula'", [$id]),
            'gradesLock' => $b->gradesLockStatus($id),
        ];
    }

    /** {until: 'YYYY-MM-DD'|null, reason}: payment agreement — the family sees grades and boletín until that date. */
    public function gradesUnlock(Request $req): array
    {
        $actor = $this->staffWrite($req, 'pagos');
        $id = $req->intParam('id');
        $this->db()->value('SELECT 1 FROM students WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        $v = Validate::of($req);
        $until = $v->date('until');
        $reason = $v->str('reason', 200);
        if ($until !== null && $until < date('Y-m-d')) $v->fail('until', 'La fecha ya pasó.');
        $v->check();
        $this->billing()->setGradesUnlock($id, $until, $reason, $actor);
        return ['gradesLock' => $this->billing()->gradesLockStatus($id)];
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
        $validUntil = $v->date('validUntil');
        $v->check();
        $this->billing()->addAdjustment($req->intParam('id'), $kind, $amount, $reason, $actor, $validUntil);
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
        $reason = $v->str('reason', 200, $waive, 'El motivo');
        $v->check();
        $this->billing()->waiveLateFee($req->intParam('id'), $waive, $actor, $reason);
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
        return Response::html(ReceiptView::render($r, Signature::from($this->app, 'contadora')->get()));
    }

    /** Printable "paz y salvo" — staff, or the family of that student. Signed only when nothing is pending. */
    public function clearance(Request $req): Response
    {
        $id = $req->intParam('id');
        $family = FamilyAuth::current();
        if (!$family || $family->studentId !== $id) $this->staff($req, 'pagos', 'estudiantes', 'matriculas');
        return Response::html(PazYSalvoView::render($this->billing()->clearance($id), Signature::from($this->app)->get()));
    }

    // ───────────────────────── signatures (?kind=rectora|contadora) ─────────────────────────
    private static function signatureKind(Request $req): string
    {
        $k = (string) ($req->query('kind') ?? $req->post['kind'] ?? 'rectora');
        return in_array($k, Signature::KINDS, true) ? $k : 'rectora';
    }

    public function signature(Request $req): array
    {
        $this->staff($req, 'pagos', 'ajustes');
        return ['signature' => Signature::from($this->app, self::signatureKind($req))->get()];
    }

    /** multipart: kind, file (optional when only the name changes), name, title, clean (1/0) */
    public function saveSignature(Request $req): array
    {
        $actor = $this->staffWrite($req, 'ajustes');
        $kind = self::signatureKind($req);
        $sig = Signature::from($this->app, $kind)->save(
            $req->files['file'] ?? null,
            (string) ($req->post['name'] ?? ''),
            (string) ($req->post['title'] ?? ''),
            ($req->post['clean'] ?? '1') !== '0',
        );
        $this->audit()->log($actor, 'signature.save', 'settings', 'signature:' . $kind);
        return ['signature' => $sig];
    }

    public function deleteSignature(Request $req): array
    {
        $actor = $this->staffWrite($req, 'ajustes');
        $kind = self::signatureKind($req);
        Signature::from($this->app, $kind)->remove();
        $this->audit()->log($actor, 'signature.delete', 'settings', 'signature:' . $kind);
        return ['signature' => Signature::from($this->app, $kind)->get()];
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
                    (SELECT GROUP_CONCAT(c.description ORDER BY pa.id SEPARATOR ' · ') FROM payment_allocations pa JOIN charges c ON c.id = pa.charge_id WHERE pa.payment_id = p.id) AS concepts,
                    g.full_name AS guardian, g.phone AS guardianPhone
             FROM payments p JOIN students s ON s.id = p.student_id
             LEFT JOIN guardians g ON g.id = (SELECT g2.id FROM guardians g2 WHERE g2.family_id = s.family_id AND g2.phone IS NOT NULL AND g2.phone <> '' ORDER BY g2.is_billing DESC, g2.is_primary DESC, g2.id LIMIT 1)
             WHERE p.paid_on BETWEEN ? AND ? $where ORDER BY p.paid_on DESC, p.id DESC LIMIT 2000",
            $params,
        );
        $rows = self::intsAll($rows, 'id', 'amount', 'studentId');
        $ok = array_filter($rows, static fn($r) => $r['status'] === 'aprobado');
        return ['from' => $from, 'to' => $to, 'payments' => $rows, 'total' => array_sum(array_column($ok, 'amount')), 'count' => count($ok)];
    }

    /** A debtor who studies this year (active or pre-enrolled), as opposed to a withdrawn / former student. */
    public static function isCurrent(array $d): bool
    {
        return in_array($d['status'] ?? null, ['activo', 'prematricula'], true);
    }

    /**
     * {reason}: closes the debt of a former / withdrawn student that will not be collected ("castigo de
     * cartera"): each open charge gets a discount for what is still owed, with the reason. What was paid stays;
     * every discount shows in Auditoría → Movimientos de cartera.
     */
    public function writeOff(Request $req): array
    {
        $actor = $this->staffWrite($req, 'pagos');
        $id = $req->intParam('id');
        $v = Validate::of($req);
        $reason = $v->str('reason', 160, true, 'El motivo');
        $v->check();
        $year = $this->settings()->activeYear();
        if ($this->db()->value("SELECT 1 FROM enrollments WHERE student_id = ? AND year_id = ? AND status IN ('activo','prematricula')", [$id, $year])) {
            throw new DomainError('active', 'Este estudiante está activo este año: su deuda se cobra o se negocia, no se cierra aquí.');
        }
        $b = $this->billing();
        $closed = [];
        $this->db()->transaction(function () use ($b, $id, $reason, $actor, &$closed): void {
            foreach ($b->charges($id, null, true) as $c) {
                if ($c['balance'] <= 0) continue;
                $b->addAdjustment((int) $c['id'], 'descuento', (int) $c['balance'], 'Cierre de cartera: ' . $reason, $actor, null, false);
                $closed[] = ['description' => $c['description'], 'balance' => (int) $c['balance'], 'lateFees' => (int) $c['lateFees']];
            }
        });
        $amount = array_sum(array_column($closed, 'balance'));
        // one entry for the whole closure (who, when, why, how much and which charges)
        if ($closed) $this->audit()->log($actor, 'student.write_off', 'student', $id, ['amount' => $amount, 'reason' => $reason, 'charges' => count($closed), 'lateFees' => array_sum(array_column($closed, 'lateFees')), 'items' => $closed]);
        return ['charges' => count($closed), 'amount' => $amount];
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
        $year = $this->year($req);
        $y = $this->db()->one('SELECT starts_on, ends_on, enrollment_due_on, enrollment_late_fee, early_discount_pct, early_discount_until FROM academic_years WHERE id = ?', [$year]);
        return [
            'year' => $year,
            'lateFee' => $this->billing()->lateFeePolicy()->toArray(),
            'pensionMonths' => $this->billing()->pensionMonthsFor($year), // of the chosen year
            'enrollmentDueDays' => $this->billing()->enrollmentDueDays(),
            'gradesLock' => $this->billing()->gradesLockEnabled(),
            'enrollmentDueOn' => $y['enrollment_due_on'] ?? null,
            'enrollmentLateFee' => isset($y['enrollment_late_fee']) ? (int) $y['enrollment_late_fee'] : 0,
            'earlyDiscountPct' => isset($y['early_discount_pct']) ? (float) $y['early_discount_pct'] : 0,
            'earlyDiscountUntil' => $y['early_discount_until'] ?? null,
            'startsOn' => $y['starts_on'] ?? null,
            'endsOn' => $y['ends_on'] ?? null,
        ];
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
        if ($v->has('enrollmentDueDays')) $this->settings()->patch('billing', ['enrollmentDueDays' => max(0, min(120, (int) $req->json()['enrollmentDueDays']))]);
        if ($v->has('gradesLock')) $this->settings()->patch('billing', ['gradesLock' => (bool) $req->json()['gradesLock']]);
        // dates of the chosen year: pension months and the matrícula deadline
        $year = $this->year($req);
        $moved = 0;
        $extra = 0;
        $early = 0;
        if ($this->db()->value('SELECT 1 FROM academic_years WHERE id = ?', [$year])) {
            if ($months) {
                sort($months);
                $this->db()->update('academic_years', ['pension_months' => implode(',', $months)], ['id' => $year]);
            }
            if ($v->has('enrollmentDueOn')) {
                $due = (string) ($req->json()['enrollmentDueOn'] ?? '');
                $this->db()->update('academic_years', ['enrollment_due_on' => preg_match('/^\d{4}-\d{2}-\d{2}$/', $due) ? $due : null], ['id' => $year]);
                $moved = $this->billing()->moveEnrollmentDeadline($year);
            }
            if ($v->has('enrollmentLateFee')) {
                $fee = max(0, min(100_000_000, (int) ($req->json()['enrollmentLateFee'] ?? 0)));
                $this->db()->update('academic_years', ['enrollment_late_fee' => $fee ?: null], ['id' => $year]);
            }
            if ($v->has('earlyDiscountPct')) {
                $pct = max(0, min(100, round((float) str_replace(',', '.', (string) ($req->json()['earlyDiscountPct'] ?? 0)), 2)));
                $until = (string) ($req->json()['earlyDiscountUntil'] ?? '');
                $until = preg_match('/^\d{4}-\d{2}-\d{2}$/', $until) ? $until : null;
                if ($pct > 0 && !$until) throw HttpError::validation(['earlyDiscountUntil' => 'Pon hasta qué fecha vale el pronto pago.']);
                $this->db()->update('academic_years', ['early_discount_pct' => $pct ?: null, 'early_discount_until' => $pct ? $until : null], ['id' => $year]);
            }
            // a deadline already past with an extra value: the unpaid matrículas get it now
            $extra = $this->billing()->applyEnrollmentLateFees($actor, $year);
            $early = $this->billing()->applyEarlyDiscounts($actor, $year);
        } elseif ($months) {
            $this->settings()->patch('billing', ['pensionMonths' => $months]);
        }
        $this->audit()->log($actor, 'billing.settings', 'settings', 'billing', ['lateFee' => $lf, 'months' => $months, 'year' => $year]);
        return $this->settingsShow($req) + ['movedEnrollmentCharges' => $moved, 'extraEnrollmentCharges' => $extra, 'earlyDiscountCharges' => $early];
    }

    /** {dueOn}: new due date of a pending charge (e.g. a matrícula that fell due the day it was created). */
    public function changeDue(Request $req): array
    {
        $actor = $this->staffWrite($req, 'pagos');
        $id = $req->intParam('id');
        $v = Validate::of($req);
        $due = $v->date('dueOn', true);
        $v->check();
        $c = $this->db()->one('SELECT id, due_on, status FROM charges WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        if ($c['status'] !== 'abierto') throw new \Gabush\Domain\Shared\DomainError('closed', 'Solo se cambia la fecha de un cobro pendiente.');
        $this->db()->update('charges', ['due_on' => $due], ['id' => $id]);
        $this->audit()->log($actor, 'charge.due_date', 'charge', $id, ['from' => $c['due_on'], 'to' => $due]);
        return ['dueOn' => $due];
    }

    /** {amount, reason}: new value of a pending charge. */
    public function changeAmount(Request $req): array
    {
        $actor = $this->staffWrite($req, 'pagos');
        $v = Validate::of($req);
        $amount = $v->money('amount', true);
        $reason = $v->str('reason', 200);
        $v->check();
        return $this->billing()->changeAmount($req->intParam('id'), (int) $amount, $reason, $actor);
    }

    /** Concepts that can be charged to every enrolled student at once: the yearly ones of the price table. */
    private function bulkConcept(string $code): string
    {
        $ok = $this->db()->value("SELECT 1 FROM billing_concepts WHERE code = ? AND active = 1 AND in_price_table = 1 AND code NOT IN ('PENSION','MATRICULA','DIAS')", [$code]);
        if (!$ok) throw HttpError::validation(['concept' => 'Ese concepto no se puede cobrar de forma masiva.']);
        return $code;
    }

    /** ?year=&concept=CODE → how many active students of the year don't have that charge yet. */
    public function conceptChargesPending(Request $req): array
    {
        $this->staff($req, 'pagos');
        return $this->billing()->conceptChargesPending($this->year($req), $this->bulkConcept((string) $req->query('concept', '')));
    }

    /** {year, concept, dueOn}: charges it to every active student of the year that doesn't have it yet. */
    public function chargeConceptToEnrolled(Request $req): array
    {
        $actor = $this->staffWrite($req, 'pagos');
        $v = Validate::of($req);
        $year = $v->int('year', 2000, 2100, true);
        $code = $v->str('concept', 24, true);
        $dueOn = $v->date('dueOn', true);
        $v->check();
        return ['created' => $this->billing()->chargeConceptToEnrolled($year, $this->bulkConcept((string) $code), $dueOn, $actor)];
    }

    /**
     * {name, onEnrollment}: a new yearly concept of the price table (e.g. "Agenda", "Uniforme"). onEnrollment =
     * charged by itself when the student is enrolled; otherwise it is charged with "Cobrar a los matriculados".
     */
    public function createConcept(Request $req): array
    {
        $actor = $this->staffWrite($req, 'ajustes', 'pagos');
        $v = Validate::of($req);
        $name = $v->str('name', 80, true, 'El nombre');
        $onEnrollment = $v->bool('onEnrollment', false);
        $v->check();
        $base = strtoupper(preg_replace('/[^A-Za-z0-9]+/', '_', iconv('UTF-8', 'ASCII//TRANSLIT', (string) $name) ?: 'COBRO'));
        $base = substr(trim($base, '_') ?: 'COBRO', 0, 18);
        $code = $base;
        for ($i = 2; $this->db()->value('SELECT 1 FROM billing_concepts WHERE code = ?', [$code]); $i++) $code = substr($base, 0, 16) . "_$i";
        $sort = (int) $this->db()->value('SELECT COALESCE(MAX(sort), 0) + 1 FROM billing_concepts WHERE in_price_table = 1 AND sort < 9');
        $id = $this->db()->insert('billing_concepts', ['code' => $code, 'name' => $name, 'frequency' => 'anual', 'apply_on_enrollment' => $onEnrollment ? 1 : 0, 'late_fee_applies' => 0, 'online_payable' => 1, 'in_price_table' => 1, 'sort' => min(8, $sort), 'active' => 1]);
        $this->audit()->log($actor, 'concept.create', 'billing_concept', $id, compact('name', 'code', 'onEnrollment'));
        return ['id' => (int) $id, 'code' => $code];
    }

    /** {name?, onEnrollment?, inPriceTable?}: the pension and the matrícula keep how they are charged. */
    public function updateConcept(Request $req): array
    {
        $actor = $this->staffWrite($req, 'ajustes', 'pagos');
        $id = $req->intParam('id');
        $c = $this->db()->one('SELECT id, code FROM billing_concepts WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        $v = Validate::of($req);
        $row = [];
        if ($v->has('name')) $row['name'] = $v->str('name', 80, true, 'El nombre');
        $fixed = in_array($c['code'], ['PENSION', 'MATRICULA', 'DIAS', 'SALDO_ANTERIOR', 'NOTA_DEBITO', 'OTRO'], true);
        if (!$fixed && $v->has('onEnrollment')) $row['apply_on_enrollment'] = $v->bool('onEnrollment') ? 1 : 0;
        if (!$fixed && $v->has('inPriceTable')) $row['in_price_table'] = $v->bool('inPriceTable') ? 1 : 0;
        $v->check();
        if ($row) $this->db()->update('billing_concepts', $row, ['id' => $id]);
        $this->audit()->log($actor, 'concept.update', 'billing_concept', $id, $row);
        return [];
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

    /**
     * Removes a concept of the price table. If it was already charged to someone it is only hidden (its charges
     * and payments are kept); otherwise it is deleted with its prices. The base concepts can't be removed.
     */
    public function deleteConcept(Request $req): array
    {
        $actor = $this->staffWrite($req, 'ajustes', 'pagos');
        $id = $req->intParam('id');
        $c = $this->db()->one('SELECT id, code, name FROM billing_concepts WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        if (in_array($c['code'], ['PENSION', 'MATRICULA', 'DIAS', 'SALDO_ANTERIOR', 'NOTA_DEBITO', 'OTRO'], true)) throw new DomainError('fixed', 'Este concepto es parte del sistema y no se puede eliminar.');
        $used = (int) $this->db()->value('SELECT COUNT(*) FROM charges WHERE concept_id = ?', [$id]);
        if ($used) {
            $this->db()->update('billing_concepts', ['active' => 0, 'in_price_table' => 0, 'apply_on_enrollment' => 0], ['id' => $id]);
        } else {
            $this->db()->transaction(function ($db) use ($id): void {
                $db->run('DELETE FROM prices WHERE concept_id = ?', [$id]);
                $db->run('DELETE FROM student_prices WHERE concept_id = ?', [$id]);
                $db->run('DELETE FROM billing_concepts WHERE id = ?', [$id]);
            });
        }
        $this->audit()->log($actor, $used ? 'concept.hide' : 'concept.delete', 'billing_concept', $id, ['code' => $c['code'], 'name' => $c['name'], 'charges' => $used]);
        return ['hidden' => (bool) $used, 'charges' => $used];
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
