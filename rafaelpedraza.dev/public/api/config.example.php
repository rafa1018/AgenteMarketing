<?php
// Copy to config.php and fill in your values. config.php is ignored by git.
defined('RP_API') || exit;

return [
    'telegram_bot_token' => 'PASTE_BOT_TOKEN_FROM_BOTFATHER',
    'telegram_chat_id'   => 'PASTE_YOUR_CHAT_ID',

    'allowed_origins' => [
        'https://rafaelpedraza.dev',
        'https://www.rafaelpedraza.dev',
        'http://localhost:5173',
        'http://localhost:4173',
    ],

    'rate_limit'        => ['max' => 4, 'window' => 3600],
    'global_rate_limit' => ['max' => 40, 'window' => 3600],

    'salt' => 'change-me-to-a-random-string',
];
