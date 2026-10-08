<?php
declare(strict_types=1);

namespace Gabush\Http\Views;

/**
 * Printable "paz y salvo", same layout the school used in Cerkademia. The authorized signature is printed only
 * when the student owes nothing; otherwise the signature line stays blank and the pending amount is stated.
 */
final class PazYSalvoView
{
    /**
     * @param array<string,mixed> $d BillingService::clearance()
     * @param array{image:?string,name:string,title:string} $signature
     */
    public static function render(array $d, array $signature): string
    {
        $e = static fn($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
        $months = [1 => 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        $short = [1 => 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        $today = sprintf('%02d de %s de %d', (int) date('j'), ucfirst($months[(int) date('n')]), (int) date('Y'));
        $printed = sprintf('%02d/%s/%d %s', (int) date('j'), $short[(int) date('n')], (int) date('Y'), date('h:i:s a'));
        $school = (string) ($d['school']['name'] ?? 'Jardín Infantil Gabush');
        [$top, $name] = str_contains(mb_strtoupper($school), 'GABUSH') ? ['JARDÍN INFANTIL', 'GABUSH'] : ['', mb_strtoupper($school)];
        // "JARDÍN - Jardín A"; just "Transición" when the course already is the grade
        $course = (string) ($d['course'] ?? '');
        $gradeName = (string) ($d['grade'] ?? '');
        $grade = $gradeName !== '' && mb_stripos($course, $gradeName) === 0 && mb_strlen($course) <= mb_strlen($gradeName) + 1
            ? $course
            : trim(implode(' - ', array_filter([$gradeName ? mb_strtoupper($gradeName) : null, $course ?: null])));
        $ok = (bool) $d['upToDate'];
        $sign = $ok && $signature['image']
            ? '<img class="sig" src="' . $e($signature['image']) . '" alt="Firma">'
            : '<div class="sig-blank"></div>';
        $who = $ok && $signature['name'] ? '<div class="who">' . $e($signature['name']) . '</div>' : '';
        $statement = $ok
            ? '<p class="statement">Certificamos que el estudiante se encuentra <b>a paz y salvo</b> por todo concepto con la institución a la fecha.</p>'
            : '<p class="statement pending">Este documento no es válido: el estudiante tiene un saldo pendiente de <b>$ ' . number_format((int) $d['pending'], 0, ',', '.') . '</b>. Se firma cuando esté al día.</p>';
        return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<title>Paz y salvo ' . $e($d['code']) . ' · ' . $e($school) . '</title><style>'
            . '*{box-sizing:border-box}body{margin:0;background:#eef1f6;font-family:Arial,Helvetica,sans-serif;color:#111}'
            . '.bar{max-width:820px;margin:16px auto 0;display:flex;justify-content:flex-end;padding:0 12px}'
            . '.bar button{border:0;border-radius:999px;background:#23206b;color:#fff;font-weight:bold;padding:10px 18px;cursor:pointer}'
            . '.sheet{position:relative;max-width:820px;margin:12px auto 24px;background:#fff;border:1.5px solid #333;border-radius:14px;padding:18px 26px 12px}'
            . '.head{display:grid;grid-template-columns:110px 1fr 110px;align-items:center}.head img{width:96px;height:auto}'
            . '.brand{text-align:center}.brand .t{font-size:22px;font-weight:bold;letter-spacing:.5px}.brand .n{font-size:38px;font-weight:bold;letter-spacing:1px;margin-top:2px}'
            . 'h1{text-align:center;font-size:28px;letter-spacing:12px;margin:22px 0 20px}'
            . '.kv{display:grid;grid-template-columns:110px 1fr auto auto;column-gap:14px;row-gap:9px;align-items:baseline;font-size:14px;padding:0 8px}'
            . '.kv .big{font-size:16px}.kv b{font-size:16px}'
            . '.statement{margin:18px 8px 0;font-size:13.5px;line-height:1.5}.pending{color:#b42318}'
            . '.foot{display:grid;grid-template-columns:1fr 290px 1fr;align-items:end;gap:10px;margin-top:10px;font-size:9.5px;font-style:italic}'
            . '.signbox{text-align:center;font-style:normal;min-width:270px}.sig{display:block;max-height:78px;max-width:250px;margin:0 auto -6px}.sig-blank{height:72px}'
            . '.signbox hr{border:0;border-top:1px solid #333;margin:0 0 4px}.signbox .t{font-size:12.5px;font-weight:bold}.who{font-size:11.5px;margin-bottom:2px}'
            . '.slogan{text-align:right}'
            . '@media (max-width:640px){.head{grid-template-columns:70px 1fr}.head img{width:64px}.brand .n{font-size:28px}.kv{grid-template-columns:90px 1fr}.foot{grid-template-columns:1fr}.slogan{text-align:left}h1{letter-spacing:6px}}'
            . '@media print{body{background:#fff}.bar{display:none}.sheet{margin:0 auto}}'
            . '</style></head><body>'
            . '<div class="bar"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>'
            . '<div class="sheet">'
            . '<div class="head"><img src="/images/opt/escudo-400.webp" alt=""><div class="brand">' . ($top ? '<div class="t">' . $e($top) . '</div>' : '') . '<div class="n">' . $e($name) . '</div></div><div></div></div>'
            . '<h1>PAZ Y SALVO</h1>'
            . '<div class="kv">'
            . '<span class="big">Estudiante:</span><b>' . $e($d['student']) . '</b><span class="big">Código:</span><b>' . $e($d['code']) . '</b>'
            . '<span>Grado:</span><span>' . $e($grade ?: '—') . '</span><span></span><span></span>'
            . '<span>Fecha:</span><span>' . $e($today) . '</span><span></span><span></span>'
            . '</div>'
            . $statement
            . '<div class="foot"><div>(Fecha y hora de impresión: ' . $e($printed) . ')</div>'
            . '<div class="signbox">' . $sign . '<hr>' . $who . '<div class="t">' . $e($signature['title'] ?: 'Firma autorizada Cartera') . '</div></div>'
            . '<div class="slogan">SU PUNTUALIDAD NOS PERMITE SERVIRLES MEJOR</div></div>'
            . '</div></body></html>';
    }
}
