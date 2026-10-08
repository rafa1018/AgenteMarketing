<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Application\Payments\CheckoutService;
use Gabush\Application\Shared\Actor;
use Gabush\Http\Request;
use Gabush\Http\Response;
use Gabush\Http\Router;

/**
 * Payment provider notifications. Always answers 200 for well-signed calls (even when ignored) so the
 * provider stops retrying; 401 for bad signatures; everything is audited.
 */
final class WebhookController extends Controller
{
    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('POST', '/webhooks/wompi', static fn(Request $q) => $c->handle($q, 'wompi'));
        $r->add('POST', '/webhooks/mercadopago', static fn(Request $q) => $c->handle($q, 'mercadopago'));
    }

    public function handle(Request $req, string $provider): Response
    {
        $svc = CheckoutService::from($this->app);
        $gw = $svc->gateway($provider);
        if (!$gw) return Response::json(['ok' => true, 'ignored' => 'provider not configured']);
        try {
            $result = $gw->parseWebhook($req->rawBody(), $req->headers, $req->query);
        } catch (\Throwable $e) {
            $this->audit()->log(Actor::gateway($provider), 'webhook.rejected', 'checkout', null, ['error' => $e->getMessage()]);
            return Response::json(['ok' => false, 'error' => 'signature'], 401);
        }
        if (!$result || $result['reference'] === '') return Response::json(['ok' => true, 'ignored' => true]);
        try {
            $state = $svc->confirm($result, $provider);
            $this->audit()->log(Actor::gateway($provider), 'webhook.' . $result['status'], 'checkout', $result['reference'], ['tx' => $result['txId'], 'amount' => $result['amount']]);
            return Response::json(['ok' => true, 'status' => $state['status']]);
        } catch (\Throwable $e) {
            error_log('[gabush webhook] ' . $e->getMessage());
            return Response::json(['ok' => false, 'error' => 'unknown_reference'], 200); // do not make the provider retry forever
        }
    }
}
