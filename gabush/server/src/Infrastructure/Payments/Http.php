<?php
declare(strict_types=1);

namespace Gabush\Infrastructure\Payments;

/** Small JSON-over-HTTPS client for the payment providers. */
final class Http
{
    /** @param array<string,string> $headers @return array{status:int,body:array<string,mixed>|null} */
    public static function json(string $method, string $url, ?array $payload = null, array $headers = []): array
    {
        $ch = curl_init($url);
        $h = ['Accept: application/json'];
        foreach ($headers as $k => $v) $h[] = "$k: $v";
        if ($payload !== null) $h[] = 'Content-Type: application/json';
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_HTTPHEADER => $h,
            CURLOPT_POSTFIELDS => $payload !== null ? json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
        ]);
        $raw = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($raw === false) throw new \RuntimeException('No se pudo conectar con la pasarela de pagos: ' . $err);
        return ['status' => $status, 'body' => json_decode((string) $raw, true)];
    }
}
