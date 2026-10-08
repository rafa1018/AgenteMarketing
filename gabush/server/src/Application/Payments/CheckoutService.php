<?php
declare(strict_types=1);

namespace Gabush\Application\Payments;

use Gabush\App;
use Gabush\Application\Billing\BillingService;
use Gabush\Application\Ports\PaymentGateway;
use Gabush\Application\Shared\Actor;
use Gabush\Application\Shared\Audit;
use Gabush\Application\Shared\Settings;
use Gabush\Domain\Shared\DomainError;
use Gabush\Infrastructure\Database\Database;
use Gabush\Infrastructure\Payments\MercadoPagoGateway;
use Gabush\Infrastructure\Payments\WompiGateway;

/**
 * Online payments of the family portal:
 *   start()   → validates the chosen open charges, freezes the amount, creates the checkout and returns the
 *               provider URL (only ONE provider is active, chosen by the rectora).
 *   confirm() → called by the webhook and when the family returns; idempotent — an approved transaction
 *               creates exactly one payment (receipt + cash income + notifications through BillingService).
 */
final class CheckoutService
{
    public function __construct(
        private readonly Database $db,
        private readonly Settings $settings,
        private readonly BillingService $billing,
        private readonly Audit $audit,
        private readonly string $baseUrl,
    ) {
    }

    public static function from(App $app): self
    {
        return $app->service(self::class, static fn(App $a) => new self(
            $a->db(),
            $a->service(Settings::class, static fn(App $x) => new Settings($x->db())),
            BillingService::from($a),
            $a->service(Audit::class, static fn(App $x) => new Audit($x->db())),
            $a->baseUrl(),
        ));
    }

    /** @return array<string,mixed> provider settings with secrets masked (for the panel) */
    public function publicConfig(): array
    {
        $c = (array) $this->settings->get('payments', []);
        $mask = static fn(?string $s) => $s ? substr($s, 0, 8) . '…' . substr($s, -4) : '';
        return [
            'provider' => $c['provider'] ?? null,
            'wompi' => ['publicKey' => $c['wompi']['publicKey'] ?? '', 'hasIntegritySecret' => !empty($c['wompi']['integritySecret']), 'hasEventsSecret' => !empty($c['wompi']['eventsSecret'])],
            'mercadopago' => ['accessToken' => $mask($c['mercadopago']['accessToken'] ?? null), 'hasAccessToken' => !empty($c['mercadopago']['accessToken']), 'hasWebhookSecret' => !empty($c['mercadopago']['webhookSecret'])],
            'webhooks' => ['wompi' => $this->baseUrl . '/api/v2/webhooks/wompi', 'mercadopago' => $this->baseUrl . '/api/v2/webhooks/mercadopago'],
            'testMode' => str_starts_with((string) ($c['wompi']['publicKey'] ?? ''), 'pub_test_') || str_starts_with((string) ($c['mercadopago']['accessToken'] ?? ''), 'TEST-'),
        ];
    }

    /** Secrets are only replaced when a new value is sent. */
    public function saveConfig(?string $provider, array $wompi, array $mp): void
    {
        $c = (array) $this->settings->get('payments', []);
        $c['provider'] = in_array($provider, ['wompi', 'mercadopago'], true) ? $provider : null;
        foreach (['publicKey', 'integritySecret', 'eventsSecret'] as $k) if (($wompi[$k] ?? '') !== '') $c['wompi'][$k] = trim((string) $wompi[$k]);
        foreach (['accessToken', 'webhookSecret'] as $k) if (($mp[$k] ?? '') !== '') $c['mercadopago'][$k] = trim((string) $mp[$k]);
        $this->settings->set('payments', $c);
    }

    public function gateway(?string $name = null): ?PaymentGateway
    {
        $c = (array) $this->settings->get('payments', []);
        $name ??= $c['provider'] ?? null;
        return match ($name) {
            'wompi' => WompiGateway::fromSettings((array) ($c['wompi'] ?? [])),
            'mercadopago' => MercadoPagoGateway::fromSettings((array) ($c['mercadopago'] ?? [])),
            default => null,
        };
    }

    /**
     * @param list<int> $chargeIds
     * @return array{url:string,reference:string,amount:int}
     */
    public function start(int $studentId, array $chargeIds, Actor $actor): array
    {
        $gw = $this->gateway() ?? throw new DomainError('no_gateway', 'El pago en línea aún no está habilitado. Comunícate con el jardín.');
        if (!$chargeIds) throw new DomainError('empty', 'Elige qué quieres pagar.');
        $this->billing->applyLateFees(Actor::system('checkout'));
        $open = [];
        foreach ($this->billing->charges($studentId, null, true) as $c) $open[$c['id']] = $c;
        $amount = 0;
        $items = [];
        foreach ($chargeIds as $id) {
            $c = $open[$id] ?? throw new DomainError('charge', 'Uno de los cobros ya no está pendiente. Actualiza la página.');
            if (!$c['onlinePayable']) throw new DomainError('not_online', "«{$c['description']}» se paga directamente en el jardín.");
            $amount += $c['balance'];
            $items[] = ['id' => $id, 'balance' => $c['balance'], 'description' => $c['description']];
        }
        if ($amount < 1500) throw new DomainError('min', 'El valor mínimo para pagar en línea es $ 1.500.');
        $student = $this->db->one(
            "SELECT s.code, s.first_name, s.last_name, g.full_name, g.email FROM students s
             LEFT JOIN guardians g ON g.family_id = s.family_id AND g.id = (SELECT id FROM guardians WHERE family_id = s.family_id ORDER BY is_billing DESC, is_primary DESC, id LIMIT 1)
             WHERE s.id = ?",
            [$studentId],
        );
        $reference = 'GB' . $studentId . '-' . date('ymdHis') . '-' . strtoupper(bin2hex(random_bytes(3)));
        $checkoutId = $this->db->insert('checkouts', ['reference' => $reference, 'provider' => $gw->name(), 'student_id' => $studentId, 'amount' => $amount, 'charge_ids' => $items, 'status' => 'creado', 'created_by' => $actor->id]);
        $desc = count($items) === 1 ? $items[0]['description'] : count($items) . ' cobros · ' . $student['code'];
        try {
            $r = $gw->createCheckout([
                'reference' => $reference, 'amount' => $amount, 'description' => 'Jardín Gabush · ' . $desc,
                'email' => $student['email'] ?? null, 'name' => $student['full_name'] ?? null,
                // no #fragment: gateways append ?id= / &payment_id= to this URL; the portal opens Pagos when it sees ?pago=
                'returnUrl' => $this->baseUrl . '/familia/?pago=' . rawurlencode($reference),
                'webhookUrl' => $this->baseUrl . '/api/v2/webhooks/' . $gw->name(),
            ]);
        } catch (\Throwable $e) {
            $this->db->update('checkouts', ['status' => 'error', 'last_event' => ['error' => $e->getMessage()]], ['id' => $checkoutId]);
            throw new DomainError('gateway', 'No pudimos abrir la pasarela de pagos. Intenta de nuevo en unos minutos.');
        }
        $this->db->update('checkouts', ['status' => 'pendiente', 'checkout_url' => mb_substr($r['url'], 0, 500), 'provider_tx_id' => $r['providerId']], ['id' => $checkoutId]);
        $this->audit->log($actor, 'checkout.start', 'checkout', $checkoutId, ['amount' => $amount, 'provider' => $gw->name()]);
        return ['url' => $r['url'], 'reference' => $reference, 'amount' => $amount];
    }

    /**
     * Applies a provider result. Safe to call many times (webhook retries + return page).
     * @param array{reference:string,status:string,txId:string,amount:int,raw?:string} $result
     * @return array<string,mixed> checkout state
     */
    public function confirm(array $result, string $provider): array
    {
        return $this->db->transaction(function () use ($result, $provider): array {
            $co = $this->db->one('SELECT * FROM checkouts WHERE reference = ? FOR UPDATE', [$result['reference']]);
            if (!$co) throw new DomainError('unknown', 'Referencia de pago desconocida.');
            $this->db->update('checkouts', ['provider_status' => $result['raw'] ?? $result['status'], 'provider_tx_id' => $result['txId'] ?: $co['provider_tx_id'], 'last_event' => $result], ['id' => $co['id']]);
            if ($co['status'] === 'aprobado' || $co['payment_id']) return $this->state((int) $co['id']); // already applied
            if ($result['status'] === 'aprobado') {
                if ($result['amount'] !== (int) $co['amount']) {
                    $this->db->update('checkouts', ['status' => 'error'], ['id' => $co['id']]);
                    $this->audit->log(Actor::gateway($provider), 'checkout.amount_mismatch', 'checkout', (int) $co['id'], ['expected' => (int) $co['amount'], 'got' => $result['amount']]);
                    return $this->state((int) $co['id']);
                }
                $chargeIds = array_map(static fn($i) => (int) $i['id'], (array) json_decode((string) $co['charge_ids'], true));
                $open = array_column($this->billing->charges((int) $co['student_id'], null, true), 'id');
                $chargeIds = array_values(array_intersect($chargeIds, $open)); // something paid meanwhile at the school → the rest stays as credit
                $paymentId = $this->billing->registerPayment(
                    (int) $co['student_id'], (int) $co['amount'], date('Y-m-d'), $provider, ucfirst($provider) . ' ' . $result['txId'], null,
                    $chargeIds ?: null, Actor::gateway($provider), 'en_linea', (int) $co['id'],
                );
                $this->db->update('checkouts', ['status' => 'aprobado', 'payment_id' => $paymentId], ['id' => $co['id']]);
            } elseif ($result['status'] === 'rechazado') {
                $this->db->update('checkouts', ['status' => 'rechazado'], ['id' => $co['id']]);
            }
            return $this->state((int) $co['id']);
        });
    }

    /** When the family returns from the checkout: ask the provider (the webhook may arrive later). */
    /** $txId: what the provider appended to the return URL (Wompi ?id=, Mercado Pago ?payment_id=). */
    public function refresh(string $reference, int $studentId, ?string $txId = null): array
    {
        $co = $this->db->one('SELECT * FROM checkouts WHERE reference = ? AND student_id = ?', [$reference, $studentId]) ?? throw new DomainError('unknown', 'Pago no encontrado.');
        if (in_array($co['status'], ['pendiente', 'creado'], true) && ($gw = $this->gateway($co['provider']))) {
            $txId = (string) ($txId ?: ($co['provider_tx_id'] ?? ''));
            $r = $txId !== '' && !str_contains($txId, '-') ? $gw->fetch($txId) : null; // MP preference ids contain "-": not a payment id
            if ($r && $r['reference'] === $reference) return $this->confirm($r, $co['provider']);
        }
        return $this->state((int) $co['id']);
    }

    /** @return array<string,mixed> */
    public function state(int $checkoutId): array
    {
        $c = $this->db->one('SELECT reference, provider, amount, status, payment_id, created_at FROM checkouts WHERE id = ?', [$checkoutId]);
        return ['reference' => $c['reference'], 'provider' => $c['provider'], 'amount' => (int) $c['amount'], 'status' => $c['status'], 'paymentId' => $c['payment_id'] ? (int) $c['payment_id'] : null, 'createdAt' => $c['created_at']];
    }
}
