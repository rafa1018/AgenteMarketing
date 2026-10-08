<?php
declare(strict_types=1);

namespace Gabush\Application\Shared;

/** Who performs an action: staff (panel), family (portal of one student), system (cron) or gateway (webhook). */
final class Actor
{
    /** @param list<string> $perms */
    private function __construct(
        public readonly string $type,
        public readonly string $id,
        public readonly string $name,
        public readonly array $perms = [],
        public readonly ?int $studentId = null,
    ) {
    }

    /** @param list<string> $perms */
    public static function staff(string $id, string $name, array $perms): self { return new self('staff', $id, $name, $perms); }
    public static function family(int $studentId, string $username): self { return new self('family', (string) $studentId, $username, [], $studentId); }
    public static function system(string $what = 'cron'): self { return new self('system', $what, 'Sistema'); }
    public static function gateway(string $provider): self { return new self('gateway', $provider, ucfirst($provider)); }

    public function can(string $perm): bool
    {
        return $this->type === 'system' || in_array($perm, $this->perms, true);
    }

    public function label(): string
    {
        return $this->name;
    }
}
