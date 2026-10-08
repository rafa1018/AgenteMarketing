<?php
declare(strict_types=1);

namespace Gabush\Application\Notifications;

use Gabush\App;
use Gabush\Application\Email\EmailService;
use Gabush\Infrastructure\Database\Database;

/**
 * Tells a family something happened with their student: an entry in "Novedades" (portal), a push
 * notification to every device where they installed the app, and an e-mail to the guardian when the
 * corresponding template is active. Staff devices are notified too for online payments.
 */
final class Notifier
{
    public function __construct(private readonly Database $db, private readonly EmailService $email, private readonly string $baseUrl)
    {
    }

    public static function from(App $app): self
    {
        return $app->service(self::class, static fn(App $a) => new self($a->db(), EmailService::from($a), $a->baseUrl()));
    }

    public static function money(int $v): string
    {
        return '$ ' . number_format($v, 0, ',', '.');
    }

    /** @return array{name:string,email:?string,student:string,code:string}|null */
    private function contact(int $studentId): ?array
    {
        $r = $this->db->one(
            "SELECT s.first_name, s.last_name, s.code, g.full_name, g.email
             FROM students s LEFT JOIN guardians g ON g.family_id = s.family_id AND g.id = (
                 SELECT g2.id FROM guardians g2 WHERE g2.family_id = s.family_id AND g2.email IS NOT NULL ORDER BY g2.is_billing DESC, g2.is_primary DESC, g2.id LIMIT 1)
             WHERE s.id = ?",
            [$studentId],
        );
        if (!$r) return null;
        return ['name' => (string) ($r['full_name'] ?? 'familia'), 'email' => $r['email'], 'student' => trim($r['first_name'] . ' ' . $r['last_name']), 'code' => $r['code']];
    }

    /** Novedad + push for one student. */
    public function toStudent(int $studentId, string $kind, string $title, string $body, string $url = '/familia/'): void
    {
        $this->db->insert('notifications', ['student_id' => $studentId, 'kind' => $kind, 'title' => mb_substr($title, 0, 160), 'body' => mb_substr($body, 0, 500), 'url' => $url]);
        $this->push($studentId, ['title' => $title, 'body' => $body, 'url' => $url, 'tag' => $kind]);
    }

    /** Web push to the family's devices (uses the panel's VAPID keys). Expired devices are removed. */
    private function push(int $studentId, array $message): void
    {
        if (!function_exists('push_send_one') || !function_exists('curl_init')) return;
        $subs = $this->db->all('SELECT id, endpoint, p256dh, auth, prefs FROM push_subscriptions WHERE student_id = ?', [$studentId]);
        if (!$subs) return;
        $vapid = \push_vapid();
        foreach ($subs as $s) {
            $prefs = $s['prefs'] ? json_decode($s['prefs'], true) : [];
            if (($prefs[$message['tag']] ?? true) === false) continue;
            try {
                $code = \push_send_one(['endpoint' => $s['endpoint'], 'keys' => ['p256dh' => $s['p256dh'], 'auth' => $s['auth']]], $message, $vapid, 'mailto:gabushjardin@gmail.com');
            } catch (\Throwable) {
                $code = 0;
            }
            if ($code === 404 || $code === 410) $this->db->run('DELETE FROM push_subscriptions WHERE id = ?', [$s['id']]);
            elseif ($code >= 200 && $code < 300) $this->db->run('UPDATE push_subscriptions SET last_ok_at = NOW() WHERE id = ?', [$s['id']]);
        }
    }

    private function portal(string $path = ''): string
    {
        return $this->baseUrl . '/familia/' . ltrim($path, '/');
    }

    // ───────────────────────── events ─────────────────────────
    public function paymentApproved(int $paymentId): void
    {
        $p = $this->db->one('SELECT id, student_id, amount, paid_on, receipt_number, source FROM payments WHERE id = ?', [$paymentId]);
        if (!$p) return;
        $c = $this->contact((int) $p['student_id']);
        if (!$c) return;
        $items = $this->db->all('SELECT c.description, pa.amount FROM payment_allocations pa JOIN charges c ON c.id = pa.charge_id WHERE pa.payment_id = ?', [$paymentId]);
        $this->toStudent((int) $p['student_id'], 'pago', 'Pago recibido', self::money((int) $p['amount']) . ' · comprobante ' . $p['receipt_number'], '/familia/#/pagos/' . $paymentId);
        $rows = implode('', array_map(static fn($i) => '<tr><td style="padding:4px 8px">' . htmlspecialchars($i['description']) . '</td><td style="padding:4px 8px;text-align:right">' . self::money((int) $i['amount']) . '</td></tr>', $items));
        $this->email->queue('payment_receipt', $c['email'], $c['name'], [
            'acudiente' => $c['name'], 'estudiante' => $c['student'], 'codigo' => $c['code'], 'valor' => self::money((int) $p['amount']),
            'fecha' => date('d/m/Y', strtotime($p['paid_on'])), 'comprobante' => (string) $p['receipt_number'],
            'detalle_html' => $rows ? '<table style="border-collapse:collapse;width:100%;background:#f7f8fc;border-radius:8px">' . $rows . '</table>' : '',
            'enlace' => $this->portal('#/pagos/' . $paymentId), 'boton_texto' => 'Ver comprobante',
        ]);
        if ($p['source'] === 'en_linea') {
            // the school hears about it too: push to the panel's devices + an e-mail to the school's own account
            if (function_exists('push_notify')) {
                @\push_notify('pagos', ['title' => 'Pago en línea recibido', 'body' => $c['student'] . ' · ' . self::money((int) $p['amount']), 'url' => '/admin/#/cartera', 'tag' => 'pago-en-linea']);
            }
            $smtp = $this->email->account(); // the school's own mailbox (e.g. its Gmail) receives the notice
            $method = (string) $this->db->value('SELECT method FROM payments WHERE id = ?', [$paymentId]);
            $this->email->queue('staff_online_payment', ($smtp['fromEmail'] ?? '') ?: null, $smtp['fromName'] ?? null, [
                'estudiante' => $c['student'], 'codigo' => $c['code'], 'valor' => self::money((int) $p['amount']),
                'fecha' => date('d/m/Y', strtotime($p['paid_on'])), 'comprobante' => (string) $p['receipt_number'],
                'pasarela' => $method === 'mercadopago' ? 'Mercado Pago' : 'Wompi',
                'detalle_html' => $rows ? '<table style="border-collapse:collapse;width:100%;background:#f7f8fc;border-radius:8px">' . $rows . '</table>' : '',
                'enlace' => $this->baseUrl . '/admin/#/cartera', 'boton_texto' => 'Ver en la cartera',
            ]);
        }
    }

    public function chargeCreated(int $chargeId): void
    {
        $ch = $this->db->one('SELECT student_id, description, amount, due_on FROM charges WHERE id = ?', [$chargeId]);
        if (!$ch) return;
        $c = $this->contact((int) $ch['student_id']);
        if (!$c) return;
        $this->toStudent((int) $ch['student_id'], 'cobro', 'Nuevo cobro: ' . $ch['description'], self::money((int) $ch['amount']) . ($ch['due_on'] ? ' · vence el ' . date('d/m/Y', strtotime($ch['due_on'])) : ''), '/familia/#/pagos');
        $this->email->queue('charge_created', $c['email'], $c['name'], [
            'acudiente' => $c['name'], 'estudiante' => $c['student'], 'concepto' => $ch['description'], 'valor' => self::money((int) $ch['amount']),
            'vence' => $ch['due_on'] ? ' (vence el ' . date('d/m/Y', strtotime($ch['due_on'])) . ')' : '', 'enlace' => $this->portal('#/pagos'), 'boton_texto' => 'Pagar en línea',
        ]);
    }

    public function messageSent(int $messageId, int $studentId, string $subject, string $body, bool $sendEmail): void
    {
        $this->toStudent($studentId, 'mensaje', $subject, mb_substr(strip_tags($body), 0, 140), '/familia/#/mensajes/' . $messageId);
        if (!$sendEmail) return;
        $c = $this->contact($studentId);
        if ($c) $this->email->queue('new_message', $c['email'], $c['name'], ['acudiente' => $c['name'], 'estudiante' => $c['student'], 'asunto' => $subject, 'mensaje' => $body, 'enlace' => $this->portal('#/mensajes/' . $messageId), 'boton_texto' => 'Leer en el portal']);
    }

    /** Daily reminder of what is pending/overdue (once a day per student, see reminders_sent). */
    public function paymentReminder(int $studentId, int $balance, array $charges, int $lateFees): void
    {
        $key = 'pay:' . $studentId . ':' . date('Y-m-d');
        if ($this->db->value('SELECT 1 FROM reminders_sent WHERE `key` = ?', [$key])) return;
        $this->db->run('INSERT INTO reminders_sent (`key`) VALUES (?)', [$key]);
        $c = $this->contact($studentId);
        if (!$c) return;
        $this->toStudent($studentId, 'recordatorio', 'Pago pendiente: ' . self::money($balance), $lateFees > 0 ? 'Incluye ' . self::money($lateFees) . ' de mora. Paga en línea desde el portal.' : 'Puedes pagar en línea desde el portal.', '/familia/#/pagos');
        $rows = implode('', array_map(static fn($x) => '<tr><td style="padding:4px 8px">' . htmlspecialchars($x['description']) . '</td><td style="padding:4px 8px;text-align:right">' . self::money((int) $x['balance']) . '</td></tr>', $charges));
        $this->email->queue('payment_reminder', $c['email'], $c['name'], [
            'acudiente' => $c['name'], 'estudiante' => $c['student'], 'saldo' => self::money($balance),
            'detalle_html' => '<table style="border-collapse:collapse;width:100%;background:#f7f8fc;border-radius:8px">' . $rows . '</table>',
            'nota_mora' => $lateFees > 0 ? 'El saldo incluye ' . self::money($lateFees) . ' de mora por días de retraso, según el contrato de matrícula.' : '',
            'enlace' => $this->portal('#/pagos'), 'boton_texto' => 'Pagar en línea',
        ]);
    }

    public function documentRejected(int $studentId, string $document, string $note): void
    {
        $this->toStudent($studentId, 'documento', 'Documento por corregir: ' . $document, $note ?: 'Revísalo y súbelo de nuevo.', '/familia/#/documentos');
        $c = $this->contact($studentId);
        if ($c) $this->email->queue('document_rejected', $c['email'], $c['name'], ['acudiente' => $c['name'], 'estudiante' => $c['student'], 'documento' => $document, 'nota' => $note, 'enlace' => $this->portal('#/documentos'), 'boton_texto' => 'Subir de nuevo']);
    }

    public function absence(int $studentId, string $day, string $status): void
    {
        $label = $status === 'ausente' ? 'no asistió' : 'llegó tarde';
        $c = $this->contact($studentId);
        $this->toStudent($studentId, 'asistencia', 'Asistencia del ' . date('d/m', strtotime($day)), ($c['student'] ?? 'El estudiante') . " $label hoy. Si fue por una razón justificada, avísanos.", '/familia/#/asistencia');
    }

    public function gradesPublished(int $studentId, string $period): void
    {
        $this->toStudent($studentId, 'notas', "Boletín del $period disponible", 'Ya puedes ver los logros y el desempeño en el portal.', '/familia/#/notas');
    }
}
