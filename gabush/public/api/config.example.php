<?php
// Copy to config.php and fill in your values. config.php is ignored by git.
defined('RP_API') || exit;

return [
    'telegram_bot_token' => 'PASTE_BOT_TOKEN_FROM_BOTFATHER',
    'telegram_chat_id'   => 'PASTE_YOUR_CHAT_ID',

    'allowed_origins' => [
        'https://gabushkids.com',
        'https://www.gabushkids.com',
        'http://localhost:5173',
        'http://localhost:4173',
        'http://localhost:5190',
        'http://localhost:4190',
    ],

    'rate_limit'        => ['max' => 4, 'window' => 3600],
    'global_rate_limit' => ['max' => 40, 'window' => 3600],

    'salt' => 'change-me-to-a-random-string',

    // Calendar admin — set both with: npm run admin-password -- <usuario> <contraseña>
    'admin_name'          => 'Nombre visible del administrador',
    'admin_user'          => '',
    'admin_password_hash' => '',

    // Fase 2 — MySQL / MariaDB (local: 127.0.0.1:3307 gabush/gabush; production: the Hostinger database)
    'db' => ['host' => '127.0.0.1', 'port' => 3306, 'name' => 'gabush', 'user' => 'gabush', 'password' => ''],
];
