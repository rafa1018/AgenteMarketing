<?php
declare(strict_types=1);

namespace Gabush\Application\Ports;

/**
 * An online payment provider (Wompi, Mercado Pago). The family is redirected to the provider's checkout;
 * the provider confirms through a signed webhook and the result can also be queried on return.
 */
interface PaymentGateway
{
    public function name(): string;

    /**
     * @param array{reference:string,amount:int,description:string,email:?string,name:?string,returnUrl:string,webhookUrl:string} $checkout
     * @return array{url:string,providerId:?string}
     */
    public function createCheckout(array $checkout): array;

    /**
     * Validates and normalises a webhook call. Returns null when it is not about a payment (or ignorable).
     * Throws when the signature is invalid.
     * @param array<string,string> $headers lower-case names
     * @param array<string,mixed> $query
     * @return array{reference:string,status:string,txId:string,amount:int}|null status: aprobado|rechazado|pendiente
     */
    public function parseWebhook(string $body, array $headers, array $query): ?array;

    /** Current state of a transaction (used when the family comes back from the checkout). @return array{reference:string,status:string,txId:string,amount:int}|null */
    public function fetch(string $txId): ?array;
}
