<?php
// Admin only — plans (prices) and payments.
// GET  /api/billing.php                                              → { plans, payments }
// POST /api/billing.php {action:"plans", plans:[…]}                   → { plans }
// POST /api/billing.php {action:"pay", payment:{studentId, amount, date, kind, note}} → { payment }
// POST /api/billing.php {action:"unpay", id}                          → { ok }
// POST /api/billing.php {action:"charge", charge:{studentId, amount, date, concept}} → { charge }   extra one-off charge
// POST /api/billing.php {action:"uncharge", id}                       → { ok }
// POST /api/billing.php {action:"template", template}                 → { template }   WhatsApp payment reminder
// POST /api/billing.php {action:"mode", mode}                         → { mode }   mensualidad: "vencido" (al cumplir el mes) | "anticipado
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

const MAX_PLANS = 20;

function default_plans(): array
{
    return [
        ['id' => 'mensual-manana', 'name' => 'Mensual · jornada mañana', 'type' => 'mensual', 'shift' => 'manana', 'price' => 0],
        ['id' => 'mensual-tarde', 'name' => 'Mensual · jornada tarde', 'type' => 'mensual', 'shift' => 'tarde', 'price' => 0],
        ['id' => 'dia-manana', 'name' => 'Por día · jornada mañana', 'type' => 'dia', 'shift' => 'manana', 'price' => 0],
        ['id' => 'dia-tarde', 'name' => 'Por día · jornada tarde', 'type' => 'dia', 'shift' => 'tarde', 'price' => 0],
    ];
}

$file = rp_data_dir() . '/billing.json';
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    rp_require_admin_read();
    $data = rp_read_json($file);
    // plans are needed to register students; payments only for whoever handles them
    $money = rp_can('pagos');
    rp_json(200, ['ok' => true, 'plans' => $data['plans'] ?? default_plans(), 'payments' => $money ? ($data['payments'] ?? []) : [], 'charges' => $money ? ($data['charges'] ?? []) : [], 'monthlyMode' => $data['monthlyMode'] ?? 'vencido', 'reminderTemplate' => $data['reminderTemplate'] ?? '']);
}
if ($method !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}
rp_require_admin();
$in = rp_body(20000);
$action = $in['action'] ?? '';
rp_require_perm(in_array($action, ['plans', 'template', 'mode'], true) ? 'ajustes' : 'pagos');

if ($action === 'plans') {
    $plans = [];
    foreach (array_slice((array) ($in['plans'] ?? []), 0, MAX_PLANS) as $p) {
        $plan = [
            'id'    => preg_replace('/[^a-z0-9-]/', '', strtolower(rp_clean($p['id'] ?? '', 40))) ?: rp_uid(),
            'name'  => rp_clean($p['name'] ?? '', 60),
            'type'  => ($p['type'] ?? '') === 'dia' ? 'dia' : 'mensual',
            'shift' => ($p['shift'] ?? '') === 'tarde' ? 'tarde' : 'manana',
            'price' => max(0, min(100000000, (int) ($p['price'] ?? 0))),
        ];
        if (mb_strlen($plan['name']) < 2) rp_json(422, ['ok' => false, 'error' => 'validation', 'fields' => ['name']]);
        $plans[] = $plan;
    }
    if (!$plans) rp_json(422, ['ok' => false, 'error' => 'validation', 'fields' => ['plans']]);
    rp_with_json($file, function (array $data) use ($plans) {
        $data['plans'] = $plans;
        return [$data, null];
    });
    rp_json(200, ['ok' => true, 'plans' => $plans]);
}

if ($action === 'pay') {
    $p = (array) ($in['payment'] ?? []);
    $payment = [
        'id'        => rp_uid(),
        'studentId' => rp_clean($p['studentId'] ?? '', 32),
        'amount'    => (int) ($p['amount'] ?? 0),
        'date'      => rp_clean($p['date'] ?? '', 10),
        'kind'      => in_array($p['kind'] ?? '', ['dia', 'extra'], true) ? $p['kind'] : 'mensual',
        'note'      => rp_clean($p['note'] ?? '', 200),
        'createdAt' => date('c'),
    ];
    // "por día": the attended days this payment covers, each with the amount actually charged (and why, if it changed)
    if ($payment['kind'] === 'dia' && is_array($p['items'] ?? null)) {
        $items = [];
        foreach (array_slice($p['items'], 0, 500) as $it) {
            $d = rp_clean((string) ($it['date'] ?? ''), 10);
            $a = (int) ($it['amount'] ?? -1);
            if (!rp_valid_date($d) || $a < 0 || $a > 10000000 || isset($items[$d])) continue;
            $items[$d] = ['date' => $d, 'amount' => $a, 'note' => rp_clean($it['note'] ?? '', 120)];
        }
        ksort($items);
        if ($items) {
            $payment['items'] = array_values($items);
            $payment['days'] = array_keys($items);
            $payment['amount'] = array_sum(array_column($items, 'amount'));
        }
    } elseif ($payment['kind'] === 'dia' && is_array($p['days'] ?? null)) {
        $days = array_values(array_unique(array_filter(array_map(fn($d) => rp_clean((string) $d, 10), array_slice($p['days'], 0, 500)), 'rp_valid_date')));
        sort($days);
        if ($days) $payment['days'] = $days;
    }
    // an extra charge paid on the spot: linked, so deleting the charge also removes this payment
    if ($payment['kind'] === 'extra' && !empty($p['chargeId'])) $payment['chargeId'] = rp_clean($p['chargeId'], 32);
    if ($payment['studentId'] === '' || $payment['amount'] < 0 || $payment['amount'] > 100000000 || !rp_valid_date($payment['date'])) {
        rp_json(422, ['ok' => false, 'error' => 'validation']);
    }
    rp_with_json($file, function (array $data) use ($payment) {
        $data['plans'] ??= default_plans();
        $data['payments'][] = $payment;
        return [$data, null];
    });
    rp_json(200, ['ok' => true, 'payment' => $payment]);
}

if ($action === 'unpay') {
    $id = rp_clean($in['id'] ?? '', 32);
    $found = rp_with_json($file, function (array $data) use ($id) {
        $list = $data['payments'] ?? [];
        $left = array_values(array_filter($list, fn($p) => $p['id'] !== $id));
        $data['payments'] = $left;
        return [$data, count($left) !== count($list)];
    });
    rp_json($found ? 200 : 404, ['ok' => $found]);
}

if ($action === 'template') {
    $template = is_string($in['template'] ?? null) ? mb_substr(trim(str_replace("\r", '', $in['template'])), 0, 1500) : '';
    rp_with_json($file, function (array $data) use ($template) {
        $data['plans'] ??= default_plans();
        $data['reminderTemplate'] = $template;
        return [$data, null];
    });
    rp_json(200, ['ok' => true, 'template' => $template]);
}

if ($action === 'mode') {
    $mode = ($in['mode'] ?? '') === 'anticipado' ? 'anticipado' : 'vencido';
    rp_with_json($file, function (array $data) use ($mode) {
        $data['plans'] ??= default_plans();
        $data['monthlyMode'] = $mode;
        return [$data, null];
    });
    rp_json(200, ['ok' => true, 'mode' => $mode]);
}

if ($action === 'charge') {
    $c = (array) ($in['charge'] ?? []);
    $charge = [
        'id'        => rp_uid(),
        'studentId' => rp_clean($c['studentId'] ?? '', 32),
        'amount'    => (int) ($c['amount'] ?? 0),
        'date'      => rp_clean($c['date'] ?? '', 10),
        'concept'   => rp_clean($c['concept'] ?? '', 100),
        'createdAt' => date('c'),
    ];
    if ($charge['studentId'] === '' || $charge['amount'] <= 0 || $charge['amount'] > 100000000 || !rp_valid_date($charge['date']) || mb_strlen($charge['concept']) < 2) {
        rp_json(422, ['ok' => false, 'error' => 'validation']);
    }
    rp_with_json($file, function (array $data) use ($charge) {
        $data['plans'] ??= default_plans();
        $data['charges'][] = $charge;
        return [$data, null];
    });
    rp_json(200, ['ok' => true, 'charge' => $charge]);
}

if ($action === 'uncharge') {
    $id = rp_clean($in['id'] ?? '', 32);
    $found = rp_with_json($file, function (array $data) use ($id) {
        $list = $data['charges'] ?? [];
        $left = array_values(array_filter($list, fn($c) => $c['id'] !== $id));
        $data['charges'] = $left;
        // its "ya lo pagó" payment goes too
        $data['payments'] = array_values(array_filter($data['payments'] ?? [], fn($p) => ($p['chargeId'] ?? '') !== $id));
        return [$data, count($left) !== count($list)];
    });
    rp_json($found ? 200 : 404, ['ok' => $found]);
}

rp_json(400, ['ok' => false, 'error' => 'validation']);
