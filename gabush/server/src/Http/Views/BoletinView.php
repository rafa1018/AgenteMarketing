<?php
declare(strict_types=1);

namespace Gabush\Http\Views;

/**
 * Report card ("boletín de desempeño") ready to print or download as PDF, with the look of gabushkids.com:
 * letter-block logo, school colours, the shield and the lion. One page (or more) per student, so a whole
 * course prints in one go. "Descargar PDF" builds the file in the browser (html2pdf); "Imprimir" uses the
 * browser's print / "Guardar como PDF".
 */
final class BoletinView
{
    private const AREA_COLORS = [['#e5197e', '#fff'], ['#1fa3dd', '#fff'], ['#5cb531', '#fff'], ['#f26b1d', '#fff'], ['#8e44c9', '#fff'], ['#f8c21c', '#23206b'], ['#12b5c9', '#fff']];
    private const LEVEL_STYLE = [
        'Excelente' => ['#e6f6dd', '#2f7d12', '#5cb531'],
        'Bueno' => ['#e3f3fb', '#145f8c', '#1fa3dd'],
        'Aceptable' => ['#fff3c4', '#8a5716', '#f8c21c'],
        'Insuficiente' => ['#fde4e3', '#b42318', '#d92d20'],
    ];

    /**
     * @param list<array<string,mixed>> $cards one per student: ['student' => …, 'reportCard' => …, 'general' => ?string]
     * @param array<string,mixed> $o period (int|'final'), periodName, year, school, levels, signature, fileName
     */
    public static function render(array $cards, array $o): string
    {
        $e = static fn($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
        $title = count($cards) === 1 ? 'Boletín ' . $cards[0]['student']['name'] : 'Boletines ' . ($cards[0]['student']['course'] ?? '');
        $pages = '';
        foreach ($cards as $c) $pages .= self::page($c, $o, $e);
        if ($pages === '') $pages = '<div class="page empty">No hay estudiantes con calificaciones para mostrar.</div>';
        $file = preg_replace('/[^\w-]+/u', '-', (string) ($o['fileName'] ?? 'boletin'));
        return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<title>' . $e($title) . ' · ' . $e($o['periodName']) . ' ' . $e($o['year']) . '</title>'
            . '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
            . '<link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Nunito:wght@400;600;700;800&display=swap" rel="stylesheet">'
            . '<style>' . self::css() . '</style></head><body>'
            . '<div class="bar"><span>' . $e($title) . ' · ' . $e($o['periodName']) . ' ' . $e($o['year']) . '</span>'
            . '<button type="button" id="pdf">Descargar PDF</button>'
            . '<button type="button" id="share" class="ghost" hidden>Compartir</button>'
            . (!empty($o['whatsapp']) ? '<a class="wa" href="' . $e($o['whatsapp']) . '" target="_blank" rel="noopener">WhatsApp al acudiente</a>' : '')
            . '<button type="button" class="ghost" onclick="window.print()">Imprimir</button></div>'
            . '<main id="doc">' . $pages . '</main>'
            . '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js" crossorigin="anonymous" referrerpolicy="no-referrer"></script>'
            . '<script>(function(){var name=' . json_encode($file . '.pdf') . ',title=' . json_encode($title . ' · ' . $o['periodName'] . ' ' . $o['year']) . ';'
            . 'function make(){document.body.classList.add("pdf");return html2pdf().set({margin:0,filename:name,image:{type:"jpeg",quality:0.95},html2canvas:{scale:2,useCORS:true,backgroundColor:"#ffffff"},'
            . 'jsPDF:{unit:"mm",format:"a4",orientation:"portrait"},pagebreak:{mode:["css","legacy"],avoid:[".subject",".keep"]}}).from(document.getElementById("doc")).outputPdf("blob")'
            . '.then(function(b){document.body.classList.remove("pdf");return b})}'
            . 'function busy(btn,on,label){btn.disabled=on;btn.textContent=on?"Generando PDF…":label}'
            // download
            . 'document.getElementById("pdf").addEventListener("click",function(){var b=this;if(!window.html2pdf){window.print();return}busy(b,true);'
            . 'make().then(function(blob){var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){URL.revokeObjectURL(a.href);a.remove()},2000);busy(b,false,"Descargar PDF")})'
            . '.catch(function(){busy(b,false,"Descargar PDF");window.print()})});'
            // share the PDF file itself (phones: WhatsApp, correo…)
            . 'var s=document.getElementById("share");try{if(navigator.canShare&&navigator.canShare({files:[new File(["x"],"x.pdf",{type:"application/pdf"})]}))s.hidden=false}catch(e){}'
            . 's.addEventListener("click",function(){if(!window.html2pdf)return;busy(s,true);make().then(function(blob){busy(s,false,"Compartir");'
            . 'return navigator.share({files:[new File([blob],name,{type:"application/pdf"})],title:title})}).catch(function(){busy(s,false,"Compartir")})});'
            . '})();</script>'
            . '</body></html>';
    }

    private static function chip(?string $level, string $size = ''): string
    {
        if (!$level) return '<span class="chip none' . $size . '">—</span>';
        [$bg, $fg, $bd] = self::LEVEL_STYLE[$level] ?? ['#eef0f8', '#615f86', '#d6d8ec'];
        return '<span class="chip' . $size . '" style="background:' . $bg . ';color:' . $fg . ';border-color:' . $bd . '">' . htmlspecialchars($level, ENT_QUOTES, 'UTF-8') . '</span>';
    }

    /** @param array<string,mixed> $c */
    private static function page(array $c, array $o, callable $e): string
    {
        $s = $c['student'];
        $rc = $c['reportCard'];
        $period = $o['period'];
        $periods = $rc['periods'];
        $school = (array) $o['school'];
        $blocks = '';
        foreach ([['G', '#e5197e'], ['A', '#f8c21c'], ['B', '#23206b'], ['U', '#f8c21c'], ['S', '#5cb531'], ['H', '#f26b1d']] as $i => [$l, $bg]) {
            $blocks .= '<span class="blk" style="background:' . $bg . ';transform:rotate(' . [-4, 3, -2, 4, -3, 2][$i] . 'deg)">' . $l . '</span>';
        }
        $kids = '<span class="kids"><b style="color:#4aa52a">K</b><b style="color:#e5197e">i</b><b style="color:#8e44c9">d</b><b style="color:#1fa3dd">s</b></span>';
        $photo = $s['photo'] ? '<img class="photo" src="' . $e($s['photo']) . '" alt="">' : '<span class="photo initials">' . $e($s['initials']) . '</span>';
        // header + student
        $html = '<section class="page">'
            . '<div class="stripe"><i style="background:#e5197e"></i><i style="background:#f8c21c"></i><i style="background:#23206b"></i><i style="background:#1fa3dd"></i><i style="background:#5cb531"></i><i style="background:#f26b1d"></i></div>'
            . '<header class="head keep"><img class="shield" src="/images/opt/escudo-400.webp" alt="">'
            . '<div class="brand"><div class="blocks">' . $blocks . '</div>' . $kids . '<p class="tag">Jardín Infantil · Creciendo con las artes</p></div>'
            . '<div class="doc"><span class="doc-kind">Boletín de desempeño</span><span class="doc-period">' . $e($o['periodName']) . '</span><span class="doc-year">Año ' . $e($o['year']) . '</span></div></header>'
            . '<div class="student keep">' . $photo . '<div class="who"><h1>' . $e($s['name']) . '</h1>'
            . '<div class="facts"><span><small>Código</small>' . $e($s['code']) . '</span>'
            . ($s['doc'] ? '<span><small>Documento</small>' . $e($s['doc']) . '</span>' : '')
            . '<span><small>Curso</small>' . $e($s['course'] ?? '—') . '</span>'
            . ($s['director'] ? '<span><small>Director(a) de grupo</small>' . $e($s['director']) . '</span>' : '')
            . '</div></div>'
            . '<div class="general"><small>Desempeño general</small>' . self::chip($c['general'], ' big') . '</div></div>';
        if (!$rc['areas']) {
            return $html . '<p class="empty">Aún no hay calificaciones registradas para ' . $e($o['periodName']) . '.</p>' . self::footer($o, $s, $e) . '</section>';
        }
        // areas
        $head = '<tr><th class="subj">Materia</th>';
        foreach ($periods as $p) $head .= '<th class="' . ($period === $p['id'] ? 'on' : '') . '">P' . (int) $p['number'] . '</th>';
        $head .= '<th class="' . ($period === 'final' ? 'on' : '') . '">Final</th></tr>';
        foreach (array_values($rc['areas']) as $i => $a) {
            [$bg, $fg] = self::AREA_COLORS[$i % count(self::AREA_COLORS)];
            $rows = '';
            foreach ($a['subjects'] as $sub) {
                $cells = '';
                foreach ($periods as $p) {
                    $pp = $sub['periods'][$p['id']] ?? null;
                    $cells .= '<td class="' . ($period === $p['id'] ? 'on' : '') . '">' . self::chip($pp['level'] ?? null, ' sm') . ($pp && $pp['score'] !== null ? '<em>' . rtrim(rtrim(number_format((float) $pp['score'], 1, ',', ''), '0'), ',') . '</em>' : '') . '</td>';
                }
                $cells .= '<td class="' . ($period === 'final' ? 'on' : '') . '">' . self::chip($sub['final'] ?? null, ' sm') . '</td>';
                $detail = '';
                if ($period !== 'final' && ($pp = $sub['periods'][$period] ?? null)) {
                    $ach = '';
                    foreach ($pp['achievements'] as $x) $ach .= '<li><span class="dot" style="background:' . (self::LEVEL_STYLE[$x['level'] ?? '']['2'] ?? '#c9cbe0') . '"></span><span>' . $e($x['description']) . '</span>' . self::chip($x['level'] ?? null, ' xs') . '</li>';
                    if ($ach) $detail .= '<ul class="ach">' . $ach . '</ul>';
                    if (!empty($pp['comments'])) $detail .= '<p class="comment">' . $e($pp['comments']) . '</p>';
                    if (!empty($pp['absences'])) $detail .= '<p class="abs">Fallas en el periodo: <b>' . (int) $pp['absences'] . '</b></p>';
                }
                $rows .= '<tbody class="subject"><tr><td class="subj">' . $e($sub['name']) . '</td>' . $cells . '</tr>'
                    . ($detail ? '<tr class="detail"><td colspan="' . (count($periods) + 2) . '">' . $detail . '</td></tr>' : '') . '</tbody>';
            }
            $html .= '<div class="area"><h2 style="background:' . $bg . ';color:' . $fg . '">' . $e($a['name']) . '</h2>'
                . '<table><thead>' . $head . '</thead>' . $rows . '</table></div>';
        }
        // scale
        $scale = '';
        foreach ($o['levels'] as $l) {
            $scale .= '<span>' . self::chip($l['name'], ' xs') . ' ' . $e(rtrim(rtrim(number_format((float) $l['min'], 1, ',', ''), '0'), ',')) . '–' . $e(rtrim(rtrim(number_format((float) $l['max'], 1, ',', ''), '0'), ',')) . '</span>';
        }
        $html .= '<div class="scale keep"><b>Escala de valoración</b>' . $scale . '</div>';
        return $html . self::footer($o, $s, $e) . '</section>';
    }

    /** Signatures + school line. */
    private static function footer(array $o, array $s, callable $e): string
    {
        $sig = $o['signature'] ?? null;
        $school = (array) $o['school'];
        $rect = !empty($sig['image']) ? '<img src="' . $e($sig['image']) . '" alt="Firma">' : '<span class="blank"></span>';
        return '<div class="signs keep">'
            . '<div><span class="blank"></span><hr><b>' . $e($s['director'] ?: 'Director(a) de grupo') . '</b><small>Director(a) de grupo</small></div>'
            . '<div>' . $rect . '<hr><b>' . $e(($sig['name'] ?? '') ?: 'Rectoría') . '</b><small>Rectora</small></div></div>'
            . '<footer class="keep"><img src="/images/opt/leon-asomado-160.webp" alt=""><span>' . $e($school['name'] ?? 'Jardín Infantil Gabush')
            . ($school['phone'] ?? '' ? ' · ' . $e($school['phone']) : '') . ' · gabushkids.com</span><span class="date">Emitido el ' . $e($o['issuedOn']) . '</span></footer>';
    }

    private static function css(): string
    {
        return <<<'CSS'
*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:#e9eef8;font-family:Nunito,'Segoe UI',system-ui,sans-serif;color:#2a2850;font-size:12.5px}
h1,h2,.doc,.blk,.kids,.general small,.scale b{font-family:Fredoka,'Trebuchet MS',system-ui,sans-serif}
.bar{position:sticky;top:0;z-index:5;display:flex;gap:8px;align-items:center;justify-content:flex-end;padding:10px 16px;background:#23206b;color:#fff;font-weight:700}
.bar span{margin-right:auto;font-size:14px}.bar button{border:0;border-radius:999px;background:#f8c21c;color:#23206b;font-weight:800;padding:9px 18px;cursor:pointer;font-size:14px}
.bar button.ghost{background:transparent;color:#fff;box-shadow:inset 0 0 0 2px #ffffff66}.bar button:disabled{opacity:.7}
.bar .wa{border-radius:999px;background:#25d366;color:#fff;font-weight:800;padding:9px 16px;text-decoration:none;font-size:14px}
@media (max-width:640px){.bar{flex-wrap:wrap}.bar span{width:100%;font-size:13px}.bar button,.bar .wa{flex:1;padding:9px 10px;font-size:13px;text-align:center}}
main{padding:18px 0 40px}
.page{position:relative;width:210mm;min-height:297mm;margin:0 auto 18px;background:#fff;padding:14mm 13mm 12mm;box-shadow:0 10px 30px -18px rgba(35,32,107,.5);page-break-after:always;break-after:page;overflow:hidden}
.page:last-child{page-break-after:auto;break-after:auto}
.stripe{position:absolute;inset:0 0 auto;height:7px;display:flex}.stripe i{flex:1}
.head{display:grid;grid-template-columns:86px 1fr auto;gap:14px;align-items:center;margin-top:2px}
.shield{width:84px;height:auto}
.brand{display:flex;flex-direction:column;align-items:flex-start}
.blocks{display:flex;gap:4px;font-size:27px}
.blk{display:inline-grid;place-items:center;width:1.12em;height:1.12em;border-radius:.16em;border:2px solid #fff;box-shadow:0 2px 0 rgba(0,0,0,.12),0 6px 12px -8px rgba(35,32,107,.6);color:#fff;font-weight:700;line-height:1}
.kids{margin:-6px 0 0 132px;background:#fff;border-radius:999px;padding:1px 9px;box-shadow:0 3px 8px -4px rgba(35,32,107,.5);font-size:15px;transform:rotate(-4deg)}
.tag{margin:6px 0 0;color:#615f86;font-weight:700;font-size:12px;letter-spacing:.02em}
.doc{display:flex;flex-direction:column;align-items:flex-end;gap:3px}
.doc-kind{background:#23206b;color:#fff;border-radius:999px;padding:5px 14px;font-weight:600;font-size:14px}
.doc-period{font-size:22px;font-weight:700;color:#e5197e;line-height:1.1}.doc-year{font-weight:600;color:#23206b}
.student{display:grid;grid-template-columns:auto 1fr auto;gap:16px;align-items:center;margin:14px 0 12px;padding:13px 16px;border-radius:18px;background:linear-gradient(120deg,#e6f6ff 0%,#fff9ec 100%);border:2px solid #e3e5f3}
.photo{width:76px;height:76px;border-radius:50%;object-fit:cover;border:4px solid #fff;box-shadow:0 6px 14px -8px rgba(35,32,107,.6)}
.photo.initials{display:grid;place-items:center;background:#eeedfb;color:#3a36a8;font:700 26px Fredoka,sans-serif}
.who h1{margin:0 0 6px;font-size:22px;color:#23206b;line-height:1.15}
.facts{display:flex;flex-wrap:wrap;gap:6px 18px}.facts span{font-weight:700;color:#23206b}.facts small{display:block;font-size:10px;font-weight:700;color:#8a88a8;text-transform:uppercase;letter-spacing:.06em}
.general{text-align:center}.general small{display:block;margin-bottom:5px;font-size:12px;color:#615f86}
.chip{display:inline-block;border:1.5px solid #d6d8ec;border-radius:999px;padding:2px 10px;font-weight:800;font-size:11.5px;white-space:nowrap}
.chip.big{font-size:15px;padding:6px 16px}.chip.sm{font-size:10.5px;padding:1px 8px}.chip.xs{font-size:9.5px;padding:0 7px}.chip.none{color:#b7b9cf;border-color:#eceef7}
.area{margin-top:10px;border:2px solid #e3e5f3;border-radius:16px;overflow:hidden}
.area h2{margin:0;padding:7px 14px;font-size:14.5px;font-weight:600;letter-spacing:.02em}
table{width:100%;border-collapse:collapse}
th{font-size:10.5px;color:#615f86;font-weight:800;text-transform:uppercase;letter-spacing:.05em;padding:6px 4px;background:#f6f7fd;text-align:center}
th.subj,td.subj{text-align:left;padding-left:14px}th.on,td.on{background:#fff7e0}
td{padding:6px 4px;text-align:center;border-top:1px solid #eef0f8;vertical-align:middle}
td.subj{font-weight:800;color:#23206b;font-size:12.5px}
td em{display:block;font-style:normal;font-size:10px;color:#8a88a8;margin-top:1px}
tr.detail td{text-align:left;padding:2px 14px 9px;border-top:0;background:#fffdf6}
.ach{list-style:none;margin:2px 0 0;padding:0;display:grid;gap:3px}
.ach li{display:grid;grid-template-columns:8px 1fr auto;gap:8px;align-items:start;font-size:11.5px;line-height:1.35}
.ach .dot{width:7px;height:7px;border-radius:50%;margin-top:5px}
.comment{margin:6px 0 0;padding:6px 10px;border-radius:10px;background:#eef7ff;color:#185a8a;font-style:italic;font-size:11.5px}
.abs{margin:4px 0 0;font-size:11px;color:#615f86}
.scale{display:flex;flex-wrap:wrap;gap:6px 14px;align-items:center;margin-top:12px;padding:8px 12px;border-radius:12px;background:#f6f7fd;font-size:11px}
.scale b{color:#23206b;font-weight:600;font-size:12.5px;margin-right:4px}
.signs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin:26px 18px 0}
.signs div{text-align:center;display:flex;flex-direction:column;align-items:center}
.signs img{max-height:62px;max-width:200px;margin-bottom:-6px}.signs .blank{height:56px}
.signs hr{width:100%;border:0;border-top:1.5px solid #23206b;margin:0 0 4px}.signs b{color:#23206b;font-size:12.5px}.signs small{color:#8a88a8;font-size:10.5px}
footer{display:flex;align-items:center;gap:10px;margin-top:18px;padding-top:8px;border-top:2px dashed #e3e5f3;color:#615f86;font-size:10.5px;font-weight:700}
footer img{width:34px;height:auto}footer .date{margin-left:auto}
.empty{margin:30px 0;text-align:center;color:#8a88a8;font-weight:700;font-size:14px}
.pdf main{padding:0}.pdf .page{margin:0;box-shadow:none;min-height:0}
@page{size:A4;margin:0}
@media print{body{background:#fff}.bar{display:none}main{padding:0}.page{margin:0;box-shadow:none}}
@media (max-width:820px){.page{width:auto;min-height:0;margin:0 0 12px;padding:16px}.head{grid-template-columns:60px 1fr}.doc{grid-column:1/-1;align-items:flex-start}.shield{width:58px}.student{grid-template-columns:auto 1fr}.general{grid-column:1/-1;text-align:left}.kids{margin-left:110px}}
CSS;
    }
}
