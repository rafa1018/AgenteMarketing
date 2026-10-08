<?php
declare(strict_types=1);

namespace Gabush\Infrastructure\Database;

use PDO;
use PDOStatement;

/** Thin PDO wrapper: prepared statements only, nested transactions via savepoints. */
final class Database
{
    private int $depth = 0;

    public function __construct(private readonly PDO $pdo)
    {
    }

    /** @param array{host:string,port?:int,name:string,user:string,password:string} $c */
    public static function connect(array $c): self
    {
        $dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $c['host'], (int) ($c['port'] ?? 3306), $c['name']);
        $pdo = new PDO($dsn, $c['user'], $c['password'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_STRINGIFY_FETCHES => false,
        ]);
        // same collation as the tables in every server (MariaDB 11 defaults to another one and then text
        // comparisons between parameters and columns fail with "Illegal mix of collations")
        $pdo->exec("SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci, time_zone = '-05:00'");
        return new self($pdo);
    }

    /** @param array<string|int,mixed> $params */
    public function run(string $sql, array $params = []): PDOStatement
    {
        $st = $this->pdo->prepare($sql);
        $st->execute($params);
        return $st;
    }

    /** @return list<array<string,mixed>> */
    public function all(string $sql, array $params = []): array
    {
        return $this->run($sql, $params)->fetchAll();
    }

    /** @return array<string,mixed>|null */
    public function one(string $sql, array $params = []): ?array
    {
        $row = $this->run($sql, $params)->fetch();
        return $row === false ? null : $row;
    }

    public function value(string $sql, array $params = []): mixed
    {
        $v = $this->run($sql, $params)->fetchColumn();
        return $v === false ? null : $v;
    }

    /** @param array<string,mixed> $row */
    public function insert(string $table, array $row): int
    {
        $cols = array_keys($row);
        $sql = sprintf(
            'INSERT INTO `%s` (%s) VALUES (%s)',
            $table,
            implode(', ', array_map(static fn($c) => "`$c`", $cols)),
            implode(', ', array_map(static fn($c) => ":$c", $cols)),
        );
        $this->run($sql, self::encode($row));
        return (int) $this->pdo->lastInsertId();
    }

    /**
     * @param array<string,mixed> $row
     * @param array<string,mixed> $where
     */
    public function update(string $table, array $row, array $where): int
    {
        $set = implode(', ', array_map(static fn($c) => "`$c` = :s_$c", array_keys($row)));
        $cond = implode(' AND ', array_map(static fn($c) => "`$c` = :w_$c", array_keys($where)));
        $params = [];
        foreach (self::encode($row) as $k => $v) $params["s_$k"] = $v;
        foreach ($where as $k => $v) $params["w_$k"] = $v;
        return $this->run("UPDATE `$table` SET $set WHERE $cond", $params)->rowCount();
    }

    /**
     * Runs $fn inside a transaction (savepoint when already inside one) and returns its result.
     * @template T
     * @param callable(self):T $fn
     * @return T
     */
    public function transaction(callable $fn): mixed
    {
        $this->depth === 0 ? $this->pdo->beginTransaction() : $this->pdo->exec('SAVEPOINT sp' . $this->depth);
        $this->depth++;
        try {
            $result = $fn($this);
            $this->depth--;
            $this->depth === 0 ? $this->pdo->commit() : $this->pdo->exec('RELEASE SAVEPOINT sp' . $this->depth);
            return $result;
        } catch (\Throwable $e) {
            $this->depth--;
            $this->depth === 0 ? $this->pdo->rollBack() : $this->pdo->exec('ROLLBACK TO SAVEPOINT sp' . $this->depth);
            throw $e;
        }
    }

    public function pdo(): PDO
    {
        return $this->pdo;
    }

    /** Arrays become JSON, booleans 0/1. */
    private static function encode(array $row): array
    {
        foreach ($row as $k => $v) {
            if (is_array($v)) $row[$k] = json_encode($v, JSON_UNESCAPED_UNICODE);
            elseif (is_bool($v)) $row[$k] = $v ? 1 : 0;
        }
        return $row;
    }
}
