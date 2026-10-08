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

    /** @var array{student:int,user:string,seen:int}|false|null read once per request (false = no family) */
    private static array|false|null $cache = null;
    private static string $csrf = '';

    public static function start(): void
    {
        if (session_status() === PHP_SESSION_ACTIVE) {
            if (session_name() === self::COOKIE) return;
            session_write_close(); // another session (the panel's) is open: save it before switching
        }
        session_name(self::COOKIE);
        // always the family's own id: never fall into whatever session was open before in this request
        $id = $_COOKIE[self::COOKIE] ?? '';
        session_id(is_string($id) && preg_match('/^[A-Za-z0-9,-]{22,256}$/', $id) ? $id : '');
        // own folder, apart from the panel's: each one is cleaned with its own idle time (30 days here)
        $dir = \rp_data_dir() . '/sessions/familias';
        if (is_dir($dir) || @mkdir($dir, 0700, true)) session_save_path($dir);
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
        self::$cache = $_SESSION['family'];
        self::$csrf = $_SESSION['csrf'];
        session_write_close();
        return self::$csrf;
    }

    public static function logout(): void
    {
        self::start();
        $_SESSION = [];
        session_destroy();
        self::$cache = false;
        self::$csrf = '';
    }

    /**
     * The family of this request, if any. Read once and the session closed right away, so a staff session can
     * still be opened in the same request (a teacher who is also a parent on the same browser).
     */
    public static function current(): ?Actor
    {
        if (self::$cache === null) {
            self::$cache = false;
            if (!empty($_COOKIE[self::COOKIE])) {
                self::start();
                $f = $_SESSION['family'] ?? null;
                if ($f && time() - (int) $f['seen'] <= self::IDLE) {
                    $_SESSION['family']['seen'] = time();
                    self::$cache = $_SESSION['family'];
                    self::$csrf = (string) ($_SESSION['csrf'] ?? '');
                }
                session_write_close();
                $_SESSION = [];
            }
        }
        $f = self::$cache;
        return $f ? Actor::family((int) $f['student'], (string) $f['user']) : null;
    }

    public static function require(Request $req, bool $write = false): Actor
    {
        $actor = self::current() ?? throw HttpError::unauthorized();
        if ($write && (self::$csrf === '' || !hash_equals(self::$csrf, $req->header('x-csrf-token')))) {
            throw new HttpError(403, 'csrf');
        }
        return $actor;
    }

    public static function csrf(): string
    {
        self::current();
        return self::$csrf;
    }
}
