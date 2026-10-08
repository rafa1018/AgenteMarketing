<?php
declare(strict_types=1);

namespace Gabush\Http;

/** Non-JSON responses: files, HTML (receipts), redirects. JSON is the default for arrays. */
final class Response
{
    /** @param array<string,string> $headers */
    private function __construct(public readonly int $status, public readonly array $headers, public readonly string $body, public readonly ?string $file = null)
    {
    }

    public static function html(string $html, int $status = 200): self
    {
        return new self($status, ['Content-Type' => 'text/html; charset=utf-8'], $html);
    }

    public static function file(string $path, string $mime, ?string $downloadName = null, int $maxAge = 0): self
    {
        $h = ['Content-Type' => $mime, 'Content-Length' => (string) filesize($path), 'Cache-Control' => $maxAge ? "private, max-age=$maxAge" : 'no-store'];
        if ($downloadName !== null) $h['Content-Disposition'] = 'inline; filename="' . addcslashes($downloadName, '"\\') . '"';
        return new self(200, $h, '', $path);
    }

    /**
     * Spreadsheet download that Excel (es-CO) opens directly: UTF-8 with BOM, ";" separator.
     * @param list<string> $head
     * @param iterable<list<string|int|float|null>> $rows
     */
    public static function csv(string $downloadName, array $head, iterable $rows): self
    {
        $cell = static function ($v): string {
            $s = (string) ($v ?? '');
            // a cell that starts like a formula is neutralized (CSV injection)
            if ($s !== '' && in_array($s[0], ['=', '+', '-', '@'], true) && !is_numeric($s)) $s = "'" . $s;
            return '"' . str_replace('"', '""', $s) . '"';
        };
        $out = "\xEF\xBB\xBF" . implode(';', array_map($cell, $head)) . "\r\n";
        foreach ($rows as $r) $out .= implode(';', array_map($cell, $r)) . "\r\n";
        return new self(200, ['Content-Type' => 'text/csv; charset=utf-8', 'Content-Disposition' => 'attachment; filename="' . addcslashes($downloadName, '"\\') . '"', 'Cache-Control' => 'no-store'], $out);
    }

    public static function redirect(string $url): self
    {
        return new self(302, ['Location' => $url], '');
    }

    /** @param array<string,mixed> $data */
    public static function json(array $data, int $status = 200): self
    {
        return new self($status, ['Content-Type' => 'application/json; charset=utf-8'], json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    public function send(): void
    {
        http_response_code($this->status);
        header_remove('Content-Type');
        foreach ($this->headers as $k => $v) header("$k: $v");
        if ($this->file !== null) {
            readfile($this->file);
            return;
        }
        echo $this->body;
    }
}
