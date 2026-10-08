<?php
declare(strict_types=1);

namespace Gabush\Application\Billing;

use Gabush\App;
use Gabush\Application\Shared\Settings;
use Gabush\Domain\Shared\DomainError;
use Gabush\Infrastructure\Storage\PrivateFiles;

/**
 * The authorized signature printed on payment receipts and on the "paz y salvo" (only when the student is up
 * to date). Kept as a private PNG; documents embed it inline, so there is no public URL to copy it from.
 */
final class Signature
{
    private const KEY = 'signature';

    public function __construct(private readonly Settings $settings, private readonly PrivateFiles $files)
    {
    }

    public static function from(App $app): self
    {
        return $app->service(self::class, static fn(App $a) => new self(
            $a->service(Settings::class, static fn(App $x) => new Settings($x->db())),
            $a->service(PrivateFiles::class, static fn(App $x) => new PrivateFiles($x->dataDir())),
        ));
    }

    /** @return array{image:?string,name:string,title:string,updatedAt:?string} image = data: URI (null when none) */
    public function get(): array
    {
        $s = (array) $this->settings->get(self::KEY, []);
        $image = null;
        if (!empty($s['path']) && $this->files->exists($s['path'])) {
            $image = 'data:image/png;base64,' . base64_encode((string) file_get_contents($this->files->path($s['path'])));
        }
        return ['image' => $image, 'name' => (string) ($s['name'] ?? ''), 'title' => (string) ($s['title'] ?? 'Firma autorizada Cartera'), 'updatedAt' => $s['updatedAt'] ?? null];
    }

    /**
     * New signature image (PNG/JPG/WEBP, max 3 MB). $cleanBackground turns the paper's white/grey background
     * transparent, so a phone photo of a signature on paper looks clean on the documents.
     * @param array<string,mixed>|null $upload $_FILES entry, or null to only change name / title
     */
    public function save(?array $upload, string $name, string $title, bool $cleanBackground): array
    {
        $s = (array) $this->settings->get(self::KEY, []);
        if ($upload) {
            $path = self::storeImage($this->files, $upload, $cleanBackground, 'signature/firma');
            if (!empty($s['path']) && $s['path'] !== $path) $this->files->delete($s['path']);
            $s['path'] = $path;
        }
        if (empty($s['path'])) throw new DomainError('no_image', 'Sube primero la imagen de la firma.');
        $s['name'] = mb_substr(trim($name), 0, 120);
        $s['title'] = mb_substr(trim($title), 0, 80) ?: 'Firma autorizada Cartera';
        $s['updatedAt'] = date('Y-m-d H:i:s');
        $this->settings->set(self::KEY, $s);
        return $this->get();
    }

    /**
     * Validates an uploaded signature image, cleans it (transparent paper, cropped) and stores it as a private
     * PNG under "$prefix-<random>.png". Also used for the teachers' signatures. @return string relative path
     */
    public static function storeImage(PrivateFiles $files, array $upload, bool $cleanBackground, string $prefix): string
    {
        if (($upload['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file((string) $upload['tmp_name'])) throw new DomainError('upload', 'No se pudo subir la imagen. Intenta de nuevo.');
        if (($upload['size'] ?? 0) > 3_000_000) throw new DomainError('too_big', 'La imagen es muy pesada (máximo 3 MB).');
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($upload['tmp_name']) ?: '';
        if (!in_array($mime, ['image/png', 'image/jpeg', 'image/webp'], true)) throw new DomainError('type', 'Sube la firma como imagen PNG o JPG.');
        if (!function_exists('imagecreatefromstring')) throw new DomainError('gd', 'El servidor no puede procesar imágenes.');
        $img = @imagecreatefromstring((string) file_get_contents($upload['tmp_name'])) ?: throw new DomainError('image', 'No se pudo leer la imagen.');
        $img = self::prepare($img, $cleanBackground);
        $dir = $files->path(dirname($prefix));
        if (!is_dir($dir)) mkdir($dir, 0750, true);
        $path = $prefix . '-' . bin2hex(random_bytes(4)) . '.png';
        imagepng($img, $files->path($path), 6);
        return $path;
    }

    /** A stored PNG as a data: URI (null when missing). */
    public static function dataUri(PrivateFiles $files, ?string $path): ?string
    {
        return $path && $files->exists($path) ? 'data:image/png;base64,' . base64_encode((string) file_get_contents($files->path($path))) : null;
    }

    public function remove(): void
    {
        $s = (array) $this->settings->get(self::KEY, []);
        if (!empty($s['path'])) $this->files->delete($s['path']);
        $this->settings->set(self::KEY, []);
    }

    /** Scales to at most 900 px wide, crops the empty margins and (optionally) makes the background transparent. */
    private static function prepare(\GdImage $src, bool $clean): \GdImage
    {
        $w = imagesx($src);
        $h = imagesy($src);
        $scale = min(1, 900 / $w);
        $nw = max(1, (int) round($w * $scale));
        $nh = max(1, (int) round($h * $scale));
        $img = imagecreatetruecolor($nw, $nh);
        imagealphablending($img, false);
        imagesavealpha($img, true);
        imagefill($img, 0, 0, imagecolorallocatealpha($img, 255, 255, 255, 127));
        imagecopyresampled($img, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
        $minX = $nw; $minY = $nh; $maxX = -1; $maxY = -1;
        for ($y = 0; $y < $nh; $y++) {
            for ($x = 0; $x < $nw; $x++) {
                $c = imagecolorat($img, $x, $y);
                $a = ($c >> 24) & 0x7F;
                $r = ($c >> 16) & 0xFF; $g = ($c >> 8) & 0xFF; $b = $c & 0xFF;
                $light = ($r + $g + $b) / 3;
                if ($clean && $a < 127) {
                    // paper → transparent; the ink keeps its colour with an alpha that follows its darkness
                    if ($light >= 200) {
                        imagesetpixel($img, $x, $y, imagecolorallocatealpha($img, 255, 255, 255, 127));
                        continue;
                    }
                    $alpha = (int) max($a, min(127, round(($light - 90) / 110 * 127)));
                    if ($alpha !== $a) imagesetpixel($img, $x, $y, imagecolorallocatealpha($img, $r, $g, $b, max(0, $alpha)));
                    $a = max(0, $alpha);
                }
                if ($a < 110) {
                    $minX = min($minX, $x); $maxX = max($maxX, $x);
                    $minY = min($minY, $y); $maxY = max($maxY, $y);
                }
            }
        }
        if ($maxX < 0) throw new DomainError('empty', 'No se ve ninguna firma en la imagen. Usa tinta oscura sobre papel blanco.');
        $pad = 6;
        $minX = max(0, $minX - $pad); $minY = max(0, $minY - $pad);
        $cw = min($nw - $minX, $maxX - $minX + 1 + 2 * $pad);
        $ch = min($nh - $minY, $maxY - $minY + 1 + 2 * $pad);
        $out = imagecreatetruecolor($cw, $ch);
        imagealphablending($out, false);
        imagesavealpha($out, true);
        imagecopy($out, $img, 0, 0, $minX, $minY, $cw, $ch);
        return $out;
    }
}
