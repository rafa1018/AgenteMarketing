<?php
// GET /api/backup.php — admin only: downloads a .zip with all the site data (messages, visits, downloads, settings).
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);
rp_require_admin_read();

$dir = rp_data_dir();
$name = 'rafaelpedraza-respaldo-' . date('Y-m-d') . '.zip';

if (!class_exists('ZipArchive')) {
    // fallback: one JSON file with everything
    $all = [];
    foreach (RP_BACKUP_FILES as $f) $all[$f] = rp_read_json("$dir/$f.json");
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . str_replace('.zip', '.json', $name) . '"');
    echo json_encode($all, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

$tmp = tempnam(sys_get_temp_dir(), 'rpbk');
$zip = new ZipArchive();
$zip->open($tmp, ZipArchive::OVERWRITE);
foreach (RP_BACKUP_FILES as $f) {
    if (is_file("$dir/$f.json")) $zip->addFile("$dir/$f.json", "$f.json");
}
$zip->addFromString('LEEME.txt', "Copia de seguridad de rafaelpedraza.dev — " . date('Y-m-d H:i') . "\r\n"
    . "Incluye experiencia profesional, stack tecnológico, mensajes, visitas, descargas del CV y ajustes (la música subida no se incluye).\r\n"
    . "Para restaurar: sube estos archivos a la carpeta rp-data del hosting (al lado de public_html).\r\n");
$zip->close();

header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="' . $name . '"');
header('Content-Length: ' . filesize($tmp));
readfile($tmp);
@unlink($tmp);
