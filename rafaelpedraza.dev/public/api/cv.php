<?php
// GET /api/cv.php — downloads the CV and counts the download (bots and the logged-in admin are not counted).
// Returns 404 while the CV is hidden from the admin panel (Ajustes → Hoja de vida).
require __DIR__ . '/_bootstrap.php';
require __DIR__ . '/_push.php';

const CV_FILE = __DIR__ . '/../cv/Rafael-Pedraza-CV.pdf';
const CV_NAME = 'Rafael-Pedraza-CV.pdf';

if (!rp_settings()['cvEnabled'] || !is_file(CV_FILE)) {
    header('Content-Type: text/plain; charset=utf-8');
    http_response_code(404);
    echo 'No disponible';
    exit;
}

$count = null;
if (!rp_is_bot() && !rp_is_admin()) {
    $now = time();
    $ip = rp_client_ip();
    $ua = substr((string) ($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 300);
    $count = rp_with_json(rp_data_dir() . '/downloads.json', function (array $data) use ($now, $ip, $ua) {
        $data['count'] = (int) ($data['count'] ?? 0) + 1;
        $data['log'] = (array) ($data['log'] ?? []);
        $data['log'][] = ['id' => rp_uid(), 't' => $now, 'ip' => $ip, 'device' => rp_device($ua)['label'], 'kind' => rp_device($ua)['kind'], 'ref' => substr((string) ($_SERVER['HTTP_REFERER'] ?? ''), 0, 300)];
        if (count($data['log']) > 3000) $data['log'] = array_slice($data['log'], -3000);
        return [$data, $data['count']];
    });
}

ignore_user_abort(true);
header('Content-Type: application/pdf');
header('Content-Disposition: attachment; filename="' . CV_NAME . '"');
header('Content-Length: ' . filesize(CV_FILE));
header('Cache-Control: no-store');
readfile(CV_FILE);
rp_finish_response();

if ($count !== null) {
    // location of the download (after the file was sent)
    $geo = rp_geo($ip);
    rp_with_json(rp_data_dir() . '/downloads.json', function (array $data) use ($geo) {
        $last = count($data['log'] ?? []) - 1;
        if ($last >= 0) $data['log'][$last] += ['country' => $geo['country'], 'cc' => $geo['cc'], 'region' => $geo['region'], 'city' => $geo['city'], 'isp' => $geo['isp']];
        return [$data, null];
    });
    $where = implode(', ', array_filter([$geo['city'], $geo['country']])) ?: 'ubicación desconocida';
    push_notify('descargas', ['title' => '📄 Descargaron tu hoja de vida', 'body' => "Descarga #$count desde $where", 'url' => '/admin/#/visitas', 'tag' => 'cv']);
}
