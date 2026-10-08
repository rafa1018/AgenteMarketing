<?php
declare(strict_types=1);

namespace Gabush\Http;

/** An error that becomes a JSON response: { ok:false, error, message?, fields? }. */
final class HttpError extends \RuntimeException
{
    /** @param array<string,string> $fields */
    public function __construct(public readonly int $status, public readonly string $error, string $message = '', public readonly array $fields = [])
    {
        parent::__construct($message !== '' ? $message : $error);
    }

    public static function notFound(string $what = 'not_found'): self { return new self(404, $what); }
    public static function forbidden(): self { return new self(403, 'forbidden'); }
    public static function unauthorized(): self { return new self(401, 'unauthorized'); }
    /** @param array<string,string> $fields */
    public static function validation(array $fields, string $message = ''): self { return new self(422, 'validation', $message, $fields); }
    public static function conflict(string $error, string $message = ''): self { return new self(409, $error, $message); }
}
