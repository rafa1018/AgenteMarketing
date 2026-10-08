<?php
declare(strict_types=1);

namespace Gabush\Domain\Enrollment;

use Gabush\Domain\Shared\DomainError;

/**
 * Enrollment life cycle in a year:  prematrícula → activo → retirado  (a retired student can be
 * re-activated). A course cannot take more active/pre-enrolled students than its capacity.
 */
final class EnrollmentRules
{
    public const STATES = ['prematricula', 'activo', 'retirado'];
    private const ALLOWED = [
        'prematricula' => ['activo', 'retirado'],
        'activo' => ['retirado'],
        'retirado' => ['activo', 'prematricula'],
    ];

    public static function assertTransition(string $from, string $to): void
    {
        if ($from === $to) return;
        if (!in_array($to, self::ALLOWED[$from] ?? [], true)) {
            throw new DomainError('transition', sprintf('No se puede pasar de "%s" a "%s".', self::label($from), self::label($to)));
        }
    }

    public static function assertCapacity(int $occupied, int $capacity, string $course): void
    {
        if ($occupied >= $capacity) {
            throw new DomainError('full', "El curso $course está lleno ($occupied de $capacity cupos). Aumenta la capacidad o elige otro curso.");
        }
    }

    /** Required documents still missing (pending or rejected). @param list<array{required:int|bool,status:string}> $docs */
    public static function missingDocuments(array $docs): int
    {
        return count(array_filter($docs, static fn($d) => (bool) $d['required'] && in_array($d['status'], ['pendiente', 'rechazado'], true)));
    }

    public static function label(string $state): string
    {
        return ['prematricula' => 'Prematrícula', 'activo' => 'Activo', 'retirado' => 'Retirado'][$state] ?? $state;
    }
}
