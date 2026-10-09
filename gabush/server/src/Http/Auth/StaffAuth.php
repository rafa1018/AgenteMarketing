<?php
declare(strict_types=1);

namespace Gabush\Http\Auth;

use Gabush\Application\Shared\Actor;
use Gabush\Http\HttpError;
use Gabush\Http\Request;

/**
 * Staff authentication reuses the panel's existing session and permissions (api/_bootstrap.php:
 * rp_is_admin / rp_current_user / CSRF token), so the panel keeps a single login.
 */
final class StaffAuth
{
    /** @param list<string> $anyOf permissions; the user needs at least one (empty = any staff user) */
    public static function require(Request $req, array $anyOf = [], bool $write = false): Actor
    {
        if (!\rp_is_admin() || !($me = \rp_current_user())) {
            throw HttpError::unauthorized();
        }
        if ($write) {
            $sent = $req->header('x-csrf-token');
            if (!hash_equals((string) ($_SESSION['csrf'] ?? ''), $sent)) throw new HttpError(403, 'csrf');
        }
        \Gabush\Application\Shared\AccessAudit::$who = ['portal' => 'panel', 'id' => (string) $me['id'], 'name' => (string) $me['name'], 'role' => (string) ($me['role'] ?? '')];
        $perms = (array) ($me['perms'] ?? []);
        if ($anyOf && !array_intersect($anyOf, $perms)) {
            throw HttpError::forbidden();
        }
        return Actor::staff((string) $me['id'], (string) $me['name'], array_values($perms));
    }
}
