<?php
declare(strict_types=1);

namespace Gabush\Domain\Billing;

/**
 * What is owed on one charge:
 *   amount − discounts + surcharges + late fees (not waived) − payments applied = balance.
 * All amounts are whole pesos.
 */
final class ChargeBalance
{
    public function __construct(
        public readonly int $amount,
        public readonly int $discounts = 0,
        public readonly int $surcharges = 0,
        public readonly int $lateFees = 0,
        public readonly int $paid = 0,
    ) {
    }

    /** @param list<array{kind:string,amount:int|string,waived?:int|bool|string}> $adjustments */
    public static function of(int $amount, array $adjustments, int $paid): self
    {
        $d = $s = $m = 0;
        foreach ($adjustments as $a) {
            $v = (int) $a['amount'];
            if ($a['kind'] === 'descuento' || $a['kind'] === 'traslado') $d += $v; // a transfer moves the debt to next year
            elseif ($a['kind'] === 'recargo') $s += $v;
            elseif ($a['kind'] === 'mora' && empty($a['waived'])) $m += $v;
        }
        return new self($amount, $d, $s, $m, $paid);
    }

    public function net(): int
    {
        return max(0, $this->amount - $this->discounts + $this->surcharges + $this->lateFees);
    }

    public function balance(): int
    {
        return max(0, $this->net() - $this->paid);
    }

    public function isSettled(): bool
    {
        return $this->balance() === 0;
    }

    /** @return array<string,int> */
    public function toArray(): array
    {
        return ['amount' => $this->amount, 'discounts' => $this->discounts, 'surcharges' => $this->surcharges, 'lateFees' => $this->lateFees, 'net' => $this->net(), 'paid' => $this->paid, 'balance' => $this->balance()];
    }
}
