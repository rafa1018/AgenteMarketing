<?php
declare(strict_types=1);

namespace Gabush\Domain\Billing;

use DateTimeImmutable;

/**
 * Late-payment fee ("mora") from the enrolment contract, configured by the rectora:
 *  - mode "mes" (Gabush): a fixed amount for every month a charge stays unpaid, counted once the grace days
 *    have passed — due Oct 5, 5 grace days: Oct 10 → 1 × $10.000, Nov 10 → 2 × $10.000…
 *  - mode "dia": the amount for every day late after the grace days.
 * Optional cap per charge. It only applies to concepts marked "late_fee_applies" and to charges due on/after
 * `appliesFrom` (debts imported from the old system never get retroactive fees).
 */
final class LateFeePolicy
{
    public const MODES = ['dia', 'mes'];

    public function __construct(
        public readonly bool $enabled = true,
        public readonly int $amountPerDay = 10000,    // the fee amount per period (day or month, see $mode)
        public readonly int $dueDay = 5,              // monthly charges fall due on this day of their month
        public readonly int $graceDays = 0,           // days after the due date that are still free
        public readonly ?int $maxAmount = null,       // cap per charge (null = no cap)
        public readonly ?string $appliesFrom = null,  // Y-m-d: charges due before this date never accrue fees
        public readonly string $mode = 'dia',
    ) {
    }

    /** @param array<string,mixed> $s settings row */
    public static function fromSettings(array $s): self
    {
        $from = (string) ($s['appliesFrom'] ?? '');
        return new self(
            (bool) ($s['enabled'] ?? true),
            max(0, (int) ($s['amountPerDay'] ?? 10000)),
            min(28, max(1, (int) ($s['dueDay'] ?? 5))),
            max(0, (int) ($s['graceDays'] ?? 0)),
            isset($s['maxAmount']) && $s['maxAmount'] !== '' && $s['maxAmount'] !== null ? max(0, (int) $s['maxAmount']) : null,
            preg_match('/^\d{4}-\d{2}-\d{2}$/', $from) ? $from : null,
            in_array($s['mode'] ?? 'dia', self::MODES, true) ? (string) ($s['mode'] ?? 'dia') : 'dia',
        );
    }

    /** @return array<string,mixed> */
    public function toArray(): array
    {
        return ['enabled' => $this->enabled, 'amountPerDay' => $this->amountPerDay, 'dueDay' => $this->dueDay, 'graceDays' => $this->graceDays, 'maxAmount' => $this->maxAmount, 'appliesFrom' => $this->appliesFrom, 'mode' => $this->mode];
    }

    /** Due date of a monthly charge for the month that starts on $periodMonth. */
    public function dueDateFor(DateTimeImmutable $periodMonth): DateTimeImmutable
    {
        return $periodMonth->setDate((int) $periodMonth->format('Y'), (int) $periodMonth->format('m'), $this->dueDay);
    }

    private function applies(DateTimeImmutable $dueOn): bool
    {
        return $this->enabled && ($this->appliesFrom === null || $dueOn->format('Y-m-d') >= $this->appliesFrom);
    }

    /** Days counted as late on $until (the payment date, or today while the charge is open). */
    public function daysLate(DateTimeImmutable $dueOn, DateTimeImmutable $until): int
    {
        if (!$this->applies($dueOn)) return 0;
        $start = $dueOn->setTime(0, 0)->modify('+' . $this->graceDays . ' days');
        $end = $until->setTime(0, 0);
        if ($end <= $start) return 0;
        return (int) $start->diff($end)->days;
    }

    /**
     * Months of late fee on $until: one when the grace days after the due date have passed, and one more on
     * the same day of each following month (due Oct 5 + 5 days: Oct 10 → 1, Nov 10 → 2, Dec 10 → 3).
     * Without grace days the first one counts from the day after the due date.
     */
    public function monthsLate(DateTimeImmutable $dueOn, DateTimeImmutable $until): int
    {
        if (!$this->applies($dueOn)) return 0;
        $due = $dueOn->setTime(0, 0);
        $end = $until->setTime(0, 0);
        $offset = '+' . max(1, $this->graceDays) . ' days';
        $n = 0;
        while ($n < 240 && $end >= $due->modify("+$n months")->modify($offset)) $n++;
        return $n;
    }

    /** @return array{days:int,amount:int} days = days late (for the record), amount = fee by the configured mode */
    public function feeFor(DateTimeImmutable $dueOn, DateTimeImmutable $until): array
    {
        $days = $this->daysLate($dueOn, $until);
        $fee = $this->mode === 'mes' ? $this->monthsLate($dueOn, $until) * $this->amountPerDay : $days * $this->amountPerDay;
        if ($this->maxAmount !== null) $fee = min($fee, $this->maxAmount);
        // in month mode the days still describe how late it is (grace days included in the count)
        if ($this->mode === 'mes') $days = $fee > 0 ? (int) $dueOn->setTime(0, 0)->diff($until->setTime(0, 0))->days : 0;
        return ['days' => $days, 'amount' => $fee];
    }

    /** Text for the adjustment: "Mora: 2 meses de atraso (40 días)" / "Mora: 3 días de retraso". */
    public function describe(DateTimeImmutable $dueOn, DateTimeImmutable $until): string
    {
        if ($this->mode === 'mes') {
            $m = $this->monthsLate($dueOn, $until);
            $d = (int) $dueOn->setTime(0, 0)->diff($until->setTime(0, 0))->days;
            return "Mora: $m " . ($m === 1 ? 'mes' : 'meses') . " de atraso ($d días)";
        }
        $d = $this->daysLate($dueOn, $until);
        return "Mora: $d " . ($d === 1 ? 'día' : 'días') . ' de retraso';
    }
}
