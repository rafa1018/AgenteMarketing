<?php
declare(strict_types=1);

namespace Gabush\Application\Shared;

use Gabush\Infrastructure\Database\Database;

/** Key/value settings stored as JSON (school data, late fees, SMTP, payment gateway…). */
final class Settings
{
    /** @var array<string,mixed> */
    private array $cache = [];

    public function __construct(private readonly Database $db)
    {
    }

    public function get(string $key, mixed $default = null): mixed
    {
        if (!array_key_exists($key, $this->cache)) {
            $raw = $this->db->value('SELECT value FROM settings WHERE `key` = ?', [$key]);
            $this->cache[$key] = $raw === null ? null : json_decode((string) $raw, true);
        }
        return $this->cache[$key] ?? $default;
    }

    public function set(string $key, mixed $value): void
    {
        $this->db->run('INSERT INTO settings (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)', [$key, json_encode($value, JSON_UNESCAPED_UNICODE)]);
        $this->cache[$key] = $value;
    }

    /** Merge into an object setting. */
    public function patch(string $key, array $values): array
    {
        $now = array_merge((array) $this->get($key, []), $values);
        $this->set($key, $now);
        return $now;
    }

    /** The academic year families and the panel work in by default. */
    public function activeYear(): int
    {
        $y = $this->db->value("SELECT id FROM academic_years WHERE status = 'active' ORDER BY id DESC LIMIT 1")
            ?? $this->db->value('SELECT MAX(id) FROM academic_years');
        return (int) ($y ?? date('Y'));
    }
}
