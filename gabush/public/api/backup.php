<?php
// GET /api/backup.php — admin only: downloads a .zip with all the club data (JSON) and the student photos.
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);
rp_require_perm_read('ajustes');

$dir = rp_data_dir();
$name = 'gabush-kids-respaldo-' . date('Y-m-d') . '.zip';

if (!class_exists('ZipArchive')) {
    // fallback: one JSON file with everything (no photos)
    $all = [];
    foreach (RP_BACKUP_FILES as $f) $all[$f] = rp_read_json("$dir/$f.json");
    header('Content-Type: application/json; charset=utf-8');
    header('Content-Disposition: attachment; filename="' . str_replace('.zip', '.json', $name) . '"');
    echo json_encode($all, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

$tmp = tempnam(sys_get_temp_dir(), 'gbbk');
$zip = new ZipArchive();
$zip->open($tmp, ZipArchive::OVERWRITE);
foreach (RP_BACKUP_FILES as $f) {
    if (is_file("$dir/$f.json")) $zip->addFile("$dir/$f.json", "$f.json");
}
foreach (glob("$dir/photos/*") ?: [] as $p) $zip->addFile($p, 'photos/' . basename($p));
foreach (glob("$dir/feed/*") ?: [] as $p) $zip->addFile($p, 'feed/' . basename($p));
$zip->addFromString('LEEME.txt', "Copia de seguridad de Gabush Kids — " . date('Y-m-d H:i') . "\r\nPara restaurar: sube estos archivos a la carpeta gabush-data del hosting (al lado de public_html).\r\n");
$zip->close();

header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="' . $name . '"');
header('Content-Length: ' . filesize($tmp));
readfile($tmp);
@unlink($tmp);
