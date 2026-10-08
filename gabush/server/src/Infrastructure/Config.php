<?php
declare(strict_types=1);

namespace Gabush\Infrastructure;

/** Read-only access to config.php (shared with the v1 API). */
final class Config
{
    /** @param array<string,mixed> $values */
    private function __construct(private readonly array $values)
    {
    }

    public static function load(string $path): self
    {
        defined('RP_API') || define('RP_API', true); // config.php guards against direct access with this
        $values = require $path;
        if (!is_array($values)) {
            throw new \RuntimeException('config.php must return an array');
        }
        return new self($values);
    }

    public function get(string $key, mixed $default = null): mixed
    {
        $node = $this->values;
        foreach (explode('.', $key) as $part) {
            if (!is_array($node) || !array_key_exists($part, $node)) {
                return $default;
            }
            $node = $node[$part];
        }
        return $node;
    }

    /** Folder for private files (student photos, documents, receipts): the same data dir as the v1 API. */
    public function dataDir(): string
    {
        $dir = getenv('GB_DATA_DIR') ?: (string) $this->get('data_dir', '');
        if ($dir === '') {
            $root = dirname(GB_SERVER);
            $dir = is_dir($root . '/public_html') ? $root . '/gabush-data' : $root . '/.api-data';
        }
        if (!is_dir($dir)) {
            @mkdir($dir, 0750, true);
        }
        return $dir;
    }
}
