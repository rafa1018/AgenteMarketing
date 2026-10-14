<?php
// Staff users and what each one may do. Needs the "usuarios" permission.
// GET  /api/users.php                                   → { users, perms, me }
// POST /api/users.php {action:"save", user:{id?, name, user, role, perms[], active, password?}} → { user }
// POST /api/users.php {action:"delete", id}             → { ok }
// Passwords are stored only as bcrypt hashes; they are never sent back.
require __DIR__ . '/_bootstrap.php';
rp_check_origin($CONFIG);

const MAX_USERS = 40;
const ROLES = ['rectora', 'docente', 'auxiliar', 'personalizado'];

$file = rp_data_dir() . '/users.json';
$method = $_SERVER['REQUEST_METHOD'];

function user_public(array $u): array
{
    return [
        'id' => $u['id'], 'name' => $u['name'], 'user' => $u['user'], 'role' => $u['role'],
        'perms' => array_values(array_intersect(RP_PERMS, (array) ($u['perms'] ?? []))),
        'active' => !empty($u['active']), 'lastLogin' => $u['lastLogin'] ?? null, 'createdAt' => $u['createdAt'] ?? null,
        // notifications the administrator allowed (null = all that the permissions allow)
        'push' => isset($u['push']) && is_array($u['push']) ? array_values(array_intersect(RP_PUSH_TYPES, $u['push'])) : null,
    ];
}

function owner_public(): array
{
    global $CONFIG;
    return ['id' => RP_ROOT, 'name' => (string) ($CONFIG['admin_name'] ?? 'Administración'), 'user' => (string) ($CONFIG['admin_user'] ?? ''), 'role' => 'admin', 'perms' => RP_PERMS, 'active' => true, 'owner' => true];
}

if ($method === 'GET') {
    rp_require_perm_read('usuarios');
    $list = array_map('user_public', rp_read_json($file)['users'] ?? []);
    if (!empty($CONFIG['admin_user'])) array_unshift($list, owner_public());
    rp_json(200, ['ok' => true, 'users' => $list, 'perms' => RP_PERMS, 'me' => rp_current_user()['id']]);
}
if ($method !== 'POST') {
    rp_json(405, ['ok' => false, 'error' => 'method']);
}
rp_require_perm('usuarios');
$in = rp_body(8000);
$action = $in['action'] ?? '';
$me = rp_current_user();

if ($action === 'save') {
    $u = (array) ($in['user'] ?? []);
    $id = rp_clean($u['id'] ?? '', 32);
    if ($id === RP_ROOT) rp_json(422, ['ok' => false, 'error' => 'owner']);
    $name = rp_clean($u['name'] ?? '', 80);
    $login = mb_strtolower(rp_clean($u['user'] ?? '', 60));
    $role = in_array($u['role'] ?? '', ROLES, true) ? $u['role'] : 'personalizado';
    $perms = array_values(array_intersect(RP_PERMS, array_filter((array) ($u['perms'] ?? []), 'is_string')));
    $active = !empty($u['active']);
    $push = array_key_exists('push', $u) ? (is_array($u['push']) ? array_values(array_intersect(RP_PUSH_TYPES, array_filter($u['push'], 'is_string'))) : null) : false; // false = unchanged
    $password = is_string($u['password'] ?? null) ? $u['password'] : '';

    $bad = [];
    if (mb_strlen($name) < 2) $bad[] = 'name';
    if (!preg_match('/^[\p{L}\p{N}._@-]{3,60}$/u', $login) || mb_strtolower((string) ($CONFIG['admin_user'] ?? '')) === $login) $bad[] = 'user';
    if (($id === '' && mb_strlen($password) < 8) || ($password !== '' && mb_strlen($password) < 8)) $bad[] = 'password';
    // nobody can lock themselves out
    if ($id !== '' && $id === $me['id'] && (!$active || !in_array('usuarios', $perms, true))) $bad[] = 'self';
    if ($bad) rp_json(422, ['ok' => false, 'error' => 'validation', 'fields' => $bad]);

    $hash = $password !== '' ? password_hash($password, PASSWORD_DEFAULT) : null;
    $saved = rp_with_json($file, function (array $data) use ($id, $name, $login, $role, $perms, $active, $hash, $push) {
        $users = $data['users'] ?? [];
        foreach ($users as $x) {
            if (mb_strtolower($x['user']) === $login && $x['id'] !== $id) return [$data, 'taken'];
        }
        if ($id === '') {
            if (count($users) >= MAX_USERS) return [$data, 'full'];
            $rec = ['id' => rp_uid(), 'name' => $name, 'user' => $login, 'role' => $role, 'perms' => $perms, 'active' => $active, 'hash' => $hash, 'createdAt' => date('c')];
            $users[] = $rec;
        } else {
            $idx = array_search($id, array_column($users, 'id'), true);
            if ($idx === false) return [$data, 'not_found'];
            $rec = array_merge($users[$idx], ['name' => $name, 'user' => $login, 'role' => $role, 'perms' => $perms, 'active' => $active]);
            if ($hash) $rec['hash'] = $hash;
            $users[$idx] = $rec;
        }
        if ($push !== false) {
            $rec['push'] = $push;
            $users[array_search($rec['id'], array_column($users, 'id'), true)] = $rec;
        }
        $data['users'] = $users;
        return [$data, $rec];
    });
    if ($saved === 'taken') rp_json(422, ['ok' => false, 'error' => 'validation', 'fields' => ['taken']]);
    if ($saved === 'full') rp_json(422, ['ok' => false, 'error' => 'full']);
    if ($saved === 'not_found') rp_json(404, ['ok' => false, 'error' => 'not_found']);
    rp_json(200, ['ok' => true, 'user' => user_public($saved)]);
}

if ($action === 'delete') {
    $id = rp_clean($in['id'] ?? '', 32);
    if ($id === RP_ROOT || $id === $me['id']) rp_json(422, ['ok' => false, 'error' => 'self']);
    rp_with_json($file, function (array $data) use ($id) {
        $data['users'] = array_values(array_filter($data['users'] ?? [], fn($u) => $u['id'] !== $id));
        return [$data, null];
    });
    rp_json(200, ['ok' => true]);
}

rp_json(400, ['ok' => false, 'error' => 'validation']);
