<?php
declare(strict_types=1);

namespace Gabush\Application;

use Gabush\App;
use Gabush\Application\Backup\BackupService;
use Gabush\Application\Billing\BillingService;
use Gabush\Application\Payments\CheckoutService;
use Gabush\Application\Email\EmailService;
use Gabush\Application\Notifications\Notifier;
use Gabush\Application\Shared\Actor;
use Gabush\Application\Shared\Settings;

/**
 * Background jobs, run by the hosting cron every 15 minutes (api/cron.php). Each job is idempotent:
 *   - monthly pensions of the current month (one per student and month)
 *   - late fees, once a day
 *   - payment reminders to families with overdue / soon-due charges, once a day after 8:00
 *   - birthday greetings to the families (app + push + e-mail), once a day after 7:00
 *   - e-mail queue
 *   - abandoned online checkouts → expirado (after 3 h)
 *   - backup of the database + private files, once a day (weekly on Sundays)
 */
final class Scheduler
{
    public function __construct(private readonly App $app)
    {
    }

    /** @return array<string,mixed> what was done */
    public function run(): array
    {
        $now = $this->app->today();
        $settings = $this->app->service(Settings::class, static fn(App $a) => new Settings($a->db()));
        $billing = BillingService::from($this->app);
        $system = Actor::system('cron');
        $done = [];
        $state = (array) $settings->get('scheduler', []);

        $done['pensions'] = $billing->generateMonthlyCharges($now, $system);
        $done['days'] = $billing->generateDayCharges($now->modify('first day of last month'), $system); // per-day plans: last month

        if (($state['lateFeesDay'] ?? '') !== $now->format('Y-m-d')) {
            $done['lateFees'] = $billing->applyLateFees($system);
            $done['enrollmentExtra'] = $billing->applyEnrollmentLateFees($system);
            $state['lateFeesDay'] = $now->format('Y-m-d');
        }

        $reminders = (array) $settings->get('reminders', ['enabled' => true, 'daysBefore' => 3, 'hour' => 8]);
        if (!empty($reminders['enabled']) && (int) $now->format('G') >= (int) ($reminders['hour'] ?? 8) && ($state['remindersDay'] ?? '') !== $now->format('Y-m-d')) {
            $done['reminders'] = $this->paymentReminders($billing, (int) ($reminders['daysBefore'] ?? 3));
            $state['remindersDay'] = $now->format('Y-m-d');
        }

        // birthday greetings, once a day from 7:00 (before the e-mail queue is sent)
        $bday = (array) $settings->get('birthdays', ['enabled' => true, 'hour' => 7]);
        if (($bday['enabled'] ?? true) && (int) $now->format('G') >= (int) ($bday['hour'] ?? 7) && ($state['birthdaysDay'] ?? '') !== $now->format('Y-m-d')) {
            $done['birthdays'] = $this->birthdays();
            $state['birthdaysDay'] = $now->format('Y-m-d');
        }

        $done['email'] = EmailService::from($this->app)->flush(40);
        $done['expiredCheckouts'] = CheckoutService::from($this->app)->expireAbandoned();

        // backup once a day, early in the morning (Sundays: the weekly one, kept 8 weeks)
        if ((int) $now->format('G') >= 2 && ($state['backupDay'] ?? '') !== $now->format('Y-m-d')) {
            try {
                $done['backup'] = BackupService::from($this->app)->scheduled($now);
                $state['backupDay'] = $now->format('Y-m-d');
            } catch (\Throwable $e) {
                $done['backup'] = 'ERROR ' . $e->getMessage();
                error_log('[gabush backup] ' . $e->getMessage());
            }
        }
        $settings->set('scheduler', $state + ['lastRun' => $now->format('c')]);
        return $done;
    }

    /**
     * Students (active or pre-enrolled this year) whose birthday is today — 29 Feb ones on 28 Feb in other
     * years — and were not greeted yet this year: novedad + push + "Feliz cumpleaños" e-mail. @return int greeted
     */
    private function birthdays(): int
    {
        $db = $this->app->db();
        $today = $this->app->today();
        $year = $this->app->service(Settings::class, static fn(App $a) => new Settings($a->db()))->activeYear();
        $md = $today->format('m-d');
        $leapFallback = $md === '02-28' && $today->format('L') === '0';
        $rows = $db->all(
            "SELECT s.id, s.birth_date FROM students s JOIN enrollments e ON e.student_id = s.id AND e.year_id = ? AND e.status IN ('activo','prematricula')
             WHERE s.birth_date IS NOT NULL AND (DATE_FORMAT(s.birth_date, '%m-%d') = ?" . ($leapFallback ? " OR DATE_FORMAT(s.birth_date, '%m-%d') = '02-29'" : '') . ')
               AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.student_id = s.id AND n.kind = \'cumpleanos\' AND YEAR(n.created_at) = ?)',
            [$year, $md, (int) $today->format('Y')],
        );
        $n = Notifier::from($this->app);
        foreach ($rows as $r) {
            $age = (int) $today->format('Y') - (int) substr((string) $r['birth_date'], 0, 4);
            if ($age >= 1) $n->birthday((int) $r['id'], $age);
        }
        return count($rows);
    }

    /** Families with overdue charges, or charges due within $daysBefore days. */
    private function paymentReminders(BillingService $billing, int $daysBefore): int
    {
        $db = $this->app->db();
        $limit = $this->app->today()->modify("+$daysBefore days")->format('Y-m-d');
        $year = $this->app->service(Settings::class, static fn(App $a) => new Settings($a->db()))->activeYear();
        $students = array_column($db->all(
            "SELECT DISTINCT c.student_id FROM charges c JOIN enrollments e ON e.student_id = c.student_id AND e.year_id = ? AND e.status = 'activo'
             WHERE c.status = 'abierto' AND c.due_on IS NOT NULL AND c.due_on <= ?",
            [$year, $limit],
        ), 'student_id');
        $n = Notifier::from($this->app);
        $sent = 0;
        foreach ($students as $sid) {
            $open = array_values(array_filter($billing->charges((int) $sid, null, true), static fn($c) => $c['dueOn'] !== null && $c['dueOn'] <= $limit && $c['balance'] > 0));
            if (!$open) continue;
            $n->paymentReminder((int) $sid, array_sum(array_column($open, 'balance')), $open, array_sum(array_column($open, 'lateFees')));
            $sent++;
        }
        return $sent;
    }
}
