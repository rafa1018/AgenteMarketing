<?php
// Admin only — newsletter subscribers (footer form).
// GET  /api/subscribers.php                → { subscribers: [...newest first] }
// GET  /api/subscribers.php?format=csv     → downloads subscribers.csv (opens in Excel)
// POST /api/subscribers.php {action:"delete", id}
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

$file = rp_data_dir() . '/subscribers.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    rp_require_admin_read();
    $all = array_reverse(rp_read_json($file));
    if (($_GET['format'] ?? '') === 'csv') {
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="suscriptores-' . date('Y-m-d') . '.csv"');
        $out = fopen('php://output', 'w');
        fwrite($out, "\xEF\xBB\xBF"); // BOM so Excel reads the accents correctly
        fputcsv($out, ['correo', 'fecha', 'idioma', 'ubicación', 'dispositivo'], ';');
        foreach ($all as $s) {
            // a leading = + - @ would be run as a formula by Excel
            $email = preg_match('/^[=+\-@]/', $s['email'] ?? '') ? "'" . $s['email'] : ($s['email'] ?? '');
            fputcsv($out, [$email, date('Y-m-d H:i', (int) ($s['t'] ?? 0)), $s['lang'] ?? '', $s['place'] ?? '', $s['device'] ?? ''], ';');
        }
        fclose($out);
        exit;
    }
    rp_json(200, ['ok' => true, 'subscribers' => $all]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}
rp_require_admin();
$in = rp_body(2000);

if (($in['action'] ?? '') === 'delete') {
    $id = (string) ($in['id'] ?? '');
    rp_with_json($file, fn(array $data) => [array_values(array_filter($data, fn($s) => ($s['id'] ?? '') !== $id)), null]);
    rp_json(200, ['ok' => true]);
}
rp_json(400, ['ok' => false, 'error' => 'validation']);
