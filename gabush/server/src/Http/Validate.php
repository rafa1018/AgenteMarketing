<?php
declare(strict_types=1);

namespace Gabush\Http;

/**
 * Input validation for request bodies. Collects every problem and throws one 422 with all the fields,
 * so the form can mark them at once. Messages are in Spanish (shown to the rectora / families).
 */
final class Validate
{
    /** @var array<string,string> */
    private array $errors = [];

    /** @param array<string,mixed> $data */
    public function __construct(private readonly array $data)
    {
    }

    public static function of(Request $req): self
    {
        return new self($req->json());
    }

    public function has(string $k): bool
    {
        return array_key_exists($k, $this->data);
    }

    public function str(string $k, int $max = 200, bool $required = false, string $label = ''): ?string
    {
        $v = $this->data[$k] ?? null;
        $v = is_scalar($v) ? trim(preg_replace('/\s+/u', ' ', (string) $v)) : '';
        if ($v === '') {
            if ($required) $this->errors[$k] = ($label ?: 'Este campo') . ' es obligatorio.';
            return null;
        }
        if (mb_strlen($v) > $max) $this->errors[$k] = "Máximo $max caracteres.";
        return mb_substr($v, 0, $max);
    }

    /** Multi-line text (keeps line breaks). */
    public function text(string $k, int $max = 5000, bool $required = false): ?string
    {
        $v = $this->data[$k] ?? null;
        $v = is_scalar($v) ? trim(str_replace("\r", '', (string) $v)) : '';
        if ($v === '') {
            if ($required) $this->errors[$k] = 'Este campo es obligatorio.';
            return null;
        }
        return mb_substr($v, 0, $max);
    }

    public function int(string $k, ?int $min = null, ?int $max = null, bool $required = false): ?int
    {
        $v = $this->data[$k] ?? null;
        if ($v === null || $v === '') {
            if ($required) $this->errors[$k] = 'Este campo es obligatorio.';
            return null;
        }
        if (!is_numeric($v) || (int) $v != $v) { $this->errors[$k] = 'Debe ser un número entero.'; return null; }
        $v = (int) $v;
        if ($min !== null && $v < $min) $this->errors[$k] = "Mínimo $min.";
        if ($max !== null && $v > $max) $this->errors[$k] = "Máximo $max.";
        return $v;
    }

    /** Money in whole pesos ("320.000", "$ 320000", 320000). */
    public function money(string $k, bool $required = false, bool $allowZero = false): ?int
    {
        $v = $this->data[$k] ?? null;
        if ($v === null || $v === '') {
            if ($required) $this->errors[$k] = 'Escribe el valor.';
            return null;
        }
        $n = is_int($v) ? $v : (int) preg_replace('/\D/', '', (string) $v);
        if ($n < 0 || (!$allowZero && $n === 0)) $this->errors[$k] = 'El valor debe ser mayor que cero.';
        return $n;
    }

    public function decimal(string $k, float $min, float $max): ?float
    {
        $v = $this->data[$k] ?? null;
        if ($v === null || $v === '') return null;
        $v = str_replace(',', '.', (string) $v);
        if (!is_numeric($v)) { $this->errors[$k] = 'Debe ser un número.'; return null; }
        $f = (float) $v;
        if ($f < $min || $f > $max) $this->errors[$k] = "Entre $min y $max.";
        return round($f, 1);
    }

    public function bool(string $k, bool $default = false): bool
    {
        $v = $this->data[$k] ?? $default;
        return filter_var($v, FILTER_VALIDATE_BOOLEAN);
    }

    public function date(string $k, bool $required = false): ?string
    {
        $v = trim((string) ($this->data[$k] ?? ''));
        if ($v === '') {
            if ($required) $this->errors[$k] = 'Elige una fecha.';
            return null;
        }
        $d = \DateTimeImmutable::createFromFormat('!Y-m-d', $v);
        if (!$d || $d->format('Y-m-d') !== $v) { $this->errors[$k] = 'Fecha inválida.'; return null; }
        return $v;
    }

    /** @param list<string> $options */
    public function oneOf(string $k, array $options, ?string $default = null, bool $required = false): ?string
    {
        $v = $this->data[$k] ?? $default;
        if ($v === null || $v === '') {
            if ($required) $this->errors[$k] = 'Elige una opción.';
            return $default;
        }
        if (!in_array($v, $options, true)) { $this->errors[$k] = 'Opción inválida.'; return $default; }
        return $v;
    }

    public function email(string $k, bool $required = false): ?string
    {
        $v = $this->str($k, 160, $required);
        if ($v !== null && !filter_var($v, FILTER_VALIDATE_EMAIL)) $this->errors[$k] = 'Correo inválido.';
        return $v !== null ? mb_strtolower($v) : null;
    }

    /** @return list<int> */
    public function ids(string $k): array
    {
        $v = $this->data[$k] ?? [];
        if (!is_array($v)) { $this->errors[$k] = 'Lista inválida.'; return []; }
        return array_values(array_unique(array_map('intval', array_filter($v, 'is_numeric'))));
    }

    /** @return array<mixed> */
    public function arr(string $k): array
    {
        $v = $this->data[$k] ?? [];
        return is_array($v) ? $v : [];
    }

    public function fail(string $k, string $message): void
    {
        $this->errors[$k] = $message;
    }

    /** Throws 422 with every error collected so far. */
    public function check(): void
    {
        if ($this->errors) throw HttpError::validation($this->errors, 'Revisa los campos marcados.');
    }
}
