<?php
declare(strict_types=1);

namespace Gabush\Application\Shared;

use Gabush\Infrastructure\Database\Database;

/**
 * Who signs in (and fails to), who is online, their last connection and how many times they came in — for the
 * family portal and the staff panel — plus every view / download / share / print of a report card.
 * Auditing never breaks the request: errors are only logged.
 */
final class AccessAudit
{
    /** Who made the current request (set by StaffAuth / FamilyAuth), touched once at the end of the request. */
    public static ?array $who = null;

    public function __construct(private readonly Database $db)
    {
    }

    /** @param 'familia'|'panel' $portal  @param 'ingreso'|'salida'|'fallido' $event */
    public function event(string $portal, string $userId, ?string $name, ?string $role, string $event): void
    {
        $this->safe(function () use ($portal, $userId, $name, $role, $event): void {
            [$ip, $device] = self::client();
            $name ??= $this->nameOf($portal, $userId);
            $this->db->run('INSERT INTO access_log (portal, user_id, user_name, role, event, ip, device) VALUES (?, ?, ?, ?, ?, ?, ?)', [$portal, mb_substr($userId, 0, 64), $name, $role, $event, $ip, $device]);
            if ($event === 'ingreso') {
                $this->db->run(
                    'INSERT INTO user_presence (portal, user_id, user_name, role, last_seen, last_login, logins, ip, device) VALUES (?, ?, ?, ?, NOW(), NOW(), 1, ?, ?)
                     ON DUPLICATE KEY UPDATE user_name = VALUES(user_name), role = VALUES(role), last_seen = NOW(), last_login = NOW(), logins = logins + 1, ip = VALUES(ip), device = VALUES(device)',
                    [$portal, $userId, $name, $role, $ip, $device],
                );
            }
        });
    }

    /** Last activity of whoever made this request (at most one write a minute per user). */
    public function touch(): void
    {
        $w = self::$who;
        if (!$w) return;
        $this->safe(function () use ($w): void {
            $n = $this->db->run('UPDATE user_presence SET last_seen = NOW() WHERE portal = ? AND user_id = ? AND last_seen < NOW() - INTERVAL 60 SECOND', [$w['portal'], $w['id']])->rowCount();
            if ($n === 0 && !$this->db->value('SELECT 1 FROM user_presence WHERE portal = ? AND user_id = ?', [$w['portal'], $w['id']])) {
                // signed in before this audit existed: start counting from now
                [$ip, $device] = self::client();
                $this->db->run('INSERT IGNORE INTO user_presence (portal, user_id, user_name, role, last_seen, ip, device) VALUES (?, ?, ?, ?, NOW(), ?, ?)', [$w['portal'], $w['id'], $w['name'] ?? $this->nameOf($w['portal'], $w['id']), $w['role'] ?? null, $ip, $device]);
            }
        });
    }

    /** @param 'ver'|'descargar'|'compartir'|'imprimir' $action */
    public function boletin(int $studentId, int $year, string $period, ?string $periodName, string $viewer, string $viewerId, ?string $viewerName, string $action): void
    {
        $this->safe(function () use ($studentId, $year, $period, $periodName, $viewer, $viewerId, $viewerName, $action): void {
            [$ip, $device] = self::client();
            $this->db->run(
                'INSERT INTO boletin_views (student_id, year_id, period, period_name, viewer, viewer_id, viewer_name, action, ip, device) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [$studentId, $year, $period, $periodName, $viewer, $viewerId, $viewerName, $action, $ip, $device],
            );
        });
    }

    /** Family accounts are named after the student (and the username they typed). */
    private function nameOf(string $portal, string $id): ?string
    {
        if ($portal !== 'familia' || !ctype_digit($id)) return null;
        $s = $this->db->one('SELECT first_name, last_name, second_last_name FROM students WHERE id = ?', [(int) $id]);
        return $s ? trim("{$s['first_name']} {$s['last_name']} " . ($s['second_last_name'] ?? '')) : null;
    }

    /** @return array{0:string,1:string} ip, "Chrome · Android" */
    private static function client(): array
    {
        $ip = function_exists('rp_client_ip') ? \rp_client_ip() : (string) ($_SERVER['REMOTE_ADDR'] ?? '');
        $ua = (string) ($_SERVER['HTTP_USER_AGENT'] ?? '');
        $device = function_exists('rp_device') ? \rp_device($ua)['label'] : mb_substr($ua, 0, 60);
        return [$ip, mb_substr($device, 0, 60)];
    }

    private function safe(callable $fn): void
    {
        try {
            $fn();
        } catch (\Throwable $e) {
            error_log('[gabush audit] ' . $e->getMessage());
        }
    }
}
