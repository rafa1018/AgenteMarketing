<?php
declare(strict_types=1);

namespace Gabush\Http;

/**
 * Minimal router: routes are "METHOD /path/{param}" → handler(Request): mixed.
 * Handlers return an array (sent as { ok:true, ...array }) or a Response for files / HTML / redirects.
 */
final class Router
{
    /** @var list<array{string,string,callable,list<string>}> */
    private array $routes = [];

    /** @param list<string> $guards names of guards to run before the handler (e.g. "staff:pagos") */
    public function add(string $method, string $pattern, callable $handler, array $guards = []): void
    {
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', rtrim($pattern, '/') ?: '/') . '$#';
        $this->routes[] = [$method, $regex, $handler, $guards];
    }

    /** @return array{callable,list<string>,array<string,string>} */
    public function match(string $method, string $path): array
    {
        $allowed = false;
        foreach ($this->routes as [$m, $regex, $handler, $guards]) {
            if (!preg_match($regex, rtrim($path, '/') ?: '/', $mm)) continue;
            $allowed = true;
            if ($m !== $method) continue;
            return [$handler, $guards, array_filter($mm, 'is_string', ARRAY_FILTER_USE_KEY)];
        }
        throw new HttpError($allowed ? 405 : 404, $allowed ? 'method' : 'not_found');
    }
}
