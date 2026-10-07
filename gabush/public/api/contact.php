<?php
// POST /api/contact.php — validates the enrolment form and forwards it to Telegram.
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

$child   = $clean($in['child'] ?? '', 100);
$age     = $clean($in['age'] ?? '', 2);
$birth   = $clean($in['birth'] ?? '', 10);
$address = $clean($in['address'] ?? '', 160);
$gender  = $clean($in['gender'] ?? '', 30);
$parent  = $clean($in['parent'] ?? '', 100);
$phone   = $clean($in['phone'] ?? '', 25);
$email   = $clean($in['email'] ?? '', 120);
$program = $clean($in['program'] ?? '', 80);
$message = $clean($in['message'] ?? '', 1500);
$lang    = ($in['lang'] ?? 'es') === 'en' ? 'en' : 'es';

// Anti-spam: honeypot must stay empty, and humans need a few seconds to fill the form.
$honeypot = $in['website'] ?? '';
$elapsed  = (int) ($in['elapsed'] ?? 0);
if ($honeypot !== '' || $elapsed < 4000) {
    // Pretend success so bots learn nothing.
    rp_json(200, ['ok' => true]);
}

$errors = [];
if (mb_strlen($child) < 3) $errors[] = 'child';
if (!preg_match('/^\d{1,2}$/', $age) || (int) $age > 8) $errors[] = 'age';
if ($birth !== '' && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $birth)) $errors[] = 'birth';
if (mb_strlen($address) < 5) $errors[] = 'address';
if (mb_strlen($parent) < 3) $errors[] = 'parent';
if (rp_phone_co($phone) === null) $errors[] = 'phone';
else $phone = rp_phone_co($phone);
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) $errors[] = 'email';
if (preg_match_all('#https?://#i', $message . $address) > 2) $errors[] = 'address';
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

// Keep every enrolment for the admin panel ("Inscripciones"): never deleted, only marked as handled.
$saved = rp_with_json(rp_data_dir() . '/inscriptions.json', function (array $data) use ($child, $age, $birth, $address, $gender, $parent, $phone, $email, $program, $message, $lang) {
    $data['items'][] = [
        'id' => rp_uid(), 'createdAt' => date('c'), 'status' => 'pendiente', 'note' => '',
        'child' => $child, 'age' => $age, 'birth' => $birth, 'address' => $address, 'gender' => $gender,
        'parent' => $parent, 'phone' => $phone, 'email' => $email, 'program' => $program, 'message' => $message, 'lang' => $lang,
    ];
    return [$data, true];
});

$opt = static fn(string $v): string => $v !== '' ? $v : '—';

// Plain text (no parse_mode) so user input can never inject formatting or links.
$text = "🌟 Nueva INSCRIPCIÓN — Gabush Kids\n\n"
      . "1️⃣ Información del niño o niña\n"
      . "🧒 Nombre: {$child}\n"
      . "🎂 Edad: {$age} años\n"
      . '📅 Fecha de nacimiento: ' . $opt($birth) . "\n"
      . "🏠 Dirección: {$address}\n"
      . '⚧ Género: ' . $opt($gender) . "\n\n"
      . "2️⃣ Información familiar\n"
      . "👤 Padre/madre o tutor: {$parent}\n"
      . "📞 Teléfono: {$phone}\n"
      . '✉️ Correo: ' . $opt($email) . "\n"
      . '📚 Programa: ' . $opt($program) . "\n\n"
      . "💬 Observaciones:\n" . $opt($message) . "\n\n"
      . '🌐 ' . strtoupper($lang) . ' · ' . date('Y-m-d H:i') . ' · ' . substr($client, 0, 8);

$url = 'https://api.telegram.org/bot' . $CONFIG['telegram_bot_token'] . '/sendMessage';
$payload = http_build_query([
    'chat_id' => $CONFIG['telegram_chat_id'],
    'text' => $text,
    'disable_web_page_preview' => 'true',
]);

$ok = false;
if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 10,
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $ok = $res !== false && $code === 200;
} else {
    $ctx = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/x-www-form-urlencoded',
        'content' => $payload,
        'timeout' => 10,
    ]]);
    $res = @file_get_contents($url, false, $ctx);
    $ok = $res !== false && (json_decode($res, true)['ok'] ?? false);
}

// Stored above, so a Telegram hiccup no longer loses the enrolment.
if (!$ok && !$saved) {
    rp_json(502, ['ok' => false, 'error' => 'delivery']);
}
http_response_code(200);
echo json_encode(['ok' => true]);
push_finish_response();
push_notify('inscripciones', [
    'title' => '📋 Nueva inscripción',
    'body'  => "{$child} · {$age} años" . ($program !== '' ? " · {$program}" : '') . "
Acudiente: {$parent}",
    'url'   => '/admin/#/inscripciones',
    'tag'   => 'inscripcion',
]);
exit;
