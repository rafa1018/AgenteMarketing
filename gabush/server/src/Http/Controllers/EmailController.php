<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Application\Email\EmailService;
use Gabush\Domain\Shared\DomainError;
use Gabush\Http\Request;
use Gabush\Http\Router;
use Gabush\Http\Validate;

/** E-mail account (SMTP), templates, test message and the sending queue. */
final class EmailController extends Controller
{
    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/email', [$c, 'show']);
        $r->add('PUT', '/email/account', [$c, 'saveAccount']);
        $r->add('PUT', '/email/templates/{key}', [$c, 'saveTemplate']);
        $r->add('POST', '/email/templates/{key}/reset', [$c, 'resetTemplate']);
        $r->add('POST', '/email/test', [$c, 'test']);
        $r->add('POST', '/email/flush', [$c, 'flush']);
    }

    private function email(): EmailService
    {
        return EmailService::from($this->app);
    }

    public function show(Request $req): array
    {
        $this->staff($req, 'ajustes');
        $outbox = $this->db()->all('SELECT id, to_email AS toEmail, subject, template_key AS template, status, attempts, last_error AS lastError, created_at AS createdAt, sent_at AS sentAt FROM email_outbox ORDER BY id DESC LIMIT 50');
        $stats = $this->db()->one("SELECT SUM(status = 'pendiente') AS pending, SUM(status = 'enviado') AS sent, SUM(status = 'error') AS failed FROM email_outbox") ?? [];
        return ['account' => $this->email()->account(), 'templates' => $this->email()->templates(), 'outbox' => self::intsAll($outbox, 'id', 'attempts'), 'stats' => array_map('intval', $stats)];
    }

    /** Presets for the usual providers; the password is never sent back. */
    public function saveAccount(Request $req): array
    {
        $actor = $this->staffWrite($req, 'ajustes');
        $v = Validate::of($req);
        $values = [
            'enabled' => $v->bool('enabled'),
            'host' => $v->str('host', 120) ?? '',
            'port' => $v->int('port', 1, 65535) ?? 587,
            'security' => $v->oneOf('security', ['ssl', 'tls', 'none'], 'tls'),
            'username' => $v->str('username', 160) ?? '',
            'password' => (string) ($req->json()['password'] ?? ''),
            'fromEmail' => $v->email('fromEmail') ?? '',
            'fromName' => $v->str('fromName', 120) ?? 'Jardín Infantil Gabush',
        ];
        if ($values['enabled'] && $values['host'] === '') $v->fail('host', 'Escribe el servidor SMTP.');
        $v->check();
        $account = $this->email()->saveAccount($values);
        $this->audit()->log($actor, 'email.account', 'settings', 'smtp', ['host' => $values['host'], 'user' => $values['username']]);
        return ['account' => $account];
    }

    public function saveTemplate(Request $req): array
    {
        $actor = $this->staffWrite($req, 'ajustes');
        $key = $req->param('key');
        $v = Validate::of($req);
        $subject = $v->str('subject', 200, true, 'El asunto');
        $body = $v->text('body', 20000, true);
        $active = $v->bool('active', true);
        $v->check();
        $this->email()->saveTemplate($key, $subject, $body, $active);
        $this->audit()->log($actor, 'email.template', 'email_template', $key);
        return ['templates' => $this->email()->templates()];
    }

    public function resetTemplate(Request $req): array
    {
        $this->staffWrite($req, 'ajustes');
        $this->email()->resetTemplate($req->param('key'));
        return ['templates' => $this->email()->templates()];
    }

    /** Sends a test message right away (not through the queue) to check the account. */
    public function test(Request $req): array
    {
        $this->staffWrite($req, 'ajustes');
        $v = Validate::of($req);
        $to = $v->email('to', true);
        $template = $v->str('template', 48);
        $v->check();
        $msg = $template ? $this->email()->render($template, ['acudiente' => 'Familia de prueba', 'estudiante' => 'Estudiante de prueba', 'codigo' => 'GAB-0000', 'valor' => '$ 320.000', 'concepto' => 'Pensión de prueba', 'saldo' => '$ 320.000', 'fecha' => date('d/m/Y'), 'comprobante' => 'G-000000', 'asunto' => 'Mensaje de prueba', 'mensaje' => 'Este es un mensaje de prueba.', 'usuario' => 'GAB-0000', 'clave' => '••••••', 'documento' => 'Registro civil', 'nota' => 'Ejemplo', 'enlace' => $this->app->baseUrl() . '/familia/']) : null;
        $msg ??= ['subject' => 'Prueba de correo · Gabush', 'html' => '<p>¡Funciona! Este es un correo de prueba enviado desde el panel de Gabush.</p>'];
        try {
            $this->email()->mailer()->send($to, null, $msg['subject'], $msg['html']);
        } catch (\Throwable $e) {
            throw new DomainError('smtp', 'No se pudo enviar: ' . $e->getMessage());
        }
        return ['sent' => true];
    }

    public function flush(Request $req): array
    {
        $this->staffWrite($req, 'ajustes');
        return $this->email()->flush(50);
    }
}
