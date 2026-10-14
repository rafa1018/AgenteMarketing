<?php
declare(strict_types=1);

namespace Gabush\Application\Shared;

use Gabush\Infrastructure\Database\Database;

/** Who did what (payments, waivers, deletions, enrollment changes…). */
final class Audit
{
    public function __construct(private readonly Database $db)
    {
    }

    /** @param array<string,mixed> $data */
    public function log(Actor $actor, string $action, string $entity, int|string|null $entityId = null, array $data = []): void
    {
        $this->db->insert('audit_log', [
            'actor_type' => $actor->type,
            'actor_id' => $actor->id,
            'actor_name' => mb_substr($actor->name, 0, 120),
            'action' => $action,
            'entity' => $entity,
            'entity_id' => $entityId === null ? null : (string) $entityId,
            'data' => $data ?: null,
            'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
        ]);
    }
}
