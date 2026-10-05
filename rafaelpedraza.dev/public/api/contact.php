<?php
// POST /api/contact.php — validates the form, saves it in the admin inbox (messages.json),
// then forwards it to Telegram and to the admin's phone (push).
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_push.php';
rp_check_origin($CONFIG);

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST');
    header('Access-Control-Allow-Headers: Content-Type');
    rp_json(204, []);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}

$raw = file_get_contents('php://input', false, null, 0, 20000);
$in = json_decode($raw ?: '', true);
if (!is_array($in)) {
    rp_json(400, ['ok' => false, 'error' => 'validation']);
}

$clean = static function ($v, int $max): string {
    $v = is_string($v) ? $v : '';
    $v = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v) ?? '';
    return mb_substr(trim($v), 0, $max);
};

$name    = $clean($in['name'] ?? '', 80);
$subject = $clean($in['subject'] ?? '', 120);
$phone   = $clean($in['phone'] ?? '', 25);
$message = $clean($in['message'] ?? '', 2000);
$lang    = ($in['lang'] ?? 'es') === 'en' ? 'en' : 'es';

// Anti-spam: honeypot must stay empty, and humans need a few seconds to fill the form.
$honeypot = $in['website'] ?? '';
$elapsed  = (int) ($in['elapsed'] ?? 0);
if ($honeypot !== '' || $elapsed < 3000) {
    // Pretend success so bots learn nothing.
    rp_json(200, ['ok' => true]);
}

$errors = [];
if (mb_strlen($name) < 2) $errors[] = 'name';
if (mb_strlen($subject) < 3) $errors[] = 'subject';
if (!preg_match('/^\+?[0-9 ()\-.]{7,25}$/', $phone)) $errors[] = 'phone';
if (mb_strlen($message) < 10) $errors[] = 'message';
if (preg_match_all('#https?://#i', $message) > 2) $errors[] = 'message';
if ($errors) {
    rp_json(422, ['ok' => false, 'error' => 'validation', 'fields' => array_values(array_unique($errors))]);
}

// Rate limiting (per hashed IP + global), sliding window.
$client = rp_client_hash($CONFIG);
$now = time();
$limited = rp_with_json(rp_data_dir() . '/ratelimit.json', function (array $data) use ($client, $now, $CONFIG) {
    $win = $CONFIG['rate_limit']['window'];
    $gwin = $CONFIG['global_rate_limit']['window'];
    foreach ($data as $k => $stamps) {
        $data[$k] = array_values(array_filter($stamps, fn($t) => $t > $now - max($win, $gwin)));
        if (!$data[$k]) unset($data[$k]);
    }
    $mine = array_filter($data[$client] ?? [], fn($t) => $t > $now - $win);
    $all = count(array_filter($data['_global'] ?? [], fn($t) => $t > $now - $gwin));
    if (count($mine) >= $CONFIG['rate_limit']['max'] || $all >= $CONFIG['global_rate_limit']['max']) {
        return [$data, true];
    }
    $data[$client][] = $now;
    $data['_global'][] = $now;
    return [$data, false];
});
if ($limited) {
    rp_json(429, ['ok' => false, 'error' => 'rate_limited']);
}

// Saved first: the admin inbox is the source of truth, Telegram and push are just notifications.
$ip = rp_client_ip();
$ua = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300);
$msg = [
    'id' => rp_uid(),
    't' => $now,
    'name' => $name,
    'phone' => $phone,
    'subject' => $subject,
    'message' => $message,
    'lang' => $lang,
    'ip' => $ip,
    'device' => rp_device($ua)['label'],
    'read' => false,
];
rp_with_json(rp_data_dir() . '/messages.json', function (array $data) use ($msg) {
    $data[] = $msg;
    if (count($data) > 2000) $data = array_slice($data, -2000);
    return [$data, null];
});

rp_json_then_continue(['ok' => true]);

// ── after the response: location of the sender, phone notification and Telegram copy ──
$geo = rp_geo($ip);
$where = implode(', ', array_filter([$geo['city'], $geo['country']]));
if ($where !== '') {
    rp_with_json(rp_data_dir() . '/messages.json', function (array $data) use ($msg, $geo, $where) {
        foreach ($data as $i => $m) if (($m['id'] ?? '') === $msg['id']) $data[$i] += ['place' => $where, 'cc' => $geo['cc']];
        return [$data, null];
    });
}
push_notify('mensajes', ['title' => "✉️ $name", 'body' => "$subject — " . mb_substr($message, 0, 120), 'url' => '/admin/#/mensajes', 'tag' => 'msg-' . $msg['id']]);

// Telegram copy (can be turned off or re-pointed from the admin panel → Ajustes → Telegram).
$tg = rp_telegram();
if (!$tg['enabled']) exit;

$text = "📩 Nuevo mensaje — rafaelpedraza.dev\n\n"
      . "👤 Nombre: {$name}\n"
      . "📞 Teléfono: {$phone}\n"
      . "📌 Asunto: {$subject}\n\n"
      . "💬 Mensaje:\n{$message}\n\n"
      . '🌐 ' . strtoupper($lang) . ' · ' . date('Y-m-d H:i') . ($where !== '' ? " · $where" : '');
rp_telegram_send($tg['token'], $tg['chatId'], $text);