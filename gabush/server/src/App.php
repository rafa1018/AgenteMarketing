<?php
declare(strict_types=1);

namespace Gabush;

use Gabush\Infrastructure\Config;
use Gabush\Infrastructure\Database\Database;

/**
 * Composition root: creates infrastructure once and hands it to the application services.
 * Services are created lazily and memoised (one per request / cron run).
 */
final class App
{
    private ?Database $db = null;
    /** @var array<string,object> */
    private array $services = [];

    public function __construct(public readonly Config $config)
    {
    }

    public static function boot(): self
    {
        return new self(Config::load(\gb_config_path()));
    }

    public function db(): Database
    {
        return $this->db ??= Database::connect((array) $this->config->get('db'));
    }

    /**
     * @template T of object
     * @param class-string<T> $class
     * @param callable(self):T $factory
     * @return T
     */
    public function service(string $class, callable $factory): object
    {
        return $this->services[$class] ??= $factory($this);
    }

    /** Today / now in Colombia (overridable in tests through GB_TODAY). */
    public function today(): \DateTimeImmutable
    {
        return new \DateTimeImmutable(getenv('GB_TODAY') ?: 'now', new \DateTimeZone('America/Bogota'));
    }

    public function dataDir(): string
    {
        return $this->config->dataDir();
    }

    /** Public base URL of the site (for links in emails and gateway redirects). */
    public function baseUrl(): string
    {
        $cfg = (string) $this->config->get('base_url', '');
        if ($cfg !== '') return rtrim($cfg, '/');
        // the cron (command line) has no request: links in its e-mails point to the live site
        if (empty($_SERVER['HTTP_HOST'])) return 'https://gabushkids.com';
        $https = \function_exists('rp_is_https') && \rp_is_https();
        return ($https ? 'https://' : 'http://') . $_SERVER['HTTP_HOST'];
    }
}
