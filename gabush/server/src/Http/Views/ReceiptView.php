<?php
declare(strict_types=1);

namespace Gabush\Http\Views;

/** Printable payment receipt ("comprobante de pago"), same layout the school already used. */
final class ReceiptView
{
    /** @param array<string,mixed> $r BillingService::receipt() */
    public static function render(array $r): string
    {
        $e = static fn($v) => htmlspecialchars((string) $v, ENT_QUOTES, 'UTF-8');
        $money = static fn(int $v) => '$ ' . number_format($v, 0, ',', '.');
        $months = [1 => 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        $date = static fn(string $d) => sprintf('%02d/%s/%d', (int) substr($d, 8, 2), $months[(int) substr($d, 5, 2)], (int) substr($d, 0, 4));
        $school = $r['school']['name'] ?? 'Jardín Infantil Gabush';
        $rows = '';
        foreach ($r['items'] as $i) $rows .= '<tr><td>' . $e($i['description']) . '</td><td class="num">' . $money($i['amount']) . '</td></tr>';
        if ($rows === '') $rows = '<tr><td>Abono a la cuenta (saldo a favor)</td><td class="num">' . $money($r['amount']) . '</td></tr>';
        $method = ['efectivo' => 'Efectivo', 'colegio' => 'Colegio', 'nequi' => 'Nequi', 'bancolombia' => 'Bancolombia', 'wompi' => 'Wompi (en línea)', 'mercadopago' => 'Mercado Pago (en línea)', 'transferencia' => 'Transferencia'][$r['method']] ?? ucfirst((string) $r['method']);
        $void = $r['status'] === 'anulado' ? '<div class="void">ANULADO</div>' : '';
        $printed = date('d/m/Y h:i:s a');
        return '<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<title>Comprobante ' . $e($r['receipt']) . ' · ' . $e($school) . '</title><style>'
            . '*{box-sizing:border-box}body{margin:0;background:#eef1f6;font-family:Arial,Helvetica,sans-serif;color:#111}'
            . '.bar{max-width:820px;margin:16px auto 0;display:flex;justify-content:flex-end;gap:8px;padding:0 12px}'
            . '.bar button{border:0;border-radius:999px;background:#23206b;color:#fff;font-weight:bold;padding:10px 18px;cursor:pointer}'
            . '.sheet{position:relative;max-width:820px;margin:12px auto 24px;background:#fff;border:1.5px solid #333;border-radius:14px;padding:22px 26px}'
            . '.head{display:flex;align-items:center;gap:18px}.head img{width:84px;height:auto}.head h1{margin:0;font-size:26px;letter-spacing:.5px}.head h2{margin:6px 0 0;font-size:19px}'
            . '.cols{display:grid;grid-template-columns:1.1fr 1fr;gap:26px;margin-top:22px}'
            . '.kv{display:grid;grid-template-columns:120px 1fr;row-gap:8px;font-size:15px}.kv b{font-size:16px}'
            . '.items h3{margin:0 0 6px;text-align:center;font-size:14px}table{width:100%;border-collapse:collapse;font-size:12px}'
            . 'th{background:#999;color:#000;text-align:left;padding:3px 6px;border:1px solid #333}td{padding:3px 6px;border:1px solid #333}.num{text-align:right;white-space:nowrap}'
            . '.foot{display:flex;justify-content:space-between;align-items:flex-end;margin-top:26px;font-size:10px;font-style:italic}'
            . '.sign{text-align:center;font-style:normal;font-size:13px;font-weight:bold}.sign hr{width:230px;border:0;border-top:1px solid #333;margin:0 auto 4px}'
            . '.total{text-align:right;font-style:normal}.total small{font-size:12px}.total b{display:block;font-size:24px}'
            . '.void{position:absolute;inset:0;display:grid;place-items:center;font-size:90px;font-weight:bold;color:rgba(217,45,32,.18);transform:rotate(-18deg);pointer-events:none}'
            . '@media (max-width:640px){.cols{grid-template-columns:1fr}.head h1{font-size:20px}.head h2{font-size:16px}.sheet{padding:16px}}'
            . '@media print{body{background:#fff}.bar{display:none}.sheet{margin:0 auto;border-radius:10px}}'
            . '</style></head><body>'
            . '<div class="bar"><button onclick="window.print()">Imprimir / Guardar PDF</button></div>'
            . '<div class="sheet">' . $void
            . '<div class="head"><img src="/images/opt/logo-480.png" alt=""><div><h1>' . $e(mb_strtoupper($school)) . '</h1><h2>COMPROBANTE DE PAGO</h2></div></div>'
            . '<div class="cols"><div class="kv">'
            . '<span>Estudiante:</span><b>' . $e($r['student']) . '</b>'
            . '<span>Código:</span><b>' . $e($r['code']) . '</b>'
            . ($r['course'] ? '<span>Curso:</span><span>' . $e($r['course']) . '</span>' : '')
            . '<span>Documento:</span><b>' . $e($r['reference'] ?: 'Comprobante ' . $r['receipt']) . '</b>'
            . '<span>Fecha de pago:</span><span>' . $e($date($r['paidOn'])) . '</span>'
            . '<span>Punto de pago:</span><span>' . $e($method) . '</span>'
            . '<span>Observaciones:</span><span>' . $e($r['notes'] ?? '') . '</span>'
            . '</div><div class="items"><h3>CARGOS AFECTADOS</h3><table><thead><tr><th>Referencia</th><th class="num">Valor</th></tr></thead><tbody>' . $rows . '</tbody></table></div></div>'
            . '<div class="foot"><div>(Comprobante ' . $e($r['receipt']) . ')<br>(Fecha y hora de impresión: ' . $e($printed) . ')</div>'
            . '<div class="sign"><hr>Firma autorizada de recibido</div>'
            . '<div class="total"><small>Total pagado:</small><b>' . $money($r['amount']) . '</b></div></div>'
            . '</div></body></html>';
    }
}
