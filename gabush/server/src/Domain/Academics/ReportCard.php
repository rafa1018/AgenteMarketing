<?php
declare(strict_types=1);

namespace Gabush\Domain\Academics;

/**
 * Report card rules for preschool (dimensions of development):
 * - each period: per subject, the achievements (logros) marked with their performance level, an optional
 *   numeric score and the absences;
 * - the subject's level in a period is the most frequent level among its marked achievements (ties → the
 *   higher one), or the level of the score when there is one;
 * - the final level of a subject is computed from the periods' levels weighted by the period weight
 *   (levels are ranked: Insuficiente < Aceptable < Bueno < Excelente).
 */
final class ReportCard
{
    /**
     * @param list<array{id:int,name:string,min:float,max:float}> $levels ordered from lowest to highest
     */
    public function __construct(private readonly array $levels)
    {
    }

    /** @param list<int|null> $levelIds */
    public function levelOfAchievements(array $levelIds): ?int
    {
        $ids = array_values(array_filter($levelIds, static fn($x) => $x !== null));
        if (!$ids) return null;
        $count = array_count_values($ids);
        $rank = array_flip(array_column($this->levels, 'id'));
        $best = null;
        foreach ($count as $id => $n) {
            if ($best === null || $n > $count[$best] || ($n === $count[$best] && ($rank[$id] ?? 0) > ($rank[$best] ?? 0))) $best = $id;
        }
        return (int) $best;
    }

    public function levelOfScore(?float $score): ?int
    {
        if ($score === null) return null;
        foreach ($this->levels as $l) if ($score >= $l['min'] && $score <= $l['max']) return $l['id'];
        return null;
    }

    /**
     * Final level from per-period levels and weights.
     * @param array<int,array{level:?int,weight:float}> $periods
     */
    public function finalLevel(array $periods): ?int
    {
        $rank = array_flip(array_column($this->levels, 'id')); // id → position (0 = lowest)
        $sum = 0.0;
        $w = 0.0;
        foreach ($periods as $p) {
            if ($p['level'] === null || !isset($rank[$p['level']])) continue;
            $sum += $rank[$p['level']] * $p['weight'];
            $w += $p['weight'];
        }
        if ($w <= 0) return null;
        $pos = (int) round($sum / $w);
        return $this->levels[$pos]['id'] ?? null;
    }

    public function name(?int $levelId): ?string
    {
        foreach ($this->levels as $l) if ($l['id'] === $levelId) return $l['name'];
        return null;
    }
}
