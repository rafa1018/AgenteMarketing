<?php
declare(strict_types=1);

namespace Gabush\Domain\Billing;

use DateTimeImmutable;

/**
 * Late-payment fee ("mora") from the enrolment contract: every day a charge stays unpaid after its due
 * date adds a fixed amount (Gabush: $10.000 per day), optionally after some grace days and up to a cap.
 * The rectora configures it in the panel; it only applies to concepts marked "late_fee_applies" and to
 * charges due on/after `appliesFrom` (so debts imported from the old system do not get retroactive fees).
 */
final class LateFeePolicy
{
    public function __construct(
        public readonly bool $enabled = true,
        public readonly int $amountPerDay = 10000,
        public readonly int $dueDay = 5,              // monthly charges fall due on this day of their month
        public readonly int $graceDays = 0,           // days after the due date that are still free
        public readonly ?int $maxAmount = null,       // cap per charge (null = no cap)
        public readonly ?string $appliesFrom = null,  // Y-m-d: charges due before this date never accrue fees
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
        );
    }

    /** @return array<string,mixed> */
    public function toArray(): array
    {
        return ['enabled' => $this->enabled, 'amountPerDay' => $this->amountPerDay, 'dueDay' => $this->dueDay, 'graceDays' => $this->graceDays, 'maxAmount' => $this->maxAmount, 'appliesFrom' => $this->appliesFrom];
    }

    /** Due date of a monthly charge for the month that starts on $periodMonth. */
    public function dueDateFor(DateTimeImmutable $periodMonth): DateTimeImmutable
    {
        return $periodMonth->setDate((int) $periodMonth->format('Y'), (int) $periodMonth->format('m'), $this->dueDay);
    }

    /** Days counted as late on $until (the payment date, or today while the charge is open). */
    public function daysLate(DateTimeImmutable $dueOn, DateTimeImmutable $until): int
    {
        if (!$this->enabled) return 0;
        if ($this->appliesFrom !== null && $dueOn->format('Y-m-d') < $this->appliesFrom) return 0;
        $start = $dueOn->setTime(0, 0)->modify('+' . $this->graceDays . ' days');
        $end = $until->setTime(0, 0);
        if ($end <= $start) return 0;
        return (int) $start->diff($end)->days;
    }

    /** @return array{days:int,amount:int} */
    public function feeFor(DateTimeImmutable $dueOn, DateTimeImmutable $until): array
    {
        $days = $this->daysLate($dueOn, $until);
        $fee = $days * $this->amountPerDay;
        if ($this->maxAmount !== null) $fee = min($fee, $this->maxAmount);
        return ['days' => $days, 'amount' => $fee];
    }
}
