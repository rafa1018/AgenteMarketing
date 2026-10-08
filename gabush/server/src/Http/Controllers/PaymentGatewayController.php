<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Application\Payments\CheckoutService;
use Gabush\Http\Request;
use Gabush\Http\Router;
use Gabush\Http\Validate;

/** The rectora chooses ONE payment provider (Wompi or Mercado Pago) and enters its keys. */
final class PaymentGatewayController extends Controller
{
    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/payment-gateway', [$c, 'show']);
        $r->add('PUT', '/payment-gateway', [$c, 'save']);
    }

    public function show(Request $req): array
    {
        $this->staff($req, 'ajustes');
        $recent = $this->db()->all('SELECT c.id, c.reference, c.provider, c.amount, c.status, c.provider_status AS providerStatus, c.created_at AS createdAt, s.code, s.first_name AS firstName, s.last_name AS lastName FROM checkouts c JOIN students s ON s.id = c.student_id ORDER BY c.id DESC LIMIT 30');
        return ['config' => CheckoutService::from($this->app)->publicConfig(), 'recent' => self::intsAll($recent, 'id', 'amount')];
    }

    public function save(Request $req): array
    {
        $actor = $this->staffWrite($req, 'ajustes');
        $v = Validate::of($req);
        $provider = $v->oneOf('provider', ['wompi', 'mercadopago', 'none'], 'none');
        $wompi = $v->arr('wompi');
        $mp = $v->arr('mercadopago');
        if (($wompi['publicKey'] ?? '') !== '' && !preg_match('/^pub_(test|prod)_\w+$/', (string) $wompi['publicKey'])) $v->fail('wompi.publicKey', 'La llave pública de Wompi empieza por pub_test_ o pub_prod_.');
        if (($mp['accessToken'] ?? '') !== '' && !preg_match('/^(TEST|APP_USR)-/', (string) $mp['accessToken'])) $v->fail('mercadopago.accessToken', 'El access token de Mercado Pago empieza por TEST- o APP_USR-.');
        $v->check();
        $svc = CheckoutService::from($this->app);
        $svc->saveConfig($provider === 'none' ? null : $provider, $wompi, $mp);
        $this->audit()->log($actor, 'payments.config', 'settings', 'payments', ['provider' => $provider]);
        return ['config' => $svc->publicConfig()];
    }
}
