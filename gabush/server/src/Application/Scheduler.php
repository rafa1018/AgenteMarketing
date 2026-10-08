<?php
declare(strict_types=1);

namespace Gabush\Application;

use Gabush\App;
use Gabush\Application\Billing\BillingService;
use Gabush\Application\Email\EmailService;
use Gabush\Application\Notifications\Notifier;
use Gabush\Application\Shared\Actor;
use Gabush\Application\Shared\Settings;

/**
 * Background jobs, run by the hosting cron every 15 minutes (api/cron.php). Each job is idempotent:
 *   - monthly pensions of the current month (one per student and month)
 *   - late fees, once a day
 *   - payment reminders to families with overdue / soon-due charges, once a day after 8:00
 *   - e-mail queue
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

        if (($state['lateFeesDay'] ?? '') !== $now->format('Y-m-d')) {
            $done['lateFees'] = $billing->applyLateFees($system);
            $state['lateFeesDay'] = $now->format('Y-m-d');
        }

        $reminders = (array) $settings->get('reminders', ['enabled' => true, 'daysBefore' => 3, 'hour' => 8]);
        if (!empty($reminders['enabled']) && (int) $now->format('G') >= (int) ($reminders['hour'] ?? 8) && ($state['remindersDay'] ?? '') !== $now->format('Y-m-d')) {
            $done['reminders'] = $this->paymentReminders($billing, (int) ($reminders['daysBefore'] ?? 3));
            $state['remindersDay'] = $now->format('Y-m-d');
        }

        $done['email'] = EmailService::from($this->app)->flush(40);
        $settings->set('scheduler', $state + ['lastRun' => $now->format('c')]);
        return $done;
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
