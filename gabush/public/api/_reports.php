<?php
// Server-side summaries for the daily reminders (same rules as src/admin/logic.ts).
defined('RP_API') || exit;

function rep_data(): array
{
    $d = rp_data_dir();
    $billing = rp_read_json("$d/billing.json");
    return [
        'students'   => rp_read_json("$d/students.json")['students'] ?? [],
        'plans'      => $billing['plans'] ?? [],
        'payments'   => $billing['payments'] ?? [],
        'charges'    => $billing['charges'] ?? [],
        'mode'       => $billing['monthlyMode'] ?? 'vencido',
        'attendance' => rp_read_json("$d/attendance.json")['days'] ?? [],
        'schedule'   => rp_read_json("$d/settings.json")['schedule'] ?? null,
        'events'     => rp_read_json("$d/events.json")['events'] ?? [],
    ];
}

function rep_enrolled(array $st, string $date): bool
{
    $periods = $st['periods'] ?? [['start' => $st['startDate'], 'end' => !empty($st['active']) ? null : $st['startDate']]];
    foreach ($periods as $p) {
        if ($p['start'] <= $date && ($p['end'] === null || $date <= $p['end'])) return true;
    }
    return false;
}

/** Club open on a date? (weekly schedule; holidays close it) */
function rep_is_open(array $data, string $date): bool
{
    foreach ($data['events'] as $e) {
        if (($e['type'] ?? '') === 'festivo' && $e['start'] <= $date && $e['end'] >= $date) return false;
    }
    $days = $data['schedule']['days'] ?? null;
    $wd = (int) date('N', strtotime($date)) - 1; // Monday = 0
    return $days ? !empty($days[$wd]['open']) : $wd < 5;
}

/** Due date of monthly period k. "vencido": first payment one month after entry; "anticipado": on the entry day. */
function rep_period_due(array $st, int $k, string $mode = 'vencido'): string
{
    if ($mode !== 'anticipado') $k++;
    if ($k === 0) return $st['startDate'];
    [$y, $m] = array_map('intval', explode('-', $st['startDate']));
    $first = mktime(0, 0, 0, $m + $k, 1, $y);
    $day = min((int) ($st['billingDay'] ?? 1), (int) date('t', $first));
    return date('Y-m-', $first) . str_pad((string) $day, 2, '0', STR_PAD_LEFT);
}

/** Students who owe something today: [[name, amount, label], …] */
function rep_dues(array $data, string $today): array
{
    $out = [];
    foreach ($data['students'] as $st) {
        $enrolled = rep_enrolled($st, $today);
        $plan = current(array_filter($data['plans'], fn($p) => $p['id'] === $st['planId'])) ?: null;
        $price = $st['price'] ?? ($plan['price'] ?? 0);
        $mine = array_filter($data['payments'], fn($p) => $p['studentId'] === $st['id']);
        $name = trim($st['firstName'] . ' ' . $st['lastName']);
        $amount = 0;
        $label = '';

        // inactive students keep their debts, but no new monthly fees after they left
        $periods = $st['periods'] ?? [];
        $last = $periods ? end($periods) : null;
        $cutoff = !$enrolled && $last && $last['end'] && $last['end'] < $today ? $last['end'] : $today;
        if (($plan['type'] ?? 'mensual') === 'dia') {
            // attended days, each paid by a payment that lists it, or (older payments without a list) oldest first
            $attended = [];
            $firstStart = ($st['periods'][0]['start'] ?? null) ?: $st['startDate'];
            foreach ($data['attendance'] as $date => $day) {
                $m = $day[$st['id']] ?? null;
                if ($m && $m['s'] === 'a' && $date >= $firstStart && $date <= $cutoff) $attended[$date] = $m['p'] ?? $price;
            }
            ksort($attended);
            $paidDays = [];
            $credit = 0;
            foreach ($mine as $p) {
                if ($p['kind'] !== 'dia') continue;
                if (!empty($p['days'])) foreach ($p['days'] as $d) $paidDays[$d] = true;
                else $credit += $p['amount'];
            }
            $amount = 0;
            $count = 0;
            foreach ($attended as $date => $value) {
                if (isset($paidDays[$date])) continue;
                if ($credit >= $value) {
                    $credit -= $value;
                    continue;
                }
                $amount += $value;
                $count++;
            }
            $amount = max(0, $amount - $credit);
            $label = $count === 1 ? '1 día' : "$count días";
        } elseif ($price > 0) {
            $from = date('Y-m-d', strtotime($st['startDate'] . ' -15 days'));
            $paidPeriods = count(array_filter($mine, fn($p) => $p['kind'] === 'mensual' && $p['date'] >= $from));
            $overdue = 0;
            $mode = $st['monthlyMode'] ?? $data['mode'];
            while ($overdue < 36 && rep_period_due($st, $paidPeriods + $overdue, $mode) <= $cutoff) $overdue++;
            if ($overdue) {
                $amount = $overdue * $price;
                $due = rep_period_due($st, $paidPeriods, $mode);
                $label = $due === $today ? 'vence hoy' : 'vencido';
                if (!$enrolled) $label .= ' (inactivo)';
            }
        }
        // one-off extras
        $extra = array_sum(array_map(fn($c) => $c['studentId'] === $st['id'] ? $c['amount'] : 0, $data['charges']))
               - array_sum(array_map(fn($p) => $p['kind'] === 'extra' ? $p['amount'] : 0, $mine));
        if ($extra > 0) {
            $amount += $extra;
            $label = $label ? "$label + extra" : 'extra';
        }
        if ($amount > 0) $out[] = [$name, $amount, $label];
    }
    usort($out, fn($a, $b) => $b[1] <=> $a[1]);
    return $out;
}

/** Enrolled students without an attendance mark today (optionally only one shift: manana | tarde). */
function rep_attendance_pending(array $data, string $today, ?string $shift = null): array
{
    $marked = $data['attendance'][$today] ?? [];
    $out = [];
    foreach ($data['students'] as $st) {
        if (!rep_enrolled($st, $today) || isset($marked[$st['id']])) continue;
        $plan = current(array_filter($data['plans'], fn($p) => $p['id'] === $st['planId'])) ?: null;
        // only students whose attendance is taken (default: plan por día)
        if (!($st['attendance'] ?? (($plan['type'] ?? 'mensual') === 'dia'))) continue;
        if ($shift) {
            if (($plan['shift'] ?? 'manana') !== $shift) continue;
        }
        $out[] = $st['firstName'];
    }
    return $out;
}

function rep_money(int $n): string
{
    return '$' . number_format($n, 0, ',', '.');
}

/** Enrolled students whose birthday is today: ["Santiago (8 años)", …]. Feb 29 birthdays are celebrated on Feb 28 in common years. */
function rep_birthdays(array $data, string $today): array
{
    [$y, $m, $d] = array_map('intval', explode('-', $today));
    $out = [];
    foreach ($data['students'] as $st) {
        $b = $st['birthDate'] ?? null;
        if (!$b || !rep_enrolled($st, $today)) continue;
        [$by, $bm, $bd] = array_map('intval', explode('-', $b));
        if ($bm === 2 && $bd === 29 && !checkdate(2, 29, $y)) $bd = 28;
        if ($bm === $m && $bd === $d) $out[] = $st['firstName'] . ' (' . ($y - $by) . ' años)';
    }
    return $out;
}

/** "Ana, Luis y 3 más" */
function rep_names(array $names, int $max = 3): string
{
    $shown = array_slice($names, 0, $max);
    $rest = count($names) - count($shown);
    if ($rest > 0) return implode(', ', $shown) . " y $rest más";
    if (count($shown) > 1) return implode(', ', array_slice($shown, 0, -1)) . ' y ' . end($shown);
    return $shown[0] ?? '';
}

/**
 * Daily reminders, each sent at most once a day inside its time window (Colombia time).
 * Runs from cron.php (recommended) and, as a fallback, after public page visits.
 */
function push_maybe_reminders(): void
{
    $now = date('H:i');
    $today = date('Y-m-d');
    $windows = [
        'pagos'             => ['07:00', '20:00'],
        'asistencia-manana' => ['11:30', '14:00'],
        'asistencia-tarde'  => ['17:15', '20:00'],
        'cumpleanos'        => ['07:00', '20:00'],
        'eventos'           => ['07:00', '20:00'],
    ];
    $file = rp_data_dir() . '/push.json';
    $state = rp_read_json($file);
    if (empty($state['subs'])) return;
    $due = array_keys(array_filter($windows, fn($w, $k) => $now >= $w[0] && $now <= $w[1] && !in_array($k, $state['sent'][$today] ?? [], true), ARRAY_FILTER_USE_BOTH));
    if (!$due) return;

    // claim the reminders first so parallel requests never send twice
    $claimed = rp_with_json($file, function (array $data) use ($due, $today) {
        $already = $data['sent'][$today] ?? [];
        $mine = array_values(array_diff($due, $already));
        $data['sent'] = [$today => array_values(array_unique(array_merge($already, $mine)))]; // keep only today
        return [$data, $mine];
    });
    if (!$claimed) return;

    $data = rep_data();
    $open = rep_is_open($data, $today);
    foreach ($claimed as $kind) {
        if ($kind === 'eventos') {
            $todays = array_values(array_filter($data['events'], fn($e) => ($e['type'] ?? '') !== 'festivo' && $e['start'] <= $today && $e['end'] >= $today));
            if (!$todays) continue;
            $titles = array_map(fn($e) => (($e['visibility'] ?? 'publico') === 'privado' ? '🔒 ' : '') . $e['title'], $todays);
            push_notify('eventos', [
                'title' => count($titles) === 1 ? '📅 Hoy: ' . $titles[0] : '📅 Eventos de hoy: ' . count($titles),
                'body'  => count($titles) === 1 ? ($todays[0]['description'] ?: 'Toca para ver el calendario.') : implode(' · ', $titles),
                'url'   => '/admin/#/calendario',
                'tag'   => 'eventos',
            ]);
        } elseif ($kind === 'cumpleanos') {
            $list = rep_birthdays($data, $today);
            if (!$list) continue;
            push_notify('cumpleanos', [
                'title' => count($list) === 1 ? '🎂 Hoy cumple años ' . $list[0] : '🎂 Cumpleaños de hoy: ' . count($list),
                'body'  => count($list) === 1 ? '¡No olvides felicitarlo!' : rep_names($list, 5) . '. ¡No olvides felicitarlos!',
                'url'   => '/admin/#/inicio',
                'tag'   => 'cumpleanos',
            ]);
        } elseif ($kind === 'pagos') {
            $dues = rep_dues($data, $today);
            if (!$dues) continue;
            $total = array_sum(array_column($dues, 1));
            push_notify('pagos', [
                'title' => '💰 Pagos pendientes: ' . rep_money($total),
                'body'  => (count($dues) === 1 ? '1 estudiante' : count($dues) . ' estudiantes') . ': ' . rep_names(array_map(fn($d) => explode(' ', $d[0])[0] . ' ' . rep_money($d[1]), $dues)),
                'url'   => '/admin/#/pagos',
                'tag'   => 'pagos',
            ]);
        } elseif ($open) {
            $shift = $kind === 'asistencia-manana' ? 'manana' : null;
            $pending = rep_attendance_pending($data, $today, $shift);
            if (!$pending) continue;
            push_notify('asistencia', [
                'title' => '✅ Asistencia sin marcar: ' . count($pending),
                'body'  => ($shift ? 'Jornada mañana: ' : 'Hoy: ') . rep_names($pending) . '. Toca para marcar.',
                'url'   => '/admin/#/asistencia',
                'tag'   => 'asistencia',
            ]);
        }
    }
}
