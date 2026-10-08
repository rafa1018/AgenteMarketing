<?php
declare(strict_types=1);

namespace Gabush\Infrastructure\Storage;

use Gabush\Domain\Shared\DomainError;

/**
 * Private files (student photos, enrollment documents, receipts) inside the data folder — outside the
 * web root, served only through authorised API routes.
 */
final class PrivateFiles
{
    private const TYPES = [
        'image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/heic' => 'heic', 'application/pdf' => 'pdf',
    ];

    public function __construct(private readonly string $root)
    {
    }

    public function path(string $relative): string
    {
        $relative = ltrim(str_replace(['..', '\\'], ['', '/'], $relative), '/');
        return $this->root . '/' . $relative;
    }

    public function exists(?string $relative): bool
    {
        return $relative !== null && $relative !== '' && is_file($this->path($relative));
    }

    /**
     * Stores an uploaded file under $folder; images are re-encoded (strips metadata, max $maxSide px).
     * @param array{tmp_name:string,error:int,size:int,name?:string} $upload
     * @param list<string> $allowed mime types
     * @return array{path:string,mime:string,name:string}
     */
    public function storeUpload(array $upload, string $folder, string $baseName, array $allowed, int $maxBytes = 8_000_000, int $maxSide = 1600): array
    {
        if (($upload['error'] ?? 1) === UPLOAD_ERR_INI_SIZE || ($upload['size'] ?? 0) > $maxBytes) {
            throw new DomainError('too_big', 'El archivo es muy pesado (máximo ' . round($maxBytes / 1e6) . ' MB).');
        }
        if (($upload['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file($upload['tmp_name'])) {
            throw new DomainError('upload', 'No se pudo subir el archivo. Intenta de nuevo.');
        }
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($upload['tmp_name']) ?: '';
        if (!in_array($mime, $allowed, true) || !isset(self::TYPES[$mime])) {
            throw new DomainError('type', 'Tipo de archivo no permitido. Sube una foto (JPG/PNG) o un PDF.');
        }
        $dir = $this->path($folder);
        if (!is_dir($dir)) mkdir($dir, 0750, true);
        $ext = self::TYPES[$mime];
        $name = preg_replace('/[^\w.-]/', '_', $baseName) . '-' . bin2hex(random_bytes(4));
        if (in_array($mime, ['image/jpeg', 'image/png', 'image/webp'], true) && function_exists('imagecreatefromstring')) {
            $img = @imagecreatefromstring((string) file_get_contents($upload['tmp_name']));
            if ($img) {
                $w = imagesx($img); $h = imagesy($img);
                $scale = min(1, $maxSide / max($w, $h));
                if ($scale < 1) $img = imagescale($img, (int) round($w * $scale), (int) round($h * $scale), IMG_BICUBIC) ?: $img;
                imagejpeg($img, "$dir/$name.jpg", 84);
                return ['path' => "$folder/$name.jpg", 'mime' => 'image/jpeg', 'name' => (string) ($upload['name'] ?? "$name.jpg")];
            }
        }
        move_uploaded_file($upload['tmp_name'], "$dir/$name.$ext");
        return ['path' => "$folder/$name.$ext", 'mime' => $mime, 'name' => (string) ($upload['name'] ?? "$name.$ext")];
    }

    public function delete(?string $relative): void
    {
        if ($this->exists($relative)) @unlink($this->path($relative));
    }

    public function mime(string $relative): string
    {
        return (new \finfo(FILEINFO_MIME_TYPE))->file($this->path($relative)) ?: 'application/octet-stream';
    }
}
