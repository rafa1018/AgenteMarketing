<?php
declare(strict_types=1);

namespace Gabush\Infrastructure\Mail;

use Gabush\Application\Ports\Mailer;

/**
 * Minimal SMTP client (no Composer): SSL (465) or STARTTLS (587), AUTH LOGIN, UTF-8 HTML messages with a
 * plain-text alternative. Works with Gmail (app password), Hostinger mail, Outlook, etc.
 */
final class SmtpMailer implements Mailer
{
    /** @var resource|null */
    private $socket = null;

    public function __construct(
        private readonly string $host,
        private readonly int $port,
        private readonly string $security,   // ssl | tls | none
        private readonly string $username,
        private readonly string $password,
        private readonly string $fromEmail,
        private readonly string $fromName,
        private readonly int $timeout = 15,
    ) {
    }

    /** @param array<string,mixed> $s settings "smtp" */
    public static function fromSettings(array $s): self
    {
        return new self((string) ($s['host'] ?? ''), (int) ($s['port'] ?? 587), (string) ($s['security'] ?? 'tls'), (string) ($s['username'] ?? ''), (string) ($s['password'] ?? ''), (string) ($s['fromEmail'] ?? ($s['username'] ?? '')), (string) ($s['fromName'] ?? 'Jardín Infantil Gabush'));
    }

    public function send(string $toEmail, ?string $toName, string $subject, string $html): void
    {
        if ($this->host === '' || $this->fromEmail === '') throw new \RuntimeException('El correo de envío no está configurado.');
        try {
            $this->connect();
            $this->cmd('MAIL FROM:<' . $this->fromEmail . '>', [250]);
            $this->cmd('RCPT TO:<' . $toEmail . '>', [250, 251]);
            $this->cmd('DATA', [354]);
            $this->write($this->message($toEmail, $toName, $subject, $html) . "\r\n.");
            $this->expect([250]);
            $this->cmd('QUIT', [221]);
        } finally {
            if (is_resource($this->socket)) fclose($this->socket);
            $this->socket = null;
        }
    }

    private function connect(): void
    {
        $target = ($this->security === 'ssl' ? 'ssl://' : 'tcp://') . $this->host . ':' . $this->port;
        $ctx = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true, 'peer_name' => $this->host]]);
        $this->socket = @stream_socket_client($target, $errno, $errstr, $this->timeout, STREAM_CLIENT_CONNECT, $ctx);
        if (!$this->socket) throw new \RuntimeException("No se pudo conectar a $this->host:$this->port ($errstr)");
        stream_set_timeout($this->socket, $this->timeout);
        $this->expect([220]);
        $ehlo = 'EHLO ' . (gethostname() ?: 'gabushkids.com');
        $this->cmd($ehlo, [250]);
        if ($this->security === 'tls') {
            $this->cmd('STARTTLS', [220]);
            if (!stream_socket_enable_crypto($this->socket, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) {
                throw new \RuntimeException('No se pudo iniciar TLS con el servidor de correo.');
            }
            $this->cmd($ehlo, [250]);
        }
        if ($this->username !== '') {
            $this->cmd('AUTH LOGIN', [334]);
            $this->cmd(base64_encode($this->username), [334]);
            $this->cmd(base64_encode($this->password), [235], 'Usuario o contraseña del correo incorrectos.');
        }
    }

    private function message(string $to, ?string $toName, string $subject, string $html): string
    {
        $boundary = 'gb' . bin2hex(random_bytes(8));
        $enc = static fn(string $s) => '=?UTF-8?B?' . base64_encode($s) . '?=';
        $text = trim(html_entity_decode(strip_tags(preg_replace('#<(br|/p|/div|/h\d|/tr)>#i', "\n", $html)), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $domain = substr(strrchr($this->fromEmail, '@') ?: '@gabushkids.com', 1);
        $headers = [
            'Date: ' . date('r'),
            'From: ' . $enc($this->fromName) . ' <' . $this->fromEmail . '>',
            'To: ' . ($toName ? $enc($toName) . ' ' : '') . '<' . $to . '>',
            'Subject: ' . $enc($subject),
            'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . $domain . '>',
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
        ];
        $body = "--$boundary\r\nContent-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($text))
            . "--$boundary\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" . chunk_split(base64_encode($html))
            . "--$boundary--";
        return implode("\r\n", $headers) . "\r\n\r\n" . $body;
    }

    private function cmd(string $line, array $codes, string $error = ''): string
    {
        $this->write($line);
        return $this->expect($codes, $error);
    }

    private function write(string $line): void
    {
        fwrite($this->socket, $line . "\r\n");
    }

    private function expect(array $codes, string $error = ''): string
    {
        $resp = '';
        while (($line = fgets($this->socket, 1024)) !== false) {
            $resp .= $line;
            if (strlen($line) < 4 || $line[3] === ' ') break;
        }
        $code = (int) substr($resp, 0, 3);
        if (!in_array($code, $codes, true)) {
            throw new \RuntimeException($error ?: 'El servidor de correo respondió: ' . trim($resp));
        }
        return $resp;
    }
}
