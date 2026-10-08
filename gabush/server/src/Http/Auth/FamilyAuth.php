<?php
declare(strict_types=1);

namespace Gabush\Http\Auth;

use Gabush\Application\Shared\Actor;
use Gabush\Http\HttpError;
use Gabush\Http\Request;

/** Session of the family portal (one account per student). Separate cookie from the staff panel. */
final class FamilyAuth
{
    private const COOKIE = 'gbfamily';
    private const IDLE = 60 * 60 * 24 * 30; // 30 days: families stay signed in on their phone

    public static function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) return;
        session_name(self::COOKIE);
        session_set_cookie_params([
            'lifetime' => self::IDLE,
            'path' => '/api/v2', // portal routes + photo / receipt / document files of the own student
            'secure' => \rp_is_https(),
            'httponly' => true,
            'samesite' => 'Lax', // Lax: the payment gateway sends the family back with a top-level redirect
        ]);
        ini_set('session.use_strict_mode', '1');
        ini_set('session.gc_maxlifetime', (string) self::IDLE);
        session_start();
    }

    public static function login(int $studentId, string $username): string
    {
        self::start();
        session_regenerate_id(true);
        $_SESSION['family'] = ['student' => $studentId, 'user' => $username, 'seen' => time()];
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
        return $_SESSION['csrf'];
    }

    public static function logout(): void
    {
        self::start();
        $_SESSION = [];
        session_destroy();
    }

    /**
     * The family of this request, if any. The session is read and closed right away (its data stays in
     * $_SESSION for the request), so a staff session can still be opened in the same request — e.g. a
     * teacher who is also a parent on the same browser.
     */
    public static function current(): ?Actor
    {
        if (empty($_COOKIE[self::COOKIE])) return null;
        if (session_status() !== PHP_SESSION_ACTIVE && session_name() === self::COOKIE && isset($_SESSION['family'])) {
            $f = $_SESSION['family']; // already read in this request
        } else {
            self::start();
            $f = $_SESSION['family'] ?? null;
            if ($f && time() - (int) $f['seen'] <= self::IDLE) $_SESSION['family']['seen'] = time();
            session_write_close();
            session_id(''); // next session_start() (staff) reads its own cookie
        }
        if (!$f || time() - (int) $f['seen'] > self::IDLE) return null;
        return Actor::family((int) $f['student'], (string) $f['user']);
    }

    public static function require(Request $req, bool $write = false): Actor
    {
        $actor = self::current() ?? throw HttpError::unauthorized();
        if ($write && !hash_equals((string) ($_SESSION['csrf'] ?? ''), $req->header('x-csrf-token'))) {
            throw new HttpError(403, 'csrf');
        }
        return $actor;
    }

    public static function csrf(): string
    {
        return (string) ($_SESSION['csrf'] ?? '');
    }
}
