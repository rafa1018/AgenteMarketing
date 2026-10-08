<?php
declare(strict_types=1);

namespace Gabush\Application\Billing;

use DateTimeImmutable;
use Gabush\App;
use Gabush\Application\Notifications\Notifier;
use Gabush\Application\Shared\Actor;
use Gabush\Application\Shared\Audit;
use Gabush\Application\Shared\Settings;
use Gabush\Domain\Billing\ChargeBalance;
use Gabush\Domain\Billing\LateFeePolicy;
use Gabush\Domain\Billing\PaymentAllocator;
use Gabush\Domain\Shared\DomainError;
use Gabush\Infrastructure\Database\Database;

/**
 * Student accounts (cartera): charges, discounts / surcharges / late fees, payments and receipts.
 * Every money movement runs in a transaction and is audited; payments also feed the cash box.
 */
final class BillingService
{
    private const MONTHS = [1 => 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    public function __construct(
        private readonly Database $db,
        private readonly Settings $settings,
        private readonly Audit $audit,
        private readonly Notifier $notifier,
        private readonly DateTimeImmutable $today,
    ) {
    }

    public static function from(App $app): self
    {
        return $app->service(self::class, static fn(App $a) => new self(
            $a->db(),
            $a->service(Settings::class, static fn(App $x) => new Settings($x->db())),
            $a->service(Audit::class, static fn(App $x) => new Audit($x->db())),
            Notifier::from($a),
            $a->today(),
        ));
    }

    public function lateFeePolicy(): LateFeePolicy
    {
        return LateFeePolicy::fromSettings((array) $this->settings->get('late_fee', []));
    }

    /** Pension months of a year (default February–November). @return list<int> */
    public function pensionMonths(): array
    {
        $m = (array) (((array) $this->settings->get('billing', []))['pensionMonths'] ?? []);
        $m = array_values(array_filter(array_map('intval', $m), static fn($x) => $x >= 1 && $x <= 12));
        return $m ?: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
    }

    // ───────────────────────── reading ─────────────────────────
    /**
     * Every charge of a student (optionally one year) with its adjustments, what was paid and the balance.
     * @return list<array<string,mixed>>
     */
    public function charges(int $studentId, ?int $year = null, bool $openOnly = false): array
    {
        $params = [$studentId];
        $sql = "SELECT c.id, c.description, c.amount, c.due_on AS dueOn, c.period_month AS periodMonth, c.year_id AS year, c.status, c.source,
                       c.created_at AS createdAt, bc.code AS concept, bc.late_fee_applies AS lateFeeApplies, bc.online_payable AS onlinePayable
                FROM charges c LEFT JOIN billing_concepts bc ON bc.id = c.concept_id
                WHERE c.student_id = ? AND c.status <> 'anulado'";
        if ($year) { $sql .= ' AND c.year_id = ?'; $params[] = $year; }
        if ($openOnly) $sql .= " AND c.status = 'abierto'";
        $rows = $this->db->all($sql . ' ORDER BY COALESCE(c.due_on, c.created_at), c.id', $params);
        if (!$rows) return [];
        $ids = implode(',', array_map(static fn($r) => (int) $r['id'], $rows));
        $adj = [];
        foreach ($this->db->all("SELECT id, charge_id, kind, amount, reason, days_late AS daysLate, waived, created_by AS createdBy, created_at AS createdAt FROM charge_adjustments WHERE charge_id IN ($ids) ORDER BY id") as $a) {
            $adj[(int) $a['charge_id']][] = ['id' => (int) $a['id'], 'kind' => $a['kind'], 'amount' => (int) $a['amount'], 'reason' => $a['reason'], 'daysLate' => $a['daysLate'] !== null ? (int) $a['daysLate'] : null, 'waived' => (bool) $a['waived'], 'createdBy' => $a['createdBy'], 'createdAt' => $a['createdAt']];
        }
        $paid = [];
        foreach ($this->db->all("SELECT pa.charge_id, SUM(pa.amount) AS paid FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id WHERE p.status = 'aprobado' AND pa.charge_id IN ($ids) GROUP BY pa.charge_id") as $p) {
            $paid[(int) $p['charge_id']] = (int) $p['paid'];
        }
        return array_map(function ($r) use ($adj, $paid) {
            $id = (int) $r['id'];
            $b = ChargeBalance::of((int) $r['amount'], $adj[$id] ?? [], $paid[$id] ?? 0);
            return ['id' => $id, 'description' => $r['description'], 'concept' => $r['concept'], 'year' => $r['year'] !== null ? (int) $r['year'] : null,
                'dueOn' => $r['dueOn'], 'periodMonth' => $r['periodMonth'], 'status' => $r['status'], 'source' => $r['source'], 'createdAt' => $r['createdAt'],
                'lateFeeApplies' => (bool) $r['lateFeeApplies'], 'onlinePayable' => (bool) ($r['onlinePayable'] ?? true),
                'overdue' => $r['status'] === 'abierto' && $r['dueOn'] !== null && $r['dueOn'] < $this->today->format('Y-m-d'),
                'adjustments' => $adj[$id] ?? []] + $b->toArray();
        }, $rows);
    }

    /** @return list<array<string,mixed>> */
    public function payments(int $studentId, ?int $year = null): array
    {
        $params = [$studentId];
        $sql = "SELECT p.id, p.receipt_number AS receipt, p.paid_on AS paidOn, p.amount, p.method, p.reference, p.notes, p.status, p.source, p.created_by AS createdBy, p.created_at AS createdAt
                FROM payments p WHERE p.student_id = ?";
        if ($year) { $sql .= ' AND YEAR(p.paid_on) BETWEEN ? - 1 AND ?'; $params[] = $year; $params[] = $year; }
        $rows = $this->db->all($sql . ' ORDER BY p.paid_on DESC, p.id DESC', $params);
        if (!$rows) return [];
        $ids = implode(',', array_map(static fn($r) => (int) $r['id'], $rows));
        $alloc = [];
        foreach ($this->db->all("SELECT pa.payment_id, pa.amount, c.id AS chargeId, c.description, c.year_id AS year FROM payment_allocations pa JOIN charges c ON c.id = pa.charge_id WHERE pa.payment_id IN ($ids) ORDER BY pa.id") as $a) {
            $alloc[(int) $a['payment_id']][] = ['chargeId' => (int) $a['chargeId'], 'description' => $a['description'], 'amount' => (int) $a['amount'], 'year' => $a['year'] !== null ? (int) $a['year'] : null];
        }
        $out = array_map(static fn($r) => ['id' => (int) $r['id'], 'amount' => (int) $r['amount']] + $r + ['charges' => $alloc[(int) $r['id']] ?? []], $rows);
        if ($year) $out = array_values(array_filter($out, static fn($p) => !$p['charges'] || array_filter($p['charges'], static fn($c) => $c['year'] === $year || $c['year'] === null) || (int) substr($p['paidOn'], 0, 4) === $year));
        return $out;
    }

    /** Totals for a statement header. @return array<string,int> */
    public function summary(int $studentId, ?int $year = null): array
    {
        $charges = $this->charges($studentId, $year);
        $balance = array_sum(array_map(static fn($c) => $c['status'] === 'abierto' ? $c['balance'] : 0, $charges));
        $overdue = array_sum(array_map(static fn($c) => $c['overdue'] ? $c['balance'] : 0, $charges));
        $credit = $this->credit($studentId);
        return ['balance' => $balance, 'overdue' => $overdue, 'lateFees' => array_sum(array_column($charges, 'lateFees')), 'credit' => $credit, 'charged' => array_sum(array_column($charges, 'net')), 'paid' => array_sum(array_column($charges, 'paid'))];
    }

    /** Money paid that was not applied to any charge (saldo a favor). */
    public function credit(int $studentId): int
    {
        return (int) $this->db->value(
            "SELECT COALESCE(SUM(p.amount), 0) - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa JOIN payments p2 ON p2.id = pa.payment_id WHERE p2.student_id = ? AND p2.status = 'aprobado'), 0)
             FROM payments p WHERE p.student_id = ? AND p.status = 'aprobado'",
            [$studentId, $studentId],
        );
    }

    // ───────────────────────── automatic charges ─────────────────────────
    /**
     * Price of a concept for an enrollment: student's special price, else (pension) the price of the student's
     * monthly plan, else the year/grade price, else the year default.
     */
    public function priceFor(int $enrollmentId, string $conceptCode): ?int
    {
        $row = $this->db->one(
            "SELECT e.year_id, c.grade_level_id, bc.id AS concept_id,
                    (SELECT sp.amount FROM student_prices sp WHERE sp.enrollment_id = e.id AND sp.concept_id = bc.id) AS special,
                    IF(bc.code = 'PENSION' AND pl.type = 'mensual', pl.price, NULL) AS by_plan,
                    (SELECT p.amount FROM prices p WHERE p.year_id = e.year_id AND p.concept_id = bc.id AND p.grade_level_id = c.grade_level_id) AS by_grade,
                    (SELECT p.amount FROM prices p WHERE p.year_id = e.year_id AND p.concept_id = bc.id AND p.grade_level_id IS NULL) AS by_year
             FROM enrollments e LEFT JOIN courses c ON c.id = e.course_id LEFT JOIN plans pl ON pl.id = e.plan_id JOIN billing_concepts bc ON bc.code = ?
             WHERE e.id = ?",
            [$conceptCode, $enrollmentId],
        );
        if (!$row) return null;
        foreach (['special', 'by_plan', 'by_grade', 'by_year'] as $k) if ($row[$k] !== null) return (int) $row[$k];
        return null;
    }

    /** The enrollment's standing monthly discount, applied to a pension that was just created. */
    private function applyMonthlyDiscount(int $chargeId, int $enrollmentId, Actor $actor): void
    {
        $e = $this->db->one('SELECT monthly_discount, monthly_discount_reason FROM enrollments WHERE id = ?', [$enrollmentId]);
        $amount = (int) ($e['monthly_discount'] ?? 0);
        if ($amount <= 0) return;
        $this->db->insert('charge_adjustments', ['charge_id' => $chargeId, 'kind' => 'descuento', 'amount' => $amount, 'reason' => $e['monthly_discount_reason'] ?: 'Descuento mensual', 'created_by' => $actor->label()]);
    }

    /**
     * Monthly pension of every active student of the active year for $month (idempotent: one per student
     * and month). Called by the cron on the 1st and from the panel ("Generar pensiones del mes").
     * @return array{created:int,skipped:int}
     */
    public function generateMonthlyCharges(DateTimeImmutable $month, Actor $actor): array
    {
        $first = $month->modify('first day of this month')->setTime(0, 0);
        if (!in_array((int) $first->format('n'), $this->pensionMonths(), true)) return ['created' => 0, 'skipped' => 0];
        $year = (int) $first->format('Y');
        $concept = $this->db->one("SELECT id FROM billing_concepts WHERE code = 'PENSION' AND active = 1");
        if (!$concept) return ['created' => 0, 'skipped' => 0];
        $due = $this->lateFeePolicy()->dueDateFor($first)->format('Y-m-d');
        // students on a per-day plan pay the days they attended instead (generateDayCharges)
        $rows = $this->db->all(
            "SELECT e.id, e.student_id, g.name AS grade, e.enrolled_on FROM enrollments e
             LEFT JOIN courses c ON c.id = e.course_id LEFT JOIN grade_levels g ON g.id = c.grade_level_id LEFT JOIN plans pl ON pl.id = e.plan_id
             WHERE e.year_id = ? AND e.status = 'activo' AND (pl.type IS NULL OR pl.type <> 'dia')",
            [$year],
        );
        $created = $skipped = 0;
        foreach ($rows as $e) {
            $amount = $this->priceFor((int) $e['id'], 'PENSION');
            if (!$amount) { $skipped++; continue; }
            $desc = trim('Pensión ' . ($e['grade'] ?? '') . ' ' . self::MONTHS[(int) $first->format('n')] . '/' . $year);
            $st = $this->db->run(
                "INSERT IGNORE INTO charges (student_id, enrollment_id, year_id, concept_id, description, period_month, amount, due_on, source, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'automatico', ?)",
                [$e['student_id'], $e['id'], $year, $concept['id'], $desc, $first->format('Y-m-d'), $amount, $due, $actor->label()],
            );
            if ($st->rowCount() > 0) {
                $this->applyMonthlyDiscount((int) $this->db->pdo()->lastInsertId(), (int) $e['id'], $actor);
                $created++;
            } else {
                $skipped++;
            }
        }
        if ($created) $this->audit->log($actor, 'charges.monthly', 'charges', $first->format('Y-m'), ['created' => $created]);
        return ['created' => $created, 'skipped' => $skipped];
    }

    /**
     * Per-day plans: one charge per student for the days attended in $month (present or late), at the plan's
     * daily price. Only for months that already ended; idempotent (one per student and month).
     * @return array{created:int,skipped:int}
     */
    public function generateDayCharges(DateTimeImmutable $month, Actor $actor): array
    {
        $first = $month->modify('first day of this month')->setTime(0, 0);
        $next = $first->modify('first day of next month');
        if ($next > $this->today) return ['created' => 0, 'skipped' => 0]; // the month is not over yet
        $concept = $this->db->value("SELECT id FROM billing_concepts WHERE code = 'DIAS' AND active = 1");
        if (!$concept) return ['created' => 0, 'skipped' => 0];
        $rows = $this->db->all(
            "SELECT e.id, e.student_id, e.year_id, pl.price, pl.name AS plan,
                    (SELECT COUNT(*) FROM attendance a WHERE a.student_id = e.student_id AND a.day >= ? AND a.day < ? AND a.status IN ('presente','tarde')) AS days
             FROM enrollments e JOIN plans pl ON pl.id = e.plan_id AND pl.type = 'dia'
             WHERE e.status = 'activo' AND e.year_id = ?",
            [$first->format('Y-m-d'), $next->format('Y-m-d'), (int) $first->format('Y')],
        );
        $due = $this->lateFeePolicy()->dueDateFor($next)->format('Y-m-d');
        $created = $skipped = 0;
        foreach ($rows as $e) {
            $days = (int) $e['days'];
            if ($days <= 0 || (int) $e['price'] <= 0) { $skipped++; continue; }
            $desc = sprintf('Días asistidos %s/%s: %d %s × %s', self::MONTHS[(int) $first->format('n')], $first->format('Y'), $days, $days === 1 ? 'día' : 'días', '$ ' . number_format((int) $e['price'], 0, ',', '.'));
            $st = $this->db->run(
                "INSERT IGNORE INTO charges (student_id, enrollment_id, year_id, concept_id, description, period_month, amount, due_on, source, created_by)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'automatico', ?)",
                [$e['student_id'], $e['id'], $e['year_id'], $concept, $desc, $first->format('Y-m-d'), $days * (int) $e['price'], $due, $actor->label()],
            );
            if ($st->rowCount() > 0) {
                $id = (int) $this->db->pdo()->lastInsertId();
                $this->applyMonthlyDiscount($id, (int) $e['id'], $actor);
                $this->notifier->chargeCreated($id);
                $created++;
            } else {
                $skipped++;
            }
        }
        if ($created) $this->audit->log($actor, 'charges.days', 'charges', $first->format('Y-m'), ['created' => $created]);
        return ['created' => $created, 'skipped' => $skipped];
    }

    /** Matrícula charge when an enrollment becomes active (once per enrollment). */
    public function onEnrollmentActivated(int $enrollmentId, Actor $actor): void
    {
        $e = $this->db->one('SELECT e.*, g.name AS grade FROM enrollments e LEFT JOIN courses c ON c.id = e.course_id LEFT JOIN grade_levels g ON g.id = c.grade_level_id WHERE e.id = ?', [$enrollmentId]);
        if (!$e) return;
        foreach ($this->db->all('SELECT id, code, name FROM billing_concepts WHERE active = 1 AND apply_on_enrollment = 1') as $c) {
            if ($this->db->value("SELECT 1 FROM charges WHERE enrollment_id = ? AND concept_id = ? AND status <> 'anulado'", [$enrollmentId, $c['id']])) continue;
            $amount = $this->priceFor($enrollmentId, $c['code']);
            if (!$amount) continue;
            $this->db->insert('charges', [
                'student_id' => $e['student_id'], 'enrollment_id' => $enrollmentId, 'year_id' => $e['year_id'], 'concept_id' => $c['id'],
                'description' => trim("{$c['name']} " . ($e['grade'] ?? '') . " {$e['year_id']}"), 'amount' => $amount,
                'due_on' => $this->today->format('Y-m-d'), 'source' => 'automatico', 'created_by' => $actor->label(),
            ]);
        }
    }

    /** On withdrawal, future pensions that were not paid at all are voided. */
    public function onEnrollmentWithdrawn(int $enrollmentId, string $date, Actor $actor): void
    {
        $n = $this->db->run(
            "UPDATE charges c SET c.status = 'anulado'
             WHERE c.enrollment_id = ? AND c.status = 'abierto' AND c.period_month > ?
               AND NOT EXISTS (SELECT 1 FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id WHERE pa.charge_id = c.id AND p.status = 'aprobado')",
            [$enrollmentId, substr($date, 0, 7) . '-01'],
        )->rowCount();
        if ($n) $this->audit->log($actor, 'charges.void_after_withdrawal', 'enrollment', $enrollmentId, ['voided' => $n]);
    }

    /**
     * Late fees (mora) of every open charge whose concept applies them: recomputed up to today, unless the
     * rectora waived them. Paid charges keep the fee they had when they were settled.
     * @return array{updated:int}
     */
    public function applyLateFees(Actor $actor): array
    {
        $policy = $this->lateFeePolicy();
        $updated = 0;
        $rows = $this->db->all(
            "SELECT c.id, c.due_on FROM charges c JOIN billing_concepts bc ON bc.id = c.concept_id
             WHERE c.status = 'abierto' AND bc.late_fee_applies = 1 AND c.due_on IS NOT NULL AND c.due_on < ?",
            [$this->today->format('Y-m-d')],
        );
        foreach ($rows as $c) {
            $fee = $policy->feeFor(new DateTimeImmutable($c['due_on']), $this->today);
            $mora = $this->db->one("SELECT id, amount, waived FROM charge_adjustments WHERE charge_id = ? AND kind = 'mora' AND legacy_ref IS NULL ORDER BY id LIMIT 1", [$c['id']]);
            if ($mora && $mora['waived']) continue;
            if ($fee['amount'] <= 0) continue;
            if ($mora) {
                if ((int) $mora['amount'] === $fee['amount']) continue;
                $this->db->update('charge_adjustments', ['amount' => $fee['amount'], 'days_late' => $fee['days'], 'reason' => "Mora: {$fee['days']} días de retraso"], ['id' => $mora['id']]);
            } else {
                $this->db->insert('charge_adjustments', ['charge_id' => $c['id'], 'kind' => 'mora', 'amount' => $fee['amount'], 'days_late' => $fee['days'], 'reason' => "Mora: {$fee['days']} días de retraso", 'created_by' => $actor->label()]);
            }
            $updated++;
        }
        return ['updated' => $updated];
    }

    // ───────────────────────── manual operations ─────────────────────────
    public function createCharge(int $studentId, int $conceptId, string $description, int $amount, ?string $dueOn, ?int $year, Actor $actor): int
    {
        if ($amount <= 0) throw new DomainError('amount', 'El valor debe ser mayor que cero.');
        $year ??= (int) $this->settings->activeYear();
        $enrollment = $this->db->value('SELECT id FROM enrollments WHERE student_id = ? AND year_id = ?', [$studentId, $year]);
        $id = $this->db->insert('charges', [
            'student_id' => $studentId, 'enrollment_id' => $enrollment, 'year_id' => $year, 'concept_id' => $conceptId,
            'description' => $description, 'amount' => $amount, 'due_on' => $dueOn, 'source' => 'manual', 'created_by' => $actor->label(),
        ]);
        $this->audit->log($actor, 'charge.create', 'charge', $id, compact('studentId', 'amount', 'description'));
        $this->notifier->chargeCreated($id);
        return $id;
    }

    public function voidCharge(int $chargeId, string $reason, Actor $actor): void
    {
        $paid = (int) $this->db->value("SELECT COALESCE(SUM(pa.amount), 0) FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id WHERE pa.charge_id = ? AND p.status = 'aprobado'", [$chargeId]);
        if ($paid > 0) throw new DomainError('has_payments', 'El cobro tiene pagos aplicados: anula primero el pago.');
        $this->db->update('charges', ['status' => 'anulado'], ['id' => $chargeId]);
        $this->audit->log($actor, 'charge.void', 'charge', $chargeId, ['reason' => $reason]);
    }

    /** Discount or surcharge on a charge. */
    public function addAdjustment(int $chargeId, string $kind, int $amount, string $reason, Actor $actor): void
    {
        if (!in_array($kind, ['descuento', 'recargo'], true)) throw new DomainError('kind', 'Tipo de ajuste inválido.');
        if ($amount <= 0) throw new DomainError('amount', 'El valor debe ser mayor que cero.');
        $this->db->transaction(function () use ($chargeId, $kind, $amount, $reason, $actor): void {
            $this->db->insert('charge_adjustments', ['charge_id' => $chargeId, 'kind' => $kind, 'amount' => $amount, 'reason' => $reason, 'created_by' => $actor->label()]);
            $this->refreshStatus($chargeId);
        });
        $this->audit->log($actor, "charge.$kind", 'charge', $chargeId, compact('amount', 'reason'));
    }

    public function deleteAdjustment(int $adjustmentId, Actor $actor): void
    {
        $a = $this->db->one('SELECT charge_id, kind, amount FROM charge_adjustments WHERE id = ?', [$adjustmentId]) ?? throw new DomainError('not_found', 'El ajuste no existe.');
        $this->db->transaction(function () use ($adjustmentId, $a): void {
            $this->db->run('DELETE FROM charge_adjustments WHERE id = ?', [$adjustmentId]);
            $this->refreshStatus((int) $a['charge_id']);
        });
        $this->audit->log($actor, 'charge.adjustment_delete', 'charge', (int) $a['charge_id'], $a);
    }

    /** The rectora forgives the late fee of a charge (it stops growing too). */
    public function waiveLateFee(int $chargeId, bool $waive, Actor $actor): void
    {
        $this->db->transaction(function () use ($chargeId, $waive, $actor): void {
            $exists = $this->db->value("SELECT id FROM charge_adjustments WHERE charge_id = ? AND kind = 'mora' AND legacy_ref IS NULL ORDER BY id LIMIT 1", [$chargeId]);
            if ($exists) $this->db->update('charge_adjustments', ['waived' => $waive, 'waived_by' => $waive ? $actor->label() : null], ['id' => $exists]);
            elseif ($waive) $this->db->insert('charge_adjustments', ['charge_id' => $chargeId, 'kind' => 'mora', 'amount' => 0, 'waived' => 1, 'waived_by' => $actor->label(), 'reason' => 'Mora perdonada']);
            $this->refreshStatus($chargeId);
        });
        $this->audit->log($actor, $waive ? 'charge.waive_late_fee' : 'charge.restore_late_fee', 'charge', $chargeId);
    }

    /**
     * Registers an approved payment and applies it to charges (chosen ones, or oldest first); the rest is
     * credit. Issues the receipt number and records the cash income. Returns the payment id.
     * @param list<int>|null $chargeIds
     */
    public function registerPayment(int $studentId, int $amount, string $paidOn, string $method, ?string $reference, ?string $notes, ?array $chargeIds, Actor $actor, string $source = 'manual', ?int $checkoutId = null): int
    {
        $id = $this->db->transaction(function () use ($studentId, $amount, $paidOn, $method, $reference, $notes, $chargeIds, $actor, $source, $checkoutId): int {
            $this->db->run('SELECT id FROM students WHERE id = ? FOR UPDATE', [$studentId]); // one payment at a time per student
            $open = array_map(static fn($c) => ['id' => $c['id'], 'balance' => $c['balance'], 'due_on' => $c['dueOn']], $this->charges($studentId, null, true));
            $plan = PaymentAllocator::allocate($amount, $open, $chargeIds ?: null);
            $pid = $this->db->insert('payments', [
                'student_id' => $studentId, 'paid_on' => $paidOn, 'amount' => $amount, 'method' => $method, 'reference' => $reference, 'notes' => $notes,
                'status' => 'aprobado', 'source' => $source, 'checkout_id' => $checkoutId, 'created_by' => $actor->label(), 'approved_at' => date('Y-m-d H:i:s'),
                'receipt_number' => $this->nextReceiptNumber(),
            ]);
            foreach ($plan['allocations'] as $a) {
                $this->db->insert('payment_allocations', ['payment_id' => $pid, 'charge_id' => $a['charge_id'], 'amount' => $a['amount']]);
                $this->refreshStatus($a['charge_id']);
            }
            $this->recordCashIncome($pid, $amount, $paidOn, $studentId, $actor);
            return $pid;
        });
        $this->audit->log($actor, 'payment.create', 'payment', $id, compact('studentId', 'amount', 'method', 'reference', 'source'));
        $this->notifier->paymentApproved($id);
        return $id;
    }

    public function voidPayment(int $paymentId, string $reason, Actor $actor): void
    {
        $p = $this->db->one('SELECT * FROM payments WHERE id = ?', [$paymentId]) ?? throw new DomainError('not_found', 'El pago no existe.');
        if ($p['status'] === 'anulado') return;
        if ($p['source'] === 'en_linea') throw new DomainError('online', 'Un pago en línea se reversa desde la pasarela, no desde aquí.');
        $this->db->transaction(function () use ($paymentId, $reason, $p): void {
            $charges = array_column($this->db->all('SELECT charge_id FROM payment_allocations WHERE payment_id = ?', [$paymentId]), 'charge_id');
            $this->db->update('payments', ['status' => 'anulado', 'notes' => trim(($p['notes'] ?? '') . " · Anulado: $reason")], ['id' => $paymentId]);
            $this->db->run('DELETE FROM cash_movements WHERE payment_id = ?', [$paymentId]);
            foreach ($charges as $c) $this->refreshStatus((int) $c);
        });
        $this->audit->log($actor, 'payment.void', 'payment', $paymentId, ['reason' => $reason]);
    }

    /** Applies existing credit (saldo a favor) to open charges, oldest first. */
    public function applyCredit(int $studentId, Actor $actor): int
    {
        return $this->db->transaction(function () use ($studentId): int {
            $credit = $this->credit($studentId);
            if ($credit <= 0) return 0;
            $open = array_map(static fn($c) => ['id' => $c['id'], 'balance' => $c['balance'], 'due_on' => $c['dueOn']], $this->charges($studentId, null, true));
            if (!$open) return 0;
            $plan = PaymentAllocator::allocate($credit, $open);
            // attach the allocations to the most recent payments that still have unapplied money
            $pays = $this->db->all("SELECT p.id, p.amount - COALESCE((SELECT SUM(amount) FROM payment_allocations WHERE payment_id = p.id), 0) AS free FROM payments p WHERE p.student_id = ? AND p.status = 'aprobado' HAVING free > 0 ORDER BY p.paid_on", [$studentId]);
            $applied = 0;
            foreach ($plan['allocations'] as $a) {
                $left = $a['amount'];
                foreach ($pays as &$p) {
                    if ($left <= 0) break;
                    $take = min($left, (int) $p['free']);
                    if ($take <= 0) continue;
                    $this->db->insert('payment_allocations', ['payment_id' => $p['id'], 'charge_id' => $a['charge_id'], 'amount' => $take]);
                    $p['free'] -= $take;
                    $left -= $take;
                    $applied += $take;
                }
                unset($p);
                $this->refreshStatus($a['charge_id']);
            }
            return $applied;
        });
    }

    /** Recomputes open / paid from the balance. */
    public function refreshStatus(int $chargeId): void
    {
        $c = $this->db->one('SELECT student_id, status FROM charges WHERE id = ?', [$chargeId]);
        if (!$c || $c['status'] === 'anulado') return;
        $row = array_values(array_filter($this->charges((int) $c['student_id']), static fn($x) => $x['id'] === $chargeId))[0] ?? null;
        if (!$row) return;
        $status = $row['balance'] === 0 ? 'pagado' : 'abierto';
        if ($status !== $c['status']) $this->db->update('charges', ['status' => $status], ['id' => $chargeId]);
    }

    private function nextReceiptNumber(): string
    {
        $n = (int) $this->db->value("SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number, 3) AS UNSIGNED)), 0) FROM payments WHERE receipt_number LIKE 'G-%' FOR UPDATE");
        return sprintf('G-%06d', $n + 1);
    }

    private function recordCashIncome(int $paymentId, int $amount, string $paidOn, int $studentId, Actor $actor): void
    {
        $box = $this->db->value('SELECT id FROM cash_boxes WHERE active = 1 ORDER BY id LIMIT 1') ?? $this->db->insert('cash_boxes', ['name' => 'Principal']);
        $concept = $this->db->value("SELECT id FROM cash_concepts WHERE kind = 'ingreso' AND name = 'Pagos estudiantes'")
            ?? $this->db->insert('cash_concepts', ['kind' => 'ingreso', 'name' => 'Pagos estudiantes', 'description' => 'Pensiones, matrículas y cobros de los estudiantes']);
        $code = $this->db->value('SELECT code FROM students WHERE id = ?', [$studentId]);
        $this->db->insert('cash_movements', ['box_id' => $box, 'kind' => 'ingreso', 'concept_id' => $concept, 'amount' => $amount, 'occurred_on' => $paidOn, 'description' => "Pago $code", 'payment_id' => $paymentId, 'created_by' => $actor->label()]);
    }

    // ───────────────────────── receipts & reports ─────────────────────────
    /** Data printed on the receipt (comprobante de pago). @return array<string,mixed> */
    /**
     * Data of the "paz y salvo" of a student: valid (signed) only when nothing is pending, in any year.
     * @return array<string,mixed>
     */
    public function clearance(int $studentId): array
    {
        $s = $this->db->one(
            "SELECT s.id, s.code, s.first_name, s.middle_name, s.last_name, s.second_last_name, c.name AS course, g.name AS grade, e.year_id
             FROM students s
             LEFT JOIN enrollments e ON e.id = (SELECT e2.id FROM enrollments e2 WHERE e2.student_id = s.id ORDER BY e2.year_id DESC LIMIT 1)
             LEFT JOIN courses c ON c.id = e.course_id LEFT JOIN grade_levels g ON g.id = c.grade_level_id
             WHERE s.id = ?",
            [$studentId],
        ) ?? throw new DomainError('not_found', 'El estudiante no existe.');
        $sum = $this->summary($studentId);
        return [
            'studentId' => (int) $s['id'], 'code' => $s['code'],
            'student' => trim(trim("{$s['last_name']} {$s['second_last_name']}") . ', ' . trim("{$s['first_name']} {$s['middle_name']}")),
            'grade' => $s['grade'], 'course' => $s['course'], 'year' => $s['year_id'] ? (int) $s['year_id'] : null,
            'pending' => $sum['balance'], 'upToDate' => $sum['balance'] <= 0,
            'school' => $this->settings->get('school', ['name' => 'Jardín Infantil Gabush']),
        ];
    }

    public function receipt(int $paymentId): array
    {
        $p = $this->db->one(
            "SELECT p.*, s.code, s.first_name, s.middle_name, s.last_name, s.second_last_name, c.name AS course
             FROM payments p JOIN students s ON s.id = p.student_id
             LEFT JOIN enrollments e ON e.student_id = s.id AND e.year_id = YEAR(p.paid_on)
             LEFT JOIN courses c ON c.id = e.course_id
             WHERE p.id = ?",
            [$paymentId],
        ) ?? throw new DomainError('not_found', 'El pago no existe.');
        $items = $this->db->all('SELECT c.description, pa.amount FROM payment_allocations pa JOIN charges c ON c.id = pa.charge_id WHERE pa.payment_id = ? ORDER BY pa.id', [$paymentId]);
        return [
            'id' => (int) $p['id'], 'receipt' => $p['receipt_number'], 'status' => $p['status'],
            'student' => trim("{$p['last_name']} {$p['second_last_name']}, {$p['first_name']} {$p['middle_name']}"), 'studentId' => (int) $p['student_id'], 'code' => $p['code'], 'course' => $p['course'],
            'paidOn' => $p['paid_on'], 'method' => $p['method'], 'reference' => $p['reference'], 'notes' => $p['notes'], 'amount' => (int) $p['amount'],
            'createdBy' => $p['created_by'], 'items' => array_map(static fn($i) => ['description' => $i['description'], 'amount' => (int) $i['amount']], $items),
            'school' => $this->settings->get('school', ['name' => 'Jardín Infantil Gabush']),
        ];
    }

    /** Students that owe money (open balance above $min), with what is overdue. @return list<array<string,mixed>> */
    public function debtors(int $year, int $min = 1): array
    {
        $students = $this->db->all(
            "SELECT DISTINCT s.id, s.code, s.first_name AS firstName, s.last_name AS lastName, s.second_last_name AS secondLastName, c.name AS course,
                    g.full_name AS guardian, g.phone AS guardianPhone, e.status
             FROM charges ch JOIN students s ON s.id = ch.student_id
             LEFT JOIN enrollments e ON e.student_id = s.id AND e.year_id = ?
             LEFT JOIN courses c ON c.id = e.course_id
             LEFT JOIN guardians g ON g.family_id = s.family_id AND g.is_billing = 1
             WHERE ch.status = 'abierto'",
            [$year],
        );
        $out = [];
        foreach ($students as $s) {
            $sum = $this->summary((int) $s['id']);
            if ($sum['balance'] < $min) continue;
            $out[] = ['id' => (int) $s['id']] + $s + $sum;
        }
        usort($out, static fn($a, $b) => $b['balance'] <=> $a['balance']);
        return $out;
    }
}
