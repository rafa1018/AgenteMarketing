<?php
declare(strict_types=1);

namespace Gabush\Application\Email;

use Gabush\App;
use Gabush\Application\Ports\Mailer;
use Gabush\Application\Shared\Settings;
use Gabush\Infrastructure\Database\Database;
use Gabush\Infrastructure\Mail\SmtpMailer;

/**
 * E-mail to families: editable templates with {{variables}}, a queue (outbox) processed by the cron, and the
 * SMTP account configured from the panel. Nothing is sent while the account is not configured / enabled.
 */
final class EmailService
{
    /** Templates created on first use; the rectora edits them in the panel. */
    public const DEFAULTS = [
        'payment_receipt' => ['Pago recibido', 'Recibimos tu pago de {{valor}} · {{jardin}}', '<p>Hola {{acudiente}},</p><p>Recibimos el pago de <b>{{valor}}</b> de <b>{{estudiante}}</b> ({{codigo}}) el {{fecha}}.</p><p>Se aplicó a:</p>{{detalle}}<p>Comprobante No. <b>{{comprobante}}</b>. Puedes verlo e imprimirlo aquí:</p><p>{{boton}}</p><p>¡Gracias!</p>'],
        'charge_created' => ['Nuevo cobro', 'Nuevo cobro para {{estudiante}}: {{concepto}}', '<p>Hola {{acudiente}},</p><p>Se registró un cobro para <b>{{estudiante}}</b>:</p><p><b>{{concepto}}</b> por <b>{{valor}}</b>{{vence}}.</p><p>Puedes pagarlo en línea desde el portal de familias:</p><p>{{boton}}</p>'],
        'payment_reminder' => ['Recordatorio de pago', 'Recordatorio: {{estudiante}} tiene pagos pendientes', '<p>Hola {{acudiente}},</p><p>Te recordamos que <b>{{estudiante}}</b> tiene un saldo pendiente de <b>{{saldo}}</b>.</p>{{detalle}}<p>{{nota_mora}}</p><p>Puedes pagar en línea desde el portal:</p><p>{{boton}}</p><p>Si ya pagaste, ignora este mensaje.</p>'],
        'new_message' => ['Nuevo mensaje', '{{asunto}} · {{jardin}}', '<p>Hola {{acudiente}},</p><p>Tienes un nuevo mensaje del jardín sobre <b>{{estudiante}}</b>:</p><blockquote style="border-left:4px solid #e5197e;margin:0;padding:8px 14px;background:#fff7fb">{{mensaje}}</blockquote><p>{{boton}}</p>'],
        'portal_welcome' => ['Acceso al portal de familias', 'Tu acceso al portal de {{jardin}}', '<p>Hola {{acudiente}},</p><p>Ya puedes ver en línea las notas, la asistencia, los mensajes y los pagos de <b>{{estudiante}}</b>.</p><p>Usuario: <b>{{usuario}}</b><br>Contraseña temporal: <b>{{clave}}</b></p><p>Al entrar te pediremos cambiarla. Instala la app en tu teléfono para recibir los avisos.</p><p>{{boton}}</p>'],
        'password_reset' => ['Recuperar contraseña', 'Cambia tu contraseña del portal · {{jardin}}', '<p>Hola,</p><p>Pediste cambiar la contraseña del portal de <b>{{estudiante}}</b>. Este enlace sirve por 1 hora:</p><p>{{boton}}</p><p>Si no lo pediste, ignora este mensaje.</p>'],
        'staff_online_payment' => ['Aviso al jardín: pago en línea', 'Pago en línea recibido: {{estudiante}} · {{valor}}', '<p>Entró un pago en línea:</p><p><b>{{estudiante}}</b> ({{codigo}}) pagó <b>{{valor}}</b> el {{fecha}} con {{pasarela}}.</p><p>Se aplicó a:</p>{{detalle}}<p>Comprobante No. <b>{{comprobante}}</b>. Ya quedó registrado en la cartera; no tienes que hacer nada.</p><p>{{boton}}</p>'],
        'document_rejected' => ['Documento por corregir', 'Hay un documento por corregir de {{estudiante}}', '<p>Hola {{acudiente}},</p><p>El documento <b>{{documento}}</b> de {{estudiante}} necesita corrección:</p><p><i>{{nota}}</i></p><p>Puedes subirlo de nuevo desde el portal:</p><p>{{boton}}</p>'],
        'birthday' => ['Feliz cumpleaños', '🎂 ¡Feliz cumpleaños, {{nombre}}! · {{jardin}}', '<div style="text-align:center">{{leon}}<p style="margin:10px 0 4px;font-size:28px;font-weight:bold;color:#e5197e">¡Feliz cumpleaños, {{nombre}}! 🎉</p><p style="margin:0 0 18px;font-size:17px;color:#23206b">Hoy cumple <b>{{edad}}</b> y en Gabush lo celebramos contigo.</p></div><p>Querida familia de {{estudiante}}:</p><p>Que este nuevo año esté lleno de juegos, colores, canciones y muchas sonrisas. Gracias por dejarnos ser parte de su crecimiento: ¡es un regalo verle aprender y crecer cada día!</p><p style="text-align:center;font-size:26px;margin:16px 0">🎈 🎂 🎁 🎈</p><p>Con mucho cariño,<br><b>Todo el equipo de {{jardin}}</b> y el León Gabush 🦁</p>'],
    ];

    public function __construct(private readonly Database $db, private readonly Settings $settings, private readonly string $baseUrl)
    {
    }

    public static function from(App $app): self
    {
        return $app->service(self::class, static fn(App $a) => new self($a->db(), $a->service(Settings::class, static fn(App $x) => new Settings($x->db())), $a->baseUrl()));
    }

    // ───────────────────────── account ─────────────────────────
    /** @return array<string,mixed> settings without the password */
    public function account(): array
    {
        $s = (array) $this->settings->get('smtp', []);
        $hasPassword = !empty($s['password']);
        unset($s['password']);
        return $s + ['enabled' => false, 'host' => '', 'port' => 587, 'security' => 'tls', 'username' => '', 'fromEmail' => '', 'fromName' => 'Jardín Infantil Gabush', 'hasPassword' => $hasPassword];
    }

    /** @param array<string,mixed> $values password kept when empty */
    public function saveAccount(array $values): array
    {
        $now = (array) $this->settings->get('smtp', []);
        if (($values['password'] ?? '') === '') unset($values['password']);
        $this->settings->set('smtp', array_merge($now, $values));
        return $this->account();
    }

    public function mailer(): Mailer
    {
        return SmtpMailer::fromSettings((array) $this->settings->get('smtp', []));
    }

    public function enabled(): bool
    {
        $s = (array) $this->settings->get('smtp', []);
        return !empty($s['enabled']) && !empty($s['host']) && !empty($s['fromEmail'] ?? $s['username'] ?? '');
    }

    // ───────────────────────── templates ─────────────────────────
    /** @return list<array<string,mixed>> */
    public function templates(): array
    {
        foreach (self::DEFAULTS as $key => [$name, $subject, $body]) {
            $this->db->run('INSERT IGNORE INTO email_templates (`key`, name, subject, body_html) VALUES (?, ?, ?, ?)', [$key, $name, $subject, $body]);
        }
        return array_map(static fn($t) => ['id' => (int) $t['id'], 'active' => (bool) $t['active']] + $t, $this->db->all('SELECT id, `key`, name, subject, body_html AS body, active, updated_at AS updatedAt FROM email_templates ORDER BY id'));
    }

    public function saveTemplate(string $key, string $subject, string $body, bool $active): void
    {
        $this->templates();
        $this->db->run('UPDATE email_templates SET subject = ?, body_html = ?, active = ? WHERE `key` = ?', [$subject, $body, $active ? 1 : 0, $key]);
    }

    public function resetTemplate(string $key): void
    {
        if (!isset(self::DEFAULTS[$key])) return;
        [, $subject, $body] = self::DEFAULTS[$key];
        $this->db->run('UPDATE email_templates SET subject = ?, body_html = ?, active = 1 WHERE `key` = ?', [$subject, $body, $key]);
    }

    /**
     * Fills a template. Values are escaped, except the *_html ones (detail tables, button) built here.
     * @param array<string,string|int> $vars
     * @return array{subject:string,html:string}|null null when the template is disabled
     */
    public function render(string $key, array $vars): ?array
    {
        $this->templates();
        $t = $this->db->one('SELECT subject, body_html, active FROM email_templates WHERE `key` = ?', [$key]);
        if (!$t || !$t['active']) return null;
        $school = (array) $this->settings->get('school', []);
        $vars += ['jardin' => $school['name'] ?? 'Jardín Infantil Gabush'];
        $raw = [
            'detalle' => (string) ($vars['detalle_html'] ?? ''),
            'boton' => isset($vars['enlace']) ? self::button((string) $vars['enlace'], (string) ($vars['boton_texto'] ?? 'Abrir el portal')) : '',
            // the Gabush lion celebrating (PNG: every mail app shows it)
            'leon' => '<img src="' . htmlspecialchars($this->baseUrl . '/images/opt/leon-cumple-email.png', ENT_QUOTES) . '" width="200" alt="El León Gabush celebrando" style="display:block;margin:0 auto;max-width:200px;height:auto">',
        ];
        $fill = static function (string $text, bool $html) use ($vars, $raw): string {
            return preg_replace_callback('/\{\{\s*(\w+)\s*\}\}/u', static function ($m) use ($vars, $raw, $html) {
                $k = $m[1];
                if ($html && array_key_exists($k, $raw)) return $raw[$k];
                $v = (string) ($vars[$k] ?? '');
                return $html ? nl2br(htmlspecialchars($v, ENT_QUOTES, 'UTF-8')) : $v;
            }, $text);
        };
        return ['subject' => $fill($t['subject'], false), 'html' => $this->layout($fill($t['body_html'], true), $vars['jardin'])];
    }

    private static function button(string $url, string $label): string
    {
        $u = htmlspecialchars($url, ENT_QUOTES, 'UTF-8');
        return '<a href="' . $u . '" style="display:inline-block;background:#23206b;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:999px">' . htmlspecialchars($label, ENT_QUOTES, 'UTF-8') . '</a>';
    }

    private function layout(string $inner, string $school): string
    {
        $logo = htmlspecialchars($this->baseUrl . '/images/opt/leon-asomado-160.webp', ENT_QUOTES);
        $s = htmlspecialchars($school, ENT_QUOTES, 'UTF-8');
        return '<!doctype html><html><body style="margin:0;background:#f2f8ff;font-family:Segoe UI,Arial,sans-serif;color:#2a2850">'
            . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">'
            . '<table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden" cellpadding="0" cellspacing="0">'
            . '<tr><td style="background:#23206b;padding:18px 24px;color:#ffffff;font-size:18px;font-weight:bold"><img src="' . $logo . '" width="36" height="36" alt="" style="vertical-align:middle;margin-right:10px">' . $s . '</td></tr>'
            . '<tr><td style="padding:24px;font-size:15px;line-height:1.6">' . $inner . '</td></tr>'
            . '<tr><td style="padding:14px 24px;background:#fafbff;color:#8a88a8;font-size:12px">Este correo lo envía ' . $s . ' a las familias de sus estudiantes.</td></tr>'
            . '</table></td></tr></table></body></html>';
    }

    // ───────────────────────── queue ─────────────────────────
    /** Queues a templated e-mail. Returns false when it is not sent (disabled template, no address or e-mail off). */
    public function queue(string $template, ?string $toEmail, ?string $toName, array $vars): bool
    {
        if (!$toEmail || !filter_var($toEmail, FILTER_VALIDATE_EMAIL) || !$this->enabled()) return false;
        $msg = $this->render($template, $vars);
        if (!$msg) return false;
        $this->db->insert('email_outbox', ['to_email' => $toEmail, 'to_name' => $toName, 'subject' => mb_substr($msg['subject'], 0, 200), 'body_html' => $msg['html'], 'template_key' => $template]);
        return true;
    }

    /** Sends pending e-mails (cron). Up to 3 attempts each. @return array{sent:int,failed:int} */
    public function flush(int $limit = 30): array
    {
        if (!$this->enabled()) return ['sent' => 0, 'failed' => 0];
        $mailer = $this->mailer();
        $sent = $failed = 0;
        foreach ($this->db->all("SELECT * FROM email_outbox WHERE status = 'pendiente' AND attempts < 3 ORDER BY id LIMIT $limit") as $m) {
            try {
                $mailer->send($m['to_email'], $m['to_name'], $m['subject'], $m['body_html']);
                $this->db->update('email_outbox', ['status' => 'enviado', 'sent_at' => date('Y-m-d H:i:s'), 'attempts' => (int) $m['attempts'] + 1], ['id' => $m['id']]);
                $sent++;
            } catch (\Throwable $e) {
                $attempts = (int) $m['attempts'] + 1;
                $this->db->update('email_outbox', ['attempts' => $attempts, 'last_error' => mb_substr($e->getMessage(), 0, 500), 'status' => $attempts >= 3 ? 'error' : 'pendiente'], ['id' => $m['id']]);
                $failed++;
            }
        }
        return ['sent' => $sent, 'failed' => $failed];
    }
}
