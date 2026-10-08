<?php
declare(strict_types=1);

namespace Gabush\Domain\Billing;

use Gabush\Domain\Shared\DomainError;

/**
 * Splits a payment among open charges ("cargos afectados").
 * - With explicit charge ids (the family chose what to pay online, or the rectora picked them) those are
 *   paid in the given order.
 * - Otherwise the oldest charges are paid first (same rule as Cerkademia).
 * Anything left over stays as credit (saldo a favor) — returned as `credit`.
 */
final class PaymentAllocator
{
    /**
     * @param list<array{id:int,balance:int,due_on:?string}> $openCharges
     * @param list<int>|null $chosen
     * @return array{allocations:list<array{charge_id:int,amount:int}>,credit:int}
     */
    public static function allocate(int $amount, array $openCharges, ?array $chosen = null): array
    {
        if ($amount <= 0) throw new DomainError('amount', 'El valor del pago debe ser mayor que cero.');
        $byId = [];
        foreach ($openCharges as $c) $byId[(int) $c['id']] = $c;
        if ($chosen !== null) {
            $list = [];
            foreach ($chosen as $id) {
                if (!isset($byId[$id])) throw new DomainError('charge', 'Uno de los cobros elegidos ya no está pendiente.');
                $list[] = $byId[$id];
            }
        } else {
            $list = array_values($openCharges);
            usort($list, static fn($a, $b) => [(string) $a['due_on'], $a['id']] <=> [(string) $b['due_on'], $b['id']]);
        }
        $left = $amount;
        $out = [];
        foreach ($list as $c) {
            if ($left <= 0) break;
            $take = min($left, (int) $c['balance']);
            if ($take <= 0) continue;
            $out[] = ['charge_id' => (int) $c['id'], 'amount' => $take];
            $left -= $take;
        }
        return ['allocations' => $out, 'credit' => $left];
    }
}
