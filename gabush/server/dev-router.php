<?php
// Router for the PHP built-in dev server (npm run api): /api/v2/* → the v2 front controller,
// everything else is served as a normal file (the v1 endpoints keep working unchanged).
$path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
if (str_starts_with($path, '/api/v2/') || $path === '/api/v2') {
    require dirname(__DIR__) . '/public/api/v2/index.php';
    return true;
}
return false;
