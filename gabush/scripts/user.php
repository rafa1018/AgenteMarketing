<?php
// Creates or updates a staff user from the command line (the panel's "Usuarios" page does the same).
//   npm run user -- <usuario> <rol> "<Nombre>" [contraseña]
//   rol: rectora | docente | auxiliar | personalizado
// Writes to the local data folder (.api-data) unless GB_DATA_DIR points elsewhere.
if (PHP_SAPI !== 'cli') exit(1);

[$_, $login, $role, $name, $pass] = array_pad($argv, 5, '');
$presets = [
    'rectora' => ['asistencia', 'estudiantes', 'pagos', 'inscripciones', 'calendario', 'feed', 'ajustes', 'usuarios'],
    'docente' => ['asistencia'],
    'auxiliar' => ['estudiantes', 'calendario'],
    'personalizado' => [],
];
$login = mb_strtolower(trim($login));
if (!preg_match('/^[\p{L}\p{N}._@-]{3,60}$/u', $login) || !isset($presets[$role]) || mb_strlen(trim($name)) < 2) {
    fwrite(STDERR, "Uso: npm run user -- <usuario> <rectora|docente|auxiliar|personalizado> \"<Nombre>\" [contraseña]\n");
    exit(1);
}
if ($pass === '') {
    $abc = 'abcdefghjkmnpqrstuvwxyz23456789';
    $pass = 'Gb-';
    for ($i = 0; $i < 10; $i++) $pass .= $abc[random_int(0, strlen($abc) - 1)];
}
if (mb_strlen($pass) < 8) {
    fwrite(STDERR, "La contraseña debe tener al menos 8 caracteres.\n");
    exit(1);
}

$dir = getenv('GB_DATA_DIR') ?: dirname(__DIR__) . '/.api-data';
if (!is_dir($dir)) mkdir($dir, 0750, true);
$file = "$dir/users.json";
$data = is_file($file) ? (json_decode((string) file_get_contents($file), true) ?: []) : [];
$users = $data['users'] ?? [];
$rec = ['name' => trim($name), 'user' => $login, 'role' => $role, 'perms' => $presets[$role], 'active' => true, 'hash' => password_hash($pass, PASSWORD_DEFAULT)];
$idx = array_search($login, array_map(fn($u) => mb_strtolower($u['user']), $users), true);
if ($idx === false) $users[] = ['id' => bin2hex(random_bytes(8))] + $rec + ['createdAt' => date('c')];
else $users[$idx] = array_merge($users[$idx], $rec);
$data['users'] = $users;
file_put_contents($file, json_encode($data), LOCK_EX);

echo "Listo: $login ($role) — contraseña: $pass\n";
