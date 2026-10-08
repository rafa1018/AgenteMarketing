<?php
declare(strict_types=1);

namespace Gabush\Application\Backup;

use Gabush\App;
use Gabush\Domain\Shared\DomainError;
use Gabush\Infrastructure\Database\Database;
use ZipArchive;

/**
 * Backups of the school: the whole database + the private files (student photos, enrollment documents,
 * signature) + the website content files, in one zip inside the private data folder.
 *
 *  - diaria: every day (kept 7) · semanal: on Sundays (kept 8 weeks) · manual: from the panel (kept 10)
 *  - antes-de-restaurar: taken automatically right before a restore (kept 5), so a restore can be undone.
 *
 * The dump is plain SQL written by PHP (one statement per line), so it needs no mysqldump and the database
 * credentials never leave the server.
 */
final class BackupService
{
    public const KINDS = ['diaria' => 7, 'semanal' => 8, 'manual' => 10, 'antes-de-restaurar' => 5];
    /** private folders of the school restored together with the database */
    private const FILE_DIRS = ['students', 'documents', 'signature'];
    /** website content (v1 panel) kept in the backup for manual recovery; not touched by a restore */
    private const SITE_FILES = ['content.json', 'events.json', 'feed.json', 'inscriptions.json', 'settings.json', 'users.json', 'push.json', 'vapid.json'];

    public function __construct(private readonly Database $db, private readonly string $dataDir)
    {
    }

    public static function from(App $app): self
    {
        return $app->service(self::class, static fn(App $a) => new self($a->db(), $a->dataDir()));
    }

    private function dir(): string
    {
        $d = $this->dataDir . '/backups/plataforma';
        if (!is_dir($d)) mkdir($d, 0750, true);
        return $d;
    }

    /** @return list<array{name:string,kind:string,size:int,createdAt:string}> newest first */
    public function list(): array
    {
        $out = [];
        foreach (glob($this->dir() . '/gabush-*.zip') ?: [] as $f) {
            if (!preg_match('/^gabush-(\d{8})-(\d{6})-([a-z-]+)\.zip$/', basename($f), $m)) continue;
            $at = \DateTimeImmutable::createFromFormat('Ymd His', "$m[1] $m[2]");
            $out[] = ['name' => basename($f), 'kind' => $m[3], 'size' => (int) filesize($f), 'createdAt' => $at ? $at->format('Y-m-d H:i:s') : ''];
        }
        usort($out, static fn($a, $b) => strcmp($b['name'], $a['name']));
        return $out;
    }

    public function path(string $name): string
    {
        if (!preg_match('/^gabush-\d{8}-\d{6}-[a-z-]+\.zip$/', $name) || !is_file($this->dir() . "/$name")) throw new DomainError('not_found', 'Esa copia no existe.');
        return $this->dir() . "/$name";
    }

    /** Creates a backup now. @return array{name:string,kind:string,size:int,createdAt:string} */
    public function create(string $kind, string $note = ''): array
    {
        if (!isset(self::KINDS[$kind])) throw new DomainError('kind', 'Tipo de copia inválido.');
        @set_time_limit(300);
        $now = new \DateTimeImmutable('now', new \DateTimeZone('America/Bogota'));
        $name = 'gabush-' . $now->format('Ymd-His') . "-$kind.zip";
        $tmpSql = tempnam(sys_get_temp_dir(), 'gbsql');
        $this->dumpTo($tmpSql);
        $zipPath = $this->dir() . "/$name.part";
        $zip = new ZipArchive();
        if ($zip->open($zipPath, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) throw new DomainError('zip', 'No se pudo crear el archivo de la copia.');
        $zip->addFile($tmpSql, 'database.sql');
        $files = 0;
        foreach (self::FILE_DIRS as $d) $files += $this->addDir($zip, $this->dataDir . "/$d", "files/$d");
        foreach (self::SITE_FILES as $f) if (is_file($this->dataDir . "/$f")) $zip->addFile($this->dataDir . "/$f", "site/$f");
        $zip->addFromString('info.json', json_encode([
            'createdAt' => $now->format('c'), 'kind' => $kind, 'note' => $note, 'files' => $files,
            'counts' => ['students' => (int) $this->db->value('SELECT COUNT(*) FROM students'), 'charges' => (int) $this->db->value('SELECT COUNT(*) FROM charges'), 'payments' => (int) $this->db->value('SELECT COUNT(*) FROM payments')],
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        $zip->close();
        @unlink($tmpSql);
        rename($zipPath, $this->dir() . "/$name");
        @chmod($this->dir() . "/$name", 0640);
        $this->prune();
        foreach ($this->list() as $b) if ($b['name'] === $name) return $b;
        throw new DomainError('backup', 'La copia no quedó guardada.');
    }

    /** Daily backup from the cron (once a day; on Sundays it is the weekly one). @return string|null name */
    public function scheduled(\DateTimeImmutable $now): ?string
    {
        $today = $now->format('Ymd');
        foreach ($this->list() as $b) if (in_array($b['kind'], ['diaria', 'semanal'], true) && str_starts_with($b['name'], "gabush-$today-")) return null;
        return $this->create($now->format('w') === '0' ? 'semanal' : 'diaria')['name'];
    }

    /**
     * Puts the database and the private files back as they were in $name. A backup of the current state is
     * taken first ("antes-de-restaurar"), so the restore itself can be undone.
     * @return array{undo:string,statements:int,files:int}
     */
    public function restore(string $name, bool $withFiles = true): array
    {
        $src = $this->path($name);
        @set_time_limit(600);
        $undo = $this->create('antes-de-restaurar', "Antes de restaurar $name")['name'];
        $zip = new ZipArchive();
        if ($zip->open($src) !== true) throw new DomainError('zip', 'No se pudo abrir la copia.');
        $sql = $zip->getStream('database.sql') ?: throw new DomainError('zip', 'La copia no tiene base de datos.');
        $pdo = $this->db->pdo();
        $n = 0;
        try {
            while (($line = fgets($sql)) !== false) {
                $line = rtrim($line, "\r\n");
                if ($line === '' || str_starts_with($line, '--')) continue;
                $pdo->exec($line);
                $n++;
            }
        } catch (\Throwable $e) {
            throw new DomainError('restore', 'La restauración falló a mitad de camino (' . $e->getMessage() . '). Restaura la copia «' . $undo . '» para volver al estado anterior.');
        } finally {
            fclose($sql);
            $pdo->exec('SET FOREIGN_KEY_CHECKS=1');
        }
        $files = 0;
        if ($withFiles) {
            foreach (self::FILE_DIRS as $d) {
                $target = $this->dataDir . "/$d";
                $old = $target . '.old-' . bin2hex(random_bytes(3));
                if (is_dir($target)) rename($target, $old);
                mkdir($target, 0750, true);
                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $entry = (string) $zip->getNameIndex($i);
                    if (!str_starts_with($entry, "files/$d/") || str_ends_with($entry, '/')) continue;
                    $rel = substr($entry, strlen("files/$d/"));
                    if ($rel === '' || str_contains($rel, '..')) continue;
                    $dest = "$target/$rel";
                    if (!is_dir(dirname($dest))) mkdir(dirname($dest), 0750, true);
                    copy("zip://$src#$entry", $dest);
                    $files++;
                }
                if (is_dir($old)) self::rmTree($old);
            }
        }
        $zip->close();
        return ['undo' => $undo, 'statements' => $n, 'files' => $files];
    }

    public function delete(string $name): void
    {
        @unlink($this->path($name));
    }

    // ───────────────────────── internals ─────────────────────────
    /** Plain SQL, one statement per line: DROP + CREATE of every table, then its rows in batches. */
    private function dumpTo(string $file): void
    {
        $pdo = $this->db->pdo();
        $out = fopen($file, 'wb');
        fwrite($out, "-- Gabush · copia de la base de datos · " . date('c') . "\nSET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS=0;\n");
        $tables = $pdo->query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'")->fetchAll(\PDO::FETCH_COLUMN);
        foreach ($tables as $t) {
            $create = $pdo->query("SHOW CREATE TABLE `$t`")->fetch(\PDO::FETCH_NUM)[1];
            fwrite($out, "DROP TABLE IF EXISTS `$t`;\n" . preg_replace('/\s*\R\s*/', ' ', $create) . ";\n");
            $cols = null;
            $batch = [];
            $stmt = $pdo->query("SELECT * FROM `$t`");
            while ($row = $stmt->fetch(\PDO::FETCH_ASSOC)) {
                $cols ??= '(`' . implode('`,`', array_keys($row)) . '`)';
                $batch[] = '(' . implode(',', array_map(static fn($v) => $v === null ? 'NULL' : (is_int($v) || is_float($v) ? (string) $v : $pdo->quote((string) $v)), $row)) . ')';
                if (count($batch) >= 200) {
                    fwrite($out, "INSERT INTO `$t` $cols VALUES " . implode(',', $batch) . ";\n");
                    $batch = [];
                }
            }
            if ($batch) fwrite($out, "INSERT INTO `$t` $cols VALUES " . implode(',', $batch) . ";\n");
        }
        fwrite($out, "SET FOREIGN_KEY_CHECKS=1;\n");
        fclose($out);
    }

    private function addDir(ZipArchive $zip, string $dir, string $as): int
    {
        if (!is_dir($dir)) return 0;
        $n = 0;
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS));
        foreach ($it as $f) {
            if (!$f->isFile()) continue;
            $zip->addFile($f->getPathname(), $as . '/' . str_replace('\\', '/', substr($f->getPathname(), strlen($dir) + 1)));
            $n++;
        }
        return $n;
    }

    /** Keeps the newest N of each kind. */
    private function prune(): void
    {
        $byKind = [];
        foreach ($this->list() as $b) $byKind[$b['kind']][] = $b['name'];
        foreach ($byKind as $kind => $names) {
            foreach (array_slice($names, self::KINDS[$kind] ?? 10) as $old) @unlink($this->dir() . "/$old");
        }
    }

    private static function rmTree(string $dir): void
    {
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($it as $f) $f->isDir() ? @rmdir($f->getPathname()) : @unlink($f->getPathname());
        @rmdir($dir);
    }
}
