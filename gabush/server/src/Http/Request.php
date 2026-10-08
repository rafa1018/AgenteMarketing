<?php
declare(strict_types=1);

namespace Gabush\Http;

final class Request
{
    /** @var array<string,string> route parameters ({id}) */
    public array $params = [];
    private ?array $json = null;

    /**
     * @param array<string,mixed> $query
     * @param array<string,mixed> $files
     */
    public function __construct(
        public readonly string $method,
        public readonly string $path,
        public readonly array $query,
        private readonly string $body,
        public readonly array $headers,
        public readonly array $files = [],
        public readonly array $post = [],
    ) {
    }

    public static function fromGlobals(string $prefix): self
    {
        $uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
        $path = '/' . trim(substr($uri, strlen($prefix)), '/');
        $headers = [];
        foreach ($_SERVER as $k => $v) {
            if (str_starts_with($k, 'HTTP_')) $headers[strtolower(str_replace('_', '-', substr($k, 5)))] = (string) $v;
        }
        if (isset($_SERVER['CONTENT_TYPE'])) $headers['content-type'] = (string) $_SERVER['CONTENT_TYPE'];
        $raw = (string) file_get_contents('php://input', false, null, 0, 2_000_000);
        // shared hosting may block PUT/DELETE: the frontend sends POST + X-HTTP-Method-Override
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $override = strtoupper($headers['x-http-method-override'] ?? '');
        if ($method === 'POST' && in_array($override, ['PUT', 'DELETE', 'PATCH'], true)) $method = $override;
        return new self($method, $path, $_GET, $raw, $headers, $_FILES, $_POST);
    }

    public function header(string $name): string
    {
        return $this->headers[strtolower($name)] ?? '';
    }

    public function rawBody(): string
    {
        return $this->body;
    }

    /** JSON body as an array (422 when it is not a JSON object). */
    public function json(): array
    {
        if ($this->json === null) {
            $data = $this->body === '' ? [] : json_decode($this->body, true);
            if (!is_array($data)) throw HttpError::validation([], 'El cuerpo de la petición no es JSON válido.');
            $this->json = $data;
        }
        return $this->json;
    }

    public function input(string $key, mixed $default = null): mixed
    {
        $data = str_contains($this->header('content-type'), 'json') ? $this->json() : $this->post;
        return $data[$key] ?? $default;
    }

    public function query(string $key, mixed $default = null): mixed
    {
        return $this->query[$key] ?? $default;
    }

    public function param(string $key): string
    {
        return $this->params[$key] ?? '';
    }

    public function intParam(string $key): int
    {
        $v = $this->param($key);
        if (!ctype_digit($v)) throw HttpError::notFound();
        return (int) $v;
    }
}
