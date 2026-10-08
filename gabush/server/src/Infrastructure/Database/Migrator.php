<?php
declare(strict_types=1);

namespace Gabush\Infrastructure\Database;

/**
 * Applies server/migrations/NNN_name.sql in order, once each (tracked in schema_migrations).
 * Migrations are additive: never edit one that already ran in production — add a new file.
 */
final class Migrator
{
    public function __construct(private readonly Database $db, private readonly string $dir)
    {
    }

    /** @return list<string> names applied in this run */
    public function migrate(): array
    {
        $this->db->run('CREATE TABLE IF NOT EXISTS schema_migrations (
            name VARCHAR(120) NOT NULL PRIMARY KEY,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci');
        $done = array_column($this->db->all('SELECT name FROM schema_migrations'), 'name');
        $files = glob($this->dir . '/*.sql') ?: [];
        sort($files);
        $applied = [];
        foreach ($files as $file) {
            $name = basename($file);
            if (in_array($name, $done, true)) {
                continue;
            }
            // MySQL DDL is not transactional: statements run one by one; a failure stops here and the
            // migration is not marked, so it can be fixed and re-run on a clean database.
            foreach ($this->statements((string) file_get_contents($file)) as $sql) {
                $this->db->pdo()->exec($sql);
            }
            $this->db->run('INSERT INTO schema_migrations (name) VALUES (?)', [$name]);
            $applied[] = $name;
        }
        return $applied;
    }

    /** Splits a SQL file into statements (handles quotes and -- comments; no stored procedures). */
    private function statements(string $sql): array
    {
        $out = [];
        $buf = '';
        $quote = null;
        $len = strlen($sql);
        for ($i = 0; $i < $len; $i++) {
            $ch = $sql[$i];
            if ($quote === null && $ch === '-' && ($sql[$i + 1] ?? '') === '-') {
                $nl = strpos($sql, "\n", $i);
                $i = $nl === false ? $len : $nl;
                $buf .= "\n";
                continue;
            }
            if ($quote !== null) {
                if ($ch === '\\') { $buf .= $ch . ($sql[++$i] ?? ''); continue; }
                if ($ch === $quote) $quote = null;
            } elseif ($ch === "'" || $ch === '"' || $ch === '`') {
                $quote = $ch;
            } elseif ($ch === ';') {
                if (trim($buf) !== '') $out[] = trim($buf);
                $buf = '';
                continue;
            }
            $buf .= $ch;
        }
        if (trim($buf) !== '') $out[] = trim($buf);
        return $out;
    }
}
