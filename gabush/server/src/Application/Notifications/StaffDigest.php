<?php
declare(strict_types=1);

namespace Gabush\Application\Notifications;

use Gabush\App;
use Gabush\Application\Billing\BillingService;
use Gabush\Application\Shared\Settings;

/**
 * What the staff's daily reminders talk about (api/_reports.php → push to the panel's devices), from the
 * database: birthdays of the day, families that owe today, and children still without attendance.
 */
final class StaffDigest
{
    public function __construct(private readonly App $app)
    {
    }

    private function year(): int
    {
        return (int) $this->app->service(Settings::class, static fn(App $a) => new Settings($a->db()))->activeYear();
    }

    /** Active children whose birthday is today: ["María (5 años)", …] — 29 Feb ones on 28 Feb in common years. */
    public function birthdays(): array
    {
        $today = $this->app->today();
        $md = $today->format('m-d');
        $leap = $md === '02-28' && $today->format('L') === '0';
        $rows = $this->app->db()->all(
            "SELECT s.first_name, s.birth_date FROM students s JOIN enrollments e ON e.student_id = s.id AND e.year_id = ? AND e.status = 'activo'
             WHERE s.birth_date IS NOT NULL AND (DATE_FORMAT(s.birth_date, '%m-%d') = ?" . ($leap ? " OR DATE_FORMAT(s.birth_date, '%m-%d') = '02-29'" : '') . ') ORDER BY s.first_name',
            [$this->year(), $md],
        );
        $y = (int) $today->format('Y');
        return array_map(static fn($r) => trim(explode(' ', trim((string) $r['first_name']))[0]) . ' (' . ($y - (int) substr((string) $r['birth_date'], 0, 4)) . ' años)', $rows);
    }

    /** Active children with something due today or overdue: [[name, amount, label], …], biggest first. */
    public function dues(): array
    {
        $today = $this->app->today()->format('Y-m-d');
        $billing = BillingService::from($this->app);
        $rows = $this->app->db()->all(
            "SELECT DISTINCT s.id, s.first_name, s.last_name FROM charges c JOIN students s ON s.id = c.student_id
             JOIN enrollments e ON e.student_id = s.id AND e.year_id = ? AND e.status = 'activo'
             WHERE c.status = 'abierto' AND c.due_on IS NOT NULL AND c.due_on <= ?",
            [$this->year(), $today],
        );
        $out = [];
        foreach ($rows as $r) {
            $open = array_filter($billing->charges((int) $r['id'], null, true), static fn($c) => $c['dueOn'] !== null && $c['dueOn'] <= $today && $c['balance'] > 0);
            $amount = array_sum(array_column($open, 'balance'));
            if ($amount <= 0) continue;
            $dueToday = (bool) array_filter($open, static fn($c) => $c['dueOn'] === $today);
            $out[] = [trim($r['first_name'] . ' ' . $r['last_name']), $amount, $dueToday && count($open) === 1 ? 'vence hoy' : 'vencido'];
        }
        usort($out, static fn($a, $b) => $b[1] <=> $a[1]);
        return $out;
    }

    /**
     * Active children without an attendance mark today. $shift "manana" = only the morning shift (plan de
     * mañana, jornada completa or without a plan); null = everyone.
     */
    public function attendancePending(?string $shift = null): array
    {
        $today = $this->app->today()->format('Y-m-d');
        $rows = $this->app->db()->all(
            "SELECT s.first_name FROM enrollments e JOIN students s ON s.id = e.student_id LEFT JOIN plans pl ON pl.id = e.plan_id
             WHERE e.year_id = ? AND e.status = 'activo'" . ($shift === 'manana' ? " AND (pl.shift IS NULL OR pl.shift IN ('manana','completa'))" : '') . '
               AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.student_id = s.id AND a.day = ?) ORDER BY s.first_name',
            [$this->year(), $today],
        );
        return array_map(static fn($r) => trim(explode(' ', trim((string) $r['first_name']))[0]), $rows);
    }

    /** Saves one sent notification in push_log (Auditoría → Notificaciones). @param list<array{who:string,device:string,status:int}> $detail */
    public static function log(App $app, string $audience, string $type, string $title, ?string $body, ?int $studentId, ?string $recipient, array $detail, ?string $url = null): void
    {
        try {
            $ok = count(array_filter($detail, static fn($d) => $d['status'] >= 200 && $d['status'] < 300));
            $app->db()->insert('push_log', [
                'audience' => $audience, 'type' => mb_substr($type, 0, 32), 'title' => mb_substr($title, 0, 160), 'body' => $body !== null ? mb_substr($body, 0, 500) : null,
                'url' => $url !== null ? mb_substr($url, 0, 200) : null,
                'student_id' => $studentId, 'recipient' => $recipient !== null ? mb_substr($recipient, 0, 200) : null,
                'devices' => count($detail), 'delivered' => $ok, 'failed' => count($detail) - $ok, 'detail' => $detail ? json_encode($detail, JSON_UNESCAPED_UNICODE) : null,
            ]);
        } catch (\Throwable $e) {
            error_log('[gabush push_log] ' . $e->getMessage()); // the log must never break a notification
        }
    }
}
