<?php
declare(strict_types=1);

namespace Gabush\Application\Ports;

/** Sends one e-mail now (the outbox decides when). Throws on failure. */
interface Mailer
{
    public function send(string $toEmail, ?string $toName, string $subject, string $html): void;
}
