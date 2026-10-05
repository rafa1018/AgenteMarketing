<?php
// POST /api/subscribe.php {email, lang, website (honeypot), elapsed} → { ok, already }
// Footer newsletter form. Saves the email in <data>/subscribers.json (admin panel → Suscriptores).
// An email that is already on the list answers { ok:true, already:true } and is not stored twice.
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_push.php';
rp_check_origin($CONFIG);

const SUBSCRIBE_MAX = 6;         // attempts per visitor…
const SUBSCRIBE_WINDOW = 3600;   // …per hour
const SUBSCRIBERS_MAX = 20000;

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}
$in = rp_body(2000);

// Anti-spam: honeypot must stay empty and humans need a moment to type an email.
if (($in['website'] ?? '') !== '' || (int) ($in['elapsed'] ?? 0) < 1500) {
    rp_json(200, ['ok' => true, 'already' => false]); // bots learn nothing
}

$email = mb_strtolower(rp_clean($in['email'] ?? '', 160));
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || !preg_match('/\.[a-z]{2,}$/', $email)) {
    rp_json(422, ['ok' => false, 'error' => 'email']);
}
$lang = ($in['lang'] ?? 'es') === 'en' ? 'en' : 'es';

// rate limit per visitor (hashed IP)
$client = rp_client_hash($CONFIG);
$now = time();
$limited = rp_with_json(rp_data_dir() . '/subscribelimit.json', function (array $data) use ($client, $now) {
    foreach ($data as $k => $stamps) {
        $data[$k] = array_values(array_filter((array) $stamps, fn($t) => $t > $now - SUBSCRIBE_WINDOW));
        if (!$data[$k]) unset($data[$k]);
    }
    if (count($data[$client] ?? []) >= SUBSCRIBE_MAX) return [$data, true];
    $data[$client][] = $now;
    return [$data, false];
});
if ($limited) {
    rp_json(429, ['ok' => false, 'error' => 'rate_limited']);
}

$ip = rp_client_ip();
$ua = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300);
$entry = ['id' => rp_uid(), 't' => $now, 'email' => $email, 'lang' => $lang, 'ip' => $ip, 'device' => rp_device($ua)['label']];
$already = rp_with_json(rp_data_dir() . '/subscribers.json', function (array $data) use ($entry) {
    foreach ($data as $s) {
        if (($s['email'] ?? '') === $entry['email']) return [$data, true];
    }
    $data[] = $entry;
    if (count($data) > SUBSCRIBERS_MAX) $data = array_slice($data, -SUBSCRIBERS_MAX);
    return [$data, false];
});

rp_json_then_continue(['ok' => true, 'already' => $already]);
if ($already) exit;

// ── after the response: location + phone notification ──
$geo = rp_geo($ip);
$where = implode(', ', array_filter([$geo['city'], $geo['country']]));
if ($where !== '') {
    rp_with_json(rp_data_dir() . '/subscribers.json', function (array $data) use ($entry, $where, $geo) {
        foreach ($data as $i => $s) if (($s['id'] ?? '') === $entry['id']) $data[$i] += ['place' => $where, 'cc' => $geo['cc']];
        return [$data, null];
    });
}
push_notify('suscriptores', ['title' => '📬 Nuevo suscriptor', 'body' => $email . ($where !== '' ? " · $where" : ''), 'url' => '/admin/#/suscriptores', 'tag' => 'sub']);
