<?php
// GET /api/media.php?f=<file> — streams music uploaded from the admin panel (kept in the data folder, outside
// public_html, so publishing never deletes it). Supports Range requests so browsers can seek/stream.
require __DIR__ . '/_bootstrap.php';

$name = basename((string) ($_GET['f'] ?? ''));
$path = rp_data_dir() . '/media/' . $name;
if (!preg_match('/^[a-z0-9-]+\.mp3$/', $name) || !is_file($path)) {
    rp_json(404, ['ok' => false, 'error' => 'not_found']);
}

$size = filesize($path);
$start = 0;
$end = $size - 1;
header('Content-Type: audio/mpeg');
header('Accept-Ranges: bytes');
header('Cache-Control: public, max-age=31536000, immutable'); // every upload gets a new file name
if (preg_match('/^bytes=(\d*)-(\d*)$/', (string) ($_SERVER['HTTP_RANGE'] ?? ''), $m)) {
    if ($m[1] === '' && $m[2] !== '') {
        $start = max(0, $size - (int) $m[2]);
    } else {
        $start = (int) $m[1];
        if ($m[2] !== '') $end = min($end, (int) $m[2]);
    }
    if ($start > $end || $start >= $size) {
        header("Content-Range: bytes */$size");
        http_response_code(416);
        exit;
    }
    http_response_code(206);
    header("Content-Range: bytes $start-$end/$size");
}
header('Content-Length: ' . ($end - $start + 1));
if ($_SERVER['REQUEST_METHOD'] === 'HEAD') exit;

$fp = fopen($path, 'rb');
fseek($fp, $start);
$left = $end - $start + 1;
while ($left > 0 && !feof($fp)) {
    $chunk = fread($fp, min(65536, $left));
    echo $chunk;
    $left -= strlen($chunk);
    flush();
}
fclose($fp);
