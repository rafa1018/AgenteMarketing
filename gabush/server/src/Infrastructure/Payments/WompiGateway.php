<?php
declare(strict_types=1);

namespace Gabush\Infrastructure\Payments;

use Gabush\Application\Ports\PaymentGateway;

/**
 * Wompi (Bancolombia) — Web Checkout by redirect with integrity signature; webhook "transaction.updated"
 * validated with the events secret (checksum = SHA256(values of signature.properties + timestamp + secret)).
 * Test keys (pub_test_…) use the sandbox automatically.
 */
final class WompiGateway implements PaymentGateway
{
    public function __construct(
        private readonly string $publicKey,
        private readonly string $integritySecret,
        private readonly string $eventsSecret,
    ) {
    }

    /** @param array<string,mixed> $c */
    public static function fromSettings(array $c): self
    {
        return new self(trim((string) ($c['publicKey'] ?? '')), trim((string) ($c['integritySecret'] ?? '')), trim((string) ($c['eventsSecret'] ?? '')));
    }

    public function name(): string
    {
        return 'wompi';
    }

    private function api(): string
    {
        return str_starts_with($this->publicKey, 'pub_test_') ? 'https://sandbox.wompi.co/v1' : 'https://production.wompi.co/v1';
    }

    public function createCheckout(array $checkout): array
    {
        if ($this->publicKey === '' || $this->integritySecret === '') throw new \RuntimeException('Wompi no está configurado (llave pública y secreto de integridad).');
        $cents = $checkout['amount'] * 100;
        $signature = hash('sha256', $checkout['reference'] . $cents . 'COP' . $this->integritySecret);
        $params = [
            'public-key' => $this->publicKey,
            'currency' => 'COP',
            'amount-in-cents' => (string) $cents,
            'reference' => $checkout['reference'],
            'signature:integrity' => $signature,
            'redirect-url' => $checkout['returnUrl'],
        ];
        if ($checkout['email']) $params['customer-data:email'] = $checkout['email'];
        if ($checkout['name']) $params['customer-data:full-name'] = $checkout['name'];
        return ['url' => 'https://checkout.wompi.co/p/?' . http_build_query($params), 'providerId' => null];
    }

    public function parseWebhook(string $body, array $headers, array $query): ?array
    {
        $e = json_decode($body, true);
        if (!is_array($e) || ($e['event'] ?? '') !== 'transaction.updated') return null;
        $props = (array) ($e['signature']['properties'] ?? []);
        $concat = '';
        foreach ($props as $path) {
            $node = $e['data'] ?? [];
            foreach (explode('.', (string) $path) as $k) $node = is_array($node) ? ($node[$k] ?? '') : '';
            $concat .= is_scalar($node) ? (string) $node : '';
        }
        $expected = hash('sha256', $concat . ($e['timestamp'] ?? '') . $this->eventsSecret);
        $sent = strtolower((string) ($e['signature']['checksum'] ?? ($headers['x-event-checksum'] ?? '')));
        if ($this->eventsSecret === '' || !hash_equals($expected, $sent)) throw new \RuntimeException('Firma de Wompi inválida');
        return self::normalise((array) ($e['data']['transaction'] ?? []));
    }

    public function fetch(string $txId): ?array
    {
        $r = Http::json('GET', $this->api() . '/transactions/' . rawurlencode($txId));
        $t = $r['body']['data'] ?? null;
        return is_array($t) ? self::normalise($t) : null;
    }

    /** @param array<string,mixed> $t */
    private static function normalise(array $t): array
    {
        $status = match ((string) ($t['status'] ?? '')) {
            'APPROVED' => 'aprobado',
            'DECLINED', 'VOIDED', 'ERROR' => 'rechazado',
            default => 'pendiente',
        };
        return ['reference' => (string) ($t['reference'] ?? ''), 'status' => $status, 'txId' => (string) ($t['id'] ?? ''), 'amount' => intdiv((int) ($t['amount_in_cents'] ?? 0), 100), 'raw' => (string) ($t['status'] ?? '')];
    }
}
