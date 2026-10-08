<?php
declare(strict_types=1);

namespace Gabush\Infrastructure\Payments;

use Gabush\Application\Ports\PaymentGateway;

/**
 * Mercado Pago — Checkout Pro preference (redirect) with external_reference; webhook "payment" validated
 * with the x-signature header (HMAC-SHA256 of "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" with the
 * webhook secret). The payment is then read from the API with the access token.
 */
final class MercadoPagoGateway implements PaymentGateway
{
    private const API = 'https://api.mercadopago.com';

    public function __construct(private readonly string $accessToken, private readonly string $webhookSecret)
    {
    }

    /** @param array<string,mixed> $c */
    public static function fromSettings(array $c): self
    {
        return new self(trim((string) ($c['accessToken'] ?? '')), trim((string) ($c['webhookSecret'] ?? '')));
    }

    public function name(): string
    {
        return 'mercadopago';
    }

    private function auth(): array
    {
        if ($this->accessToken === '') throw new \RuntimeException('Mercado Pago no está configurado (access token).');
        return ['Authorization' => 'Bearer ' . $this->accessToken];
    }

    public function createCheckout(array $checkout): array
    {
        $payload = [
            'items' => [['id' => $checkout['reference'], 'title' => mb_substr($checkout['description'], 0, 250), 'quantity' => 1, 'currency_id' => 'COP', 'unit_price' => $checkout['amount']]],
            'external_reference' => $checkout['reference'],
            'back_urls' => ['success' => $checkout['returnUrl'], 'failure' => $checkout['returnUrl'], 'pending' => $checkout['returnUrl']],
            'auto_return' => 'approved',
            'notification_url' => $checkout['webhookUrl'],
            'statement_descriptor' => 'JARDIN GABUSH',
            'payment_methods' => ['installments' => 1],
        ];
        if ($checkout['email']) $payload['payer'] = ['email' => $checkout['email'], 'name' => (string) $checkout['name']];
        $r = Http::json('POST', self::API . '/checkout/preferences', $payload, $this->auth() + ['X-Idempotency-Key' => $checkout['reference']]);
        if ($r['status'] >= 300 || empty($r['body']['init_point'])) {
            throw new \RuntimeException('Mercado Pago rechazó la solicitud: ' . ($r['body']['message'] ?? $r['status']));
        }
        $test = str_starts_with($this->accessToken, 'TEST-');
        return ['url' => (string) ($test ? ($r['body']['sandbox_init_point'] ?? $r['body']['init_point']) : $r['body']['init_point']), 'providerId' => (string) ($r['body']['id'] ?? '')];
    }

    public function parseWebhook(string $body, array $headers, array $query): ?array
    {
        $data = json_decode($body, true) ?: [];
        $type = (string) ($query['type'] ?? ($data['type'] ?? ($query['topic'] ?? '')));
        if ($type !== 'payment') return null;
        $id = (string) ($query['data.id'] ?? ($query['data_id'] ?? ($data['data']['id'] ?? '')));
        if ($id === '') return null;
        if ($this->webhookSecret !== '') {
            $parts = [];
            foreach (explode(',', (string) ($headers['x-signature'] ?? '')) as $kv) {
                [$k, $v] = array_map('trim', explode('=', $kv, 2) + [1 => '']);
                $parts[$k] = $v;
            }
            $manifest = 'id:' . strtolower($id) . ';request-id:' . ($headers['x-request-id'] ?? '') . ';ts:' . ($parts['ts'] ?? '') . ';';
            if (!hash_equals(hash_hmac('sha256', $manifest, $this->webhookSecret), (string) ($parts['v1'] ?? ''))) {
                throw new \RuntimeException('Firma de Mercado Pago inválida');
            }
        }
        // the notification only carries the id: the state is always read from the API (source of truth)
        return $this->fetch($id);
    }

    public function fetch(string $txId): ?array
    {
        $r = Http::json('GET', self::API . '/v1/payments/' . rawurlencode($txId), null, $this->auth());
        $p = $r['body'];
        if ($r['status'] >= 300 || !is_array($p) || !isset($p['status'])) return null;
        $status = match ((string) $p['status']) {
            'approved' => 'aprobado',
            'rejected', 'cancelled', 'refunded', 'charged_back' => 'rechazado',
            default => 'pendiente',
        };
        return ['reference' => (string) ($p['external_reference'] ?? ''), 'status' => $status, 'txId' => (string) $p['id'], 'amount' => (int) round((float) ($p['transaction_amount'] ?? 0)), 'raw' => (string) $p['status']];
    }
}
