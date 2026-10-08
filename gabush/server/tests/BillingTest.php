<?php
declare(strict_types=1);

use Gabush\Domain\Billing\ChargeBalance;
use Gabush\Domain\Billing\LateFeePolicy;
use Gabush\Domain\Billing\PaymentAllocator;
use Gabush\Domain\Shared\DomainError;

$d = static fn(string $s) => new DateTimeImmutable($s);

// ── mora: $10.000 por día después del vencimiento ──
$p = new LateFeePolicy(true, 10000, 5);
same('2026-10-05', $p->dueDateFor($d('2026-10-01'))->format('Y-m-d'), 'vence el día 5 del mes');
same(['days' => 0, 'amount' => 0], $p->feeFor($d('2026-10-05'), $d('2026-10-05')), 'el día del vencimiento no hay mora');
same(['days' => 1, 'amount' => 10000], $p->feeFor($d('2026-10-05'), $d('2026-10-06')), 'un día tarde = 10.000');
same(['days' => 12, 'amount' => 120000], $p->feeFor($d('2026-10-05'), $d('2026-10-17 15:30')), 'doce días tarde = 120.000');
same(['days' => 0, 'amount' => 0], $p->feeFor($d('2026-10-05'), $d('2026-10-02')), 'pagado antes de vencer');
$grace = new LateFeePolicy(true, 10000, 5, 2);
same(['days' => 1, 'amount' => 10000], $grace->feeFor($d('2026-10-05'), $d('2026-10-08')), 'con 2 días de gracia, el 8 cuenta 1 día');
$cap = new LateFeePolicy(true, 10000, 5, 0, 50000);
same(50000, $cap->feeFor($d('2026-10-05'), $d('2026-11-05'))['amount'], 'tope de mora');
$off = new LateFeePolicy(false);
same(0, $off->feeFor($d('2026-10-05'), $d('2026-11-05'))['amount'], 'mora desactivada');
same(['enabled' => true, 'amountPerDay' => 10000, 'dueDay' => 28, 'graceDays' => 0, 'maxAmount' => null, 'appliesFrom' => null], LateFeePolicy::fromSettings(['dueDay' => 31])->toArray(), 'el día de vencimiento se limita a 28');
$from = LateFeePolicy::fromSettings(['appliesFrom' => '2026-11-01']);
same(0, $from->feeFor($d('2026-10-05'), $d('2026-11-20'))['amount'], 'cobros que vencieron antes de activar la mora no la generan');
same(30000, $from->feeFor($d('2026-11-05'), $d('2026-11-08'))['amount'], 'cobros que vencen después sí');
same(['amount' => 320000, 'discounts' => 320000, 'surcharges' => 0, 'lateFees' => 0, 'net' => 0, 'paid' => 0, 'balance' => 0], ChargeBalance::of(320000, [['kind' => 'traslado', 'amount' => 320000]], 0)->toArray(), 'un traslado de saldo cierra la deuda del año anterior');

// ── saldo de un cobro ──
$b = ChargeBalance::of(320000, [['kind' => 'descuento', 'amount' => 20000], ['kind' => 'mora', 'amount' => 30000], ['kind' => 'mora', 'amount' => 50000, 'waived' => 1], ['kind' => 'recargo', 'amount' => 5000]], 100000);
same(335000, $b->net(), 'valor neto = 320.000 − 20.000 + 5.000 + 30.000 (la mora perdonada no cuenta)');
same(235000, $b->balance(), 'saldo después de abonar 100.000');
check(!$b->isSettled(), 'el cobro sigue abierto');
check(ChargeBalance::of(320000, [], 320000)->isSettled(), 'pagado completo queda saldado');

// ── reparto de pagos ──
$open = [['id' => 3, 'balance' => 320000, 'due_on' => '2026-10-05'], ['id' => 1, 'balance' => 320000, 'due_on' => '2026-08-05'], ['id' => 2, 'balance' => 100000, 'due_on' => '2026-09-05']];
same(['allocations' => [['charge_id' => 1, 'amount' => 320000], ['charge_id' => 2, 'amount' => 100000], ['charge_id' => 3, 'amount' => 80000]], 'credit' => 0], PaymentAllocator::allocate(500000, $open), 'sin elegir, se pagan primero los más antiguos');
same(['allocations' => [['charge_id' => 3, 'amount' => 320000]], 'credit' => 30000], PaymentAllocator::allocate(350000, $open, [3]), 'eligiendo un cobro, lo que sobra queda a favor');
try {
    PaymentAllocator::allocate(1000, $open, [99]);
    check(false, 'un cobro inexistente debe fallar');
} catch (DomainError $e) {
    same('charge', $e->rule,'cobro elegido que no está pendiente');
}
