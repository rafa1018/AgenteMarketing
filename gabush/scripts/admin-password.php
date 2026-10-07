<?php
// Sets the calendar admin user + password in public/api/config.php (only a bcrypt hash is stored).
//   npm run admin-password -- <usuario> <contraseña>
//   php scripts/admin-password.php <usuario> <contraseña>
// Without a password argument it asks for one.
if (PHP_SAPI !== 'cli') {
    exit(1);
}

$user = $argv[1] ?? '';
$pass = $argv[2] ?? '';
if ($user === '') {
    fwrite(STDERR, "Uso: npm run admin-password -- <usuario> <contraseña>\n");
    exit(1);
}
if ($pass === '') {
    fwrite(STDOUT, 'Contraseña para "' . $user . '": ');
    $pass = trim((string) fgets(STDIN));
}
if (mb_strlen($pass) < 10) {
    fwrite(STDERR, "La contraseña debe tener al menos 10 caracteres.\n");
    exit(1);
}
if (!preg_match('/^[\p{L}\p{N}._@-]{3,60}$/u', $user)) {
    fwrite(STDERR, "Usuario inválido (3-60 letras, números o . _ @ -).\n");
    exit(1);
}

$file = dirname(__DIR__) . '/public/api/config.php';
if (!is_file($file)) {
    fwrite(STDERR, "No existe public/api/config.php (cópialo de config.example.php).\n");
    exit(1);
}
$src = file_get_contents($file);
$hash = password_hash($pass, PASSWORD_DEFAULT);
$lines = "    'admin_user'          => " . var_export($user, true) . ",\n"
       . "    'admin_password_hash' => " . var_export($hash, true) . ",\n";

// Replace existing keys, or insert them before the closing "];"
$src = preg_replace("/^\s*'admin_user'\s*=>.*\R/m", '', $src);
$src = preg_replace("/^\s*'admin_password_hash'\s*=>.*\R/m", '', $src);
$src = preg_replace("/\R?^\s*\/\/ Calendar admin.*\R/m", "\n", $src);
$pos = strrpos($src, '];');
if ($pos === false) {
    fwrite(STDERR, "No se pudo leer config.php.\n");
    exit(1);
}
$src = rtrim(substr($src, 0, $pos)) . "\n\n    // Calendar admin (set with `npm run admin-password`)\n" . $lines . substr($src, $pos);
file_put_contents($file, $src);

fwrite(STDOUT, "Listo: administrador \"$user\" guardado en public/api/config.php\n");
