<?php
declare(strict_types=1);

namespace Gabush\Infrastructure\Migration;

/** Parsers for the formats Cerkademia shows on screen. */
final class Parse
{
    private const MONTHS = ['ene' => 1, 'feb' => 2, 'mar' => 3, 'abr' => 4, 'may' => 5, 'jun' => 6, 'jul' => 7, 'ago' => 8, 'sep' => 9, 'oct' => 10, 'nov' => 11, 'dic' => 12];
    private const MONTH_NAMES = ['enero' => 1, 'febrero' => 2, 'marzo' => 3, 'abril' => 4, 'mayo' => 5, 'junio' => 6, 'julio' => 7, 'agosto' => 8, 'septiembre' => 9, 'setiembre' => 9, 'octubre' => 10, 'noviembre' => 11, 'diciembre' => 12];

    /** "05/ago/2023" or "05/08/2023" → "2023-08-05" */
    public static function date(?string $s): ?string
    {
        $s = trim((string) $s);
        if (preg_match('#^(\d{1,2})/([a-zA-Z]{3})/(\d{4})#', $s, $m) && isset(self::MONTHS[strtolower($m[2])])) {
            return sprintf('%04d-%02d-%02d', $m[3], self::MONTHS[strtolower($m[2])], $m[1]);
        }
        if (preg_match('#^(\d{1,2})/(\d{1,2})/(\d{4})#', $s, $m)) {
            return sprintf('%04d-%02d-%02d', $m[3], $m[2], $m[1]);
        }
        return null;
    }

    /** "06/oct/2026 03:33 a. m." → "2026-10-06 03:33:00" */
    public static function datetime(?string $s): ?string
    {
        $d = self::date($s);
        if ($d === null) return null;
        if (preg_match('#(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])\.?\s*m#i', (string) $s, $m)) {
            $h = (int) $m[1] % 12 + (strtolower($m[4]) === 'p' ? 12 : 0);
            return sprintf('%s %02d:%02d:%02d', $d, $h, $m[2], $m[3] ?? 0);
        }
        return $d . ' 00:00:00';
    }

    /** "$ 1.190.000" / "- $ 20.000" → 1190000 / -20000 */
    public static function money(?string $s): ?int
    {
        $s = trim((string) $s);
        if (!preg_match('/\d/', $s)) return null;
        $neg = str_contains($s, '-');
        $n = (int) preg_replace('/\D/', '', preg_replace('/,\d{1,2}$/', '', $s));
        return $neg ? -$n : $n;
    }

    /** "CC 106.583.637" → ["CC", "106583637"] */
    public static function document(?string $s): array
    {
        $s = trim((string) $s);
        if ($s === '' || strtoupper($s) === 'N/A') return [null, null];
        if (preg_match('/^([A-Z]{1,4})\s+(.+)$/', $s, $m)) return [$m[1], preg_replace('/[.\s]/', '', $m[2])];
        return [null, preg_replace('/[.\s]/', '', $s)];
    }

    /** "PENSIÓN OCTUBRE/2026" → "2026-10-01" */
    public static function monthOf(?string $s): ?string
    {
        if (!preg_match('/([A-Za-zÁÉÍÓÚáéíóú]+)\s*\/\s*(\d{4})/u', (string) $s, $m)) return null;
        $name = strtolower(strtr($m[1], ['Á' => 'a', 'É' => 'e', 'Í' => 'i', 'Ó' => 'o', 'Ú' => 'u', 'á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u']));
        $name = mb_strtolower($name);
        return isset(self::MONTH_NAMES[$name]) ? sprintf('%04d-%02d-01', $m[2], self::MONTH_NAMES[$name]) : null;
    }

    /** "Párvulos A" → "Párvulos"; "PreJardín B" → "PreJardín" */
    public static function gradeOfCourse(string $course): string
    {
        return trim(preg_replace('/\s+[A-Z]$/u', '', trim($course)));
    }

    /** "Apellido1 Apellido2, Nombre1 Nombre2" → [first, middle, last, secondLast] */
    public static function listName(string $s): array
    {
        [$last, $first] = array_map('trim', explode(',', $s, 2) + [1 => '']);
        $l = preg_split('/\s+/', $last) ?: [];
        $f = preg_split('/\s+/', $first) ?: [];
        return [$f[0] ?? '', implode(' ', array_slice($f, 1)) ?: null, $l[0] ?? '', implode(' ', array_slice($l, 1)) ?: null];
    }

    public static function nullIfEmpty(?string $s): ?string
    {
        $s = trim((string) $s);
        return $s === '' || strtoupper($s) === 'N/A' ? null : $s;
    }

    /** Title-case for names typed in capitals ("GREYCI DAYANA" → "Greyci Dayana"); mixed case is kept. */
    public static function name(?string $s): string
    {
        $s = trim(preg_replace('/\s+/', ' ', (string) $s));
        if ($s !== '' && mb_strtoupper($s) === $s) $s = mb_convert_case(mb_strtolower($s), MB_CASE_TITLE);
        return $s;
    }
}
