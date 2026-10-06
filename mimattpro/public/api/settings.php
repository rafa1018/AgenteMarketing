<?php
// Admin only — site settings.
// GET  /api/settings.php                                → { settings }
// POST /api/settings.php {action:"theme", theme}          → 'blue' | 'gold' (whole site, every visitor)
// POST /api/settings.php {action:"password", current, next}
require __DIR__ . '/_bootstrap.php';
mm_check_origin($CONFIG);

$file = mm_data_dir() . '/settings.json';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    mm_require_admin_read();
    mm_json(200, ['ok' => true, 'settings' => mm_settings(), 'defaultPassword' => mm_default_password()]);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') mm_json(405, ['ok' => false, 'error' => 'method']);
mm_require_admin();
$in = mm_body();
$action = $in['action'] ?? '';

if ($action === 'theme') {
    $theme = (string) ($in['theme'] ?? '');
    if (!in_array($theme, MM_THEMES, true)) mm_json(422, ['ok' => false, 'error' => 'validation']);
    // the file is locked inside: work only on $data (re-reading it fails on Windows)
    $settings = mm_with_json($file, function (array $data) use ($theme) {
        $data = mm_settings_from($data);
        $data['theme'] = $theme;
        return [$data, $data];
    });
    mm_json(200, ['ok' => true, 'settings' => $settings]);
}

if ($action === 'password') {
    $current = is_string($in['current'] ?? null) ? $in['current'] : '';
    $next = is_string($in['next'] ?? null) ? $in['next'] : '';
    if (!password_verify($current, mm_password_hash())) mm_json(422, ['ok' => false, 'error' => 'current']);
    if (mb_strlen($next) < 10 || mb_strlen($next) > 200) mm_json(422, ['ok' => false, 'error' => 'length']);
    if (strtolower($next) === 'admin' || $next === $current) mm_json(422, ['ok' => false, 'error' => 'weak']);
    $hash = password_hash($next, PASSWORD_DEFAULT);
    mm_with_json(mm_data_dir() . '/auth.json', fn(array $data) => [array_merge($data, ['password_hash' => $hash, 'changedAt' => date('c')]), null]);
    @chmod(mm_data_dir() . '/auth.json', 0600);
    mm_json(200, ['ok' => true, 'defaultPassword' => false]);
}

mm_json(400, ['ok' => false, 'error' => 'validation']);
