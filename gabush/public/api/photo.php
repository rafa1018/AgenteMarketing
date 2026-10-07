<?php
// GET /api/photo.php?id=<studentId>&v=<version> — student photo, only for the logged-in admin (children's photos are never public).
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);
rp_require_admin_read();

$id = preg_replace('/[^a-f0-9]/', '', (string) ($_GET['id'] ?? ''));
$files = $id === '' ? [] : (glob(rp_data_dir() . "/photos/$id.*") ?: []);
if (!$files) {
    rp_json(404, ['ok' => false, 'error' => 'not_found']);
}

$path = $files[0];
$types = ['jpg' => 'image/jpeg', 'png' => 'image/png', 'webp' => 'image/webp'];
$ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
header('Content-Type: ' . ($types[$ext] ?? 'application/octet-stream'));
header('Content-Length: ' . filesize($path));
// private cache: the URL carries a version number, so a new photo gets a new URL
header('Cache-Control: private, max-age=2592000');
readfile($path);
