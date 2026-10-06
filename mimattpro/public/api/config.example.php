<?php
// Copy to config.php and fill in your values. config.php is ignored by git.
defined('MM_API') || exit;

return [
    'allowed_origins' => [
        'https://mimattpro.com',
        'https://www.mimattpro.com',
        'http://localhost:5174',
        'http://localhost:4174',
    ],

    'salt' => 'change-me-to-a-random-string',

    // Admin panel (/admin/). Initial password "admin" — the panel asks to change it on first login
    // (the new one is stored as a hash in the data folder, outside public_html).
    // Generate a hash with: php -r "echo password_hash('your-password', PASSWORD_DEFAULT);"
    'admin_user'          => 'admin',
    'admin_password_hash' => '$2y$10$REPLACE_WITH_A_BCRYPT_HASH',
];
