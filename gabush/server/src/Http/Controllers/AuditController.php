<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Http\Request;
use Gabush\Http\Router;

/**
 * Access audit for the rectora (permission "usuarios"): who is online and their last connection, the sign-in
 * history, and who saw / downloaded each report card. Every list filters by portal: families or panel.
 */
final class AuditController extends Controller
{
    private const ONLINE_MINUTES = 5;

    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/audit/presence', [$c, 'presence']);
        $r->add('GET', '/audit/access', [$c, 'access']);
        $r->add('GET', '/audit/boletines', [$c, 'boletines']);
        $r->add('GET', '/audit/billing', [$c, 'billing']);
        $r->add('GET', '/audit/push/devices', [$c, 'pushDevices']);
        $r->add('POST', '/audit/push/devices/delete', [$c, 'deletePushDevice']);
        $r->add('GET', '/audit/push/sent', [$c, 'pushSent']);
        $r->add('POST', '/audit/push/sent/{id}/resend', [$c, 'pushResend']);
        $r->add('DELETE', '/audit/access/{id}', [$c, 'deleteAccess']);
        $r->add('DELETE', '/audit/boletines/{id}', [$c, 'deleteBoletin']);
        $r->add('POST', '/audit/presence/delete', [$c, 'deletePresence']);
    }

    public function deleteAccess(Request $req): array
    {
        $actor = $this->staffWrite($req, 'usuarios');
        $this->db()->run('DELETE FROM access_log WHERE id = ?', [$req->intParam('id')]);
        $this->audit()->log($actor, 'audit.delete_access', 'access_log', $req->intParam('id'));
        return [];
    }

    public function deleteBoletin(Request $req): array
    {
        $actor = $this->staffWrite($req, 'usuarios');
        $this->db()->run('DELETE FROM boletin_views WHERE id = ?', [$req->intParam('id')]);
        $this->audit()->log($actor, 'audit.delete_boletin_view', 'boletin_views', $req->intParam('id'));
        return [];
    }

    /** {portal, userId}: forgets the connection record of that user (it starts again on their next visit). */
    public function deletePresence(Request $req): array
    {
        $actor = $this->staffWrite($req, 'usuarios');
        $in = $req->json();
        $portal = in_array($in['portal'] ?? '', ['familia', 'panel'], true) ? $in['portal'] : throw \Gabush\Http\HttpError::validation(['portal' => 'Portal no válido.']);
        $this->db()->run('DELETE FROM user_presence WHERE portal = ? AND user_id = ?', [$portal, (string) ($in['userId'] ?? '')]);
        $this->audit()->log($actor, 'audit.delete_presence', 'user_presence', null, ['portal' => $portal, 'user' => $in['userId'] ?? '']);
        return [];
    }

    /** ?from=&to= (YYYY-MM-DD) on a datetime column; nothing when absent. @return array{0:list<string>,1:list<string>} */
    private function range(Request $req, string $col): array
    {
        $w = [];
        $p = [];
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $f = (string) $req->query('from', ''))) { $w[] = "$col >= ?"; $p[] = $f; }
        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $t = (string) $req->query('to', ''))) { $w[] = "$col < ? + INTERVAL 1 DAY"; $p[] = $t; }
        return [$w, $p];
    }

    /** ?portal=familia|panel|todos&q=&role=&online=1 */
    public function presence(Request $req): array
    {
        $this->staff($req, 'usuarios');
        [$where, $p] = $this->portalFilter($req, 'u');
        if (($role = (string) $req->query('role', '')) !== '') { $where[] = 'u.role = ?'; $p[] = $role; }
        if (($q = trim((string) $req->query('q', ''))) !== '') { $where[] = '(u.user_name LIKE ? OR c.name LIKE ?)'; array_push($p, "%$q%", "%$q%"); }
        if ($req->query('online') === '1') $where[] = 'u.last_seen >= NOW() - INTERVAL ' . self::ONLINE_MINUTES . ' MINUTE';
        [$rw, $rp] = $this->range($req, 'u.last_seen');
        $where = [...$where, ...$rw];
        $p = [...$p, ...$rp];
        $year = $this->settings()->activeYear();
        $rows = $this->db()->all(
            "SELECT u.portal, u.user_id AS userId, u.user_name AS name, u.role, u.last_seen AS lastSeen, u.last_login AS lastLogin, u.logins, u.ip, u.device,
                    u.last_seen >= NOW() - INTERVAL " . self::ONLINE_MINUTES . " MINUTE AS online, c.name AS course
             FROM user_presence u
             LEFT JOIN enrollments e ON u.portal = 'familia' AND e.student_id = u.user_id AND e.year_id = ?
             LEFT JOIN courses c ON c.id = e.course_id
             WHERE " . implode(' AND ', $where) . ' ORDER BY online DESC, u.last_seen DESC LIMIT 500',
            [$year, ...$p],
        );
        $counts = $this->db()->one(
            "SELECT SUM(portal = 'familia' AND last_seen >= NOW() - INTERVAL " . self::ONLINE_MINUTES . " MINUTE) AS familiaOnline,
                    SUM(portal = 'panel' AND last_seen >= NOW() - INTERVAL " . self::ONLINE_MINUTES . " MINUTE) AS panelOnline,
                    SUM(portal = 'familia') AS familias, SUM(portal = 'panel') AS panel FROM user_presence",
        );
        // families with a portal account that never came in
        $never = (int) $this->db()->value(
            "SELECT COUNT(*) FROM portal_accounts pa JOIN enrollments e ON e.student_id = pa.student_id AND e.year_id = ? AND e.status = 'activo'
             WHERE NOT EXISTS (SELECT 1 FROM user_presence u WHERE u.portal = 'familia' AND u.user_id = pa.student_id)",
            [$year],
        );
        return [
            'onlineMinutes' => self::ONLINE_MINUTES,
            'users' => self::intsAll($rows, 'logins', 'online'),
            'counts' => array_map('intval', (array) $counts) + ['familiasNunca' => $never],
            'roles' => array_column($this->db()->all("SELECT DISTINCT role FROM user_presence WHERE portal = 'panel' AND role IS NOT NULL ORDER BY role"), 'role'),
        ];
    }

    /** ?portal=&event=ingreso|salida|fallido&q=&from=&to= — newest first. */
    public function access(Request $req): array
    {
        $this->staff($req, 'usuarios');
        [$where, $p] = $this->portalFilter($req, 'a');
        if (in_array($ev = (string) $req->query('event', ''), ['ingreso', 'salida', 'fallido', 'inactividad'], true)) { $where[] = 'a.event = ?'; $p[] = $ev; }
        if (($role = (string) $req->query('role', '')) !== '') { $where[] = 'a.role = ?'; $p[] = $role; }
        if (($q = trim((string) $req->query('q', ''))) !== '') { $where[] = '(a.user_name LIKE ? OR a.user_id LIKE ? OR a.ip LIKE ?)'; array_push($p, "%$q%", "%$q%", "%$q%"); }
        [$rw, $rp] = $this->range($req, 'a.created_at');
        $where = [...$where, ...$rw];
        $p = [...$p, ...$rp];
        $rows = $this->db()->all(
            'SELECT a.id, a.portal, a.user_id AS userId, a.user_name AS name, a.role, a.event, a.ip, a.device, a.created_at AS at
             FROM access_log a WHERE ' . implode(' AND ', $where) . ' ORDER BY a.id DESC LIMIT 400',
            $p,
        );
        return ['events' => self::intsAll($rows, 'id')];
    }

    /**
     * ?year=&period=<id>|final&course=&viewer=familia|personal|todos
     * - students: every active child of the year (or course) with whether the family saw / downloaded it
     * - events: the detailed log, newest first
     */
    public function boletines(Request $req): array
    {
        $this->staff($req, 'usuarios');
        $year = $this->year($req);
        $period = (string) $req->query('period', '');
        $course = (int) $req->query('course', 0);
        $w = ['v.year_id = ?'];
        $p = [$year];
        if ($period !== '') { $w[] = 'v.period = ?'; $p[] = $period; }
        if (in_array($viewer = (string) $req->query('viewer', 'familia'), ['familia', 'personal'], true)) { $w[] = 'v.viewer = ?'; $p[] = $viewer; }
        if ($course) { $w[] = 'e.course_id = ?'; $p[] = $course; }
        $student = (int) $req->query('student', 0);
        if ($student) { $w[] = 'v.student_id = ?'; $p[] = $student; }
        [$rw, $rp] = $this->range($req, 'v.created_at');
        $w = [...$w, ...$rw];
        $p = [...$p, ...$rp];
        $events = $this->db()->all(
            "SELECT v.id, v.student_id AS studentId, CONCAT(s.first_name, ' ', s.last_name) AS student, c.name AS course, v.period, v.period_name AS periodName,
                    v.viewer, v.viewer_name AS viewerName, v.action, v.ip, v.device, v.created_at AS at
             FROM boletin_views v JOIN students s ON s.id = v.student_id
             LEFT JOIN enrollments e ON e.student_id = v.student_id AND e.year_id = v.year_id LEFT JOIN courses c ON c.id = e.course_id
             WHERE " . implode(' AND ', $w) . ' ORDER BY v.id DESC LIMIT 500',
            $p,
        );
        // per child: did the FAMILY open / download it (for the chosen period, or any)
        $sp = [$year];
        $periodSql = '';
        if ($period !== '') { $periodSql = ' AND v.period = ?'; $sp[] = $period; }
        [$rw, $rp] = $this->range($req, 'v.created_at');
        foreach ($rw as $cond) $periodSql .= " AND $cond";
        $sp = [...$sp, ...$rp];
        $sp[] = $year;
        $courseSql = '';
        if ($course) { $courseSql = ' AND e.course_id = ?'; $sp[] = $course; }
        if ($student) { $courseSql .= ' AND s.id = ?'; $sp[] = $student; }
        $students = $this->db()->all(
            "SELECT s.id, CONCAT(s.last_name, ' ', COALESCE(s.second_last_name, ''), ', ', s.first_name) AS name, c.name AS course,
                    COUNT(v.id) AS total, SUM(v.action = 'ver') AS views, SUM(v.action = 'descargar') AS downloads,
                    SUM(v.action IN ('compartir', 'imprimir')) AS shared, MIN(v.created_at) AS firstSeen, MAX(v.created_at) AS lastSeen
             FROM enrollments e JOIN students s ON s.id = e.student_id LEFT JOIN courses c ON c.id = e.course_id
             LEFT JOIN boletin_views v ON v.student_id = s.id AND v.year_id = ? AND v.viewer = 'familia'$periodSql
             WHERE e.year_id = ? AND e.status = 'activo'$courseSql
             GROUP BY s.id ORDER BY COUNT(v.id) = 0 DESC, c.name, s.last_name, s.first_name",
            $sp,
        );
        // which report card each family opened: per child and period, how many times seen / downloaded
        $bp = [$year, ...$rp];
        $bw = $rw ? ' AND ' . implode(' AND ', $rw) : '';
        $byPeriod = [];
        foreach ($this->db()->all(
            "SELECT v.student_id, v.period, SUM(v.action = 'ver') AS views, SUM(v.action = 'descargar') AS downloads, SUM(v.action IN ('compartir','imprimir')) AS shared, MAX(v.created_at) AS last
             FROM boletin_views v WHERE v.year_id = ? AND v.viewer = 'familia'$bw GROUP BY v.student_id, v.period",
            $bp,
        ) as $r) {
            $byPeriod[(int) $r['student_id']][$r['period']] = ['views' => (int) $r['views'], 'downloads' => (int) $r['downloads'], 'shared' => (int) $r['shared'], 'last' => $r['last']];
        }
        foreach ($students as &$s) $s['byPeriod'] = (object) ($byPeriod[(int) $s['id']] ?? []);
        unset($s);
        return ['events' => self::intsAll($events, 'id', 'studentId'), 'students' => self::intsAll($students, 'id', 'total', 'views', 'downloads', 'shared')];
    }

    // ───────────────────────── notifications ─────────────────────────
    private const PUSH_TYPES = ['inscripciones', 'pagos', 'asistencia', 'cumpleanos', 'eventos'];

    /** Staff devices of the panel (api/data push.json, written by api/push.php). @return list<array<string,mixed>> */
    private function panelSubs(): array
    {
        $raw = @file_get_contents($this->app->dataDir() . '/push.json');
        return (array) ((json_decode((string) $raw, true) ?: [])['subs'] ?? []);
    }

    /** uid → name of the panel users (users.json; the owner account is "root"). */
    private function panelUsers(): array
    {
        $users = (array) ((json_decode((string) @file_get_contents($this->app->dataDir() . '/users.json'), true) ?: [])['users'] ?? []);
        $out = ['root' => (string) ($this->app->config->get('admin_name', '') ?: 'Administrador (cuenta principal)')];
        foreach ($users as $u) if (!empty($u['id'])) $out[(string) $u['id']] = (string) ($u['name'] ?? $u['username'] ?? $u['id']);
        return $out;
    }

    /**
     * Who has notifications turned on, on which device, since when, when it last got one and which types:
     * the staff (panel) and the families (app). Plus the active families with portal access but no device.
     */
    public function pushDevices(Request $req): array
    {
        $this->staff($req, 'usuarios');
        $names = $this->panelUsers();
        $panel = array_map(static fn($s) => [
            'id' => hash('sha256', (string) $s['endpoint']),
            'who' => $names[(string) ($s['uid'] ?? 'root')] ?? (string) ($s['uid'] ?? 'root'),
            'device' => (string) (($s['device'] ?? '') ?: 'Dispositivo'),
            'since' => $s['createdAt'] ?? null, 'lastOk' => $s['lastOk'] ?? null, 'lastStatus' => $s['lastStatus'] ?? null,
            'types' => array_values(array_filter(self::PUSH_TYPES, static fn($t) => ($s['prefs'][$t] ?? true) !== false)),
        ], $this->panelSubs());
        $year = $this->settings()->activeYear();
        $families = array_map(static function ($r) {
            $prefs = $r['prefs'] ? (json_decode((string) $r['prefs'], true) ?: []) : [];
            return [
                'id' => (int) $r['id'], 'studentId' => (int) $r['studentId'], 'who' => $r['student'], 'course' => $r['course'],
                'device' => \Gabush\Application\Notifications\Notifier::deviceLabel($r['ua']), 'since' => $r['since'], 'lastOk' => $r['lastOk'],
                'off' => array_keys(array_filter($prefs, static fn($v) => $v === false)),
            ];
        }, $this->db()->all(
            "SELECT p.id, p.student_id AS studentId, CONCAT(s.first_name, ' ', s.last_name) AS student, c.name AS course, p.user_agent AS ua, p.prefs,
                    p.created_at AS since, p.last_ok_at AS lastOk
             FROM push_subscriptions p JOIN students s ON s.id = p.student_id
             LEFT JOIN enrollments e ON e.student_id = s.id AND e.year_id = ? LEFT JOIN courses c ON c.id = e.course_id
             ORDER BY p.created_at DESC",
            [$year],
        ));
        $without = $this->db()->all(
            "SELECT s.id, CONCAT(s.first_name, ' ', s.last_name) AS name, c.name AS course, pa.last_login_at AS lastLogin,
                    (SELECT g.phone FROM guardians g WHERE g.family_id = s.family_id AND g.phone IS NOT NULL ORDER BY g.is_primary DESC, g.id LIMIT 1) AS phone
             FROM enrollments e JOIN students s ON s.id = e.student_id LEFT JOIN courses c ON c.id = e.course_id
             LEFT JOIN portal_accounts pa ON pa.student_id = s.id AND pa.active = 1
             WHERE e.year_id = ? AND e.status = 'activo' AND NOT EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.student_id = s.id)
             ORDER BY c.name, s.first_name",
            [$year],
        );
        return ['panel' => $panel, 'families' => $families, 'without' => self::intsAll($without, 'id')];
    }

    /** {audience: panel|familia, id}: forgets a device (it stops receiving notifications until it is activated again). */
    public function deletePushDevice(Request $req): array
    {
        $actor = $this->staffWrite($req, 'usuarios');
        $in = $req->json();
        $id = (string) ($in['id'] ?? '');
        if (($in['audience'] ?? '') === 'familia') {
            $this->db()->run('DELETE FROM push_subscriptions WHERE id = ?', [(int) $id]);
        } else {
            $file = $this->app->dataDir() . '/push.json';
            $fp = fopen($file, 'c+');
            if ($fp && flock($fp, LOCK_EX)) {
                $data = json_decode((string) stream_get_contents($fp), true) ?: [];
                $data['subs'] = array_values(array_filter((array) ($data['subs'] ?? []), static fn($s) => hash('sha256', (string) $s['endpoint']) !== $id));
                ftruncate($fp, 0);
                rewind($fp);
                fwrite($fp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
                flock($fp, LOCK_UN);
            }
            if ($fp) fclose($fp);
        }
        $this->audit()->log($actor, 'push.device_delete', 'push_device', null, ['audience' => $in['audience'] ?? 'panel']);
        return [];
    }

    /** ?audience=panel|familia&type=&q=&student=&from=&to= — the notifications sent, newest first. */
    public function pushSent(Request $req): array
    {
        $this->staff($req, 'usuarios');
        $w = ['1=1'];
        $p = [];
        if (in_array($a = (string) $req->query('audience', ''), ['panel', 'familia'], true)) { $w[] = 'l.audience = ?'; $p[] = $a; }
        if (($t = (string) $req->query('type', '')) !== '') { $w[] = 'l.type = ?'; $p[] = $t; }
        if ($student = (int) $req->query('student', 0)) { $w[] = 'l.student_id = ?'; $p[] = $student; }
        if (($q = trim((string) $req->query('q', ''))) !== '') { $w[] = '(l.title LIKE ? OR l.body LIKE ? OR l.recipient LIKE ?)'; array_push($p, "%$q%", "%$q%", "%$q%"); }
        [$rw, $rp] = $this->range($req, 'l.created_at');
        $rows = $this->db()->all(
            'SELECT l.id, l.audience, l.type, l.title, l.body, l.url, l.student_id AS studentId, l.recipient, l.devices, l.delivered, l.failed, l.detail, l.created_at AS at
             FROM push_log l WHERE ' . implode(' AND ', [...$w, ...$rw]) . ' ORDER BY l.id DESC LIMIT 500',
            [...$p, ...$rp],
        );
        foreach ($rows as &$r) $r['detail'] = $r['detail'] ? (json_decode((string) $r['detail'], true) ?: []) : [];
        unset($r);
        $types = array_column($this->db()->all('SELECT DISTINCT type FROM push_log ORDER BY type'), 'type');
        return ['sent' => self::intsAll($rows, 'id', 'studentId', 'devices', 'delivered', 'failed'), 'types' => $types];
    }

    /**
     * Sends a notification of the log again (it did not arrive, or nobody had it on then): to the family's
     * devices, or to the staff devices that want that type. The resend is logged too ("↻").
     */
    public function pushResend(Request $req): array
    {
        $actor = $this->staffWrite($req, 'usuarios');
        $l = $this->db()->one('SELECT id, audience, type, title, body, url, student_id FROM push_log WHERE id = ?', [$req->intParam('id')]) ?? throw \Gabush\Http\HttpError::notFound();
        $title = (string) preg_replace('/^↻ /u', '', (string) $l['title']);
        if ($l['audience'] === 'familia') {
            if (!$l['student_id']) throw new \Gabush\Domain\Shared\DomainError('student', 'Esta notificación no tiene estudiante.');
            if (!$this->db()->value('SELECT COUNT(*) FROM push_subscriptions WHERE student_id = ?', [$l['student_id']])) {
                throw new \Gabush\Domain\Shared\DomainError('no_device', 'Esa familia no tiene ningún celular con notificaciones activas: la novedad ya está en su app. Invítala a activarlas (pestaña «Familias sin notificaciones»).');
            }
            $delivered = \Gabush\Application\Notifications\Notifier::from($this->app)->resend((int) $l['student_id'], (string) $l['type'], $title, $l['body'], $l['url']);
        } else {
            if (!function_exists('push_notify')) throw new \Gabush\Domain\Shared\DomainError('push', 'Las notificaciones no están disponibles.');
            $delivered = \push_notify((string) $l['type'], ['title' => '↻ ' . $title, 'body' => (string) $l['body'], 'url' => $l['url'] ?: '/admin/', 'tag' => (string) $l['type']]);
        }
        $this->audit()->log($actor, 'push.resend', 'push_log', (int) $l['id'], ['title' => $title, 'delivered' => $delivered]);
        return ['delivered' => $delivered];
    }

    /** Money movements of the "Movimientos de cartera" tab, by group. */
    private const BILLING = [
        'anulaciones' => ['charge.void', 'payment.void', 'charges.void_after_withdrawal', 'student.write_off'],
        'descuentos' => ['charge.descuento', 'charge.adjustment_delete', 'charge.discount_expired', 'charges.monthly_discount', 'charges.early_discount'],
        'mora' => ['charge.recargo', 'charge.waive_late_fee', 'charge.restore_late_fee', 'charges.enrollment_late_fee'],
        'valores' => ['charge.amount', 'charge.due_date', 'student_price.save', 'prices.save'],
        'acuerdos' => ['grades.unlock', 'grades.unlock_remove'],
        'pagos' => ['payment.create'],
        'cobros' => ['charge.create', 'charges.monthly', 'charges.days', 'charges.concept_to_enrolled'],
    ];

    /**
     * ?group=cambios|anulaciones|descuentos|mora|valores|acuerdos|pagos|cobros|todos&from=&to=&student=&actor=&q=
     * "cambios" (default) = everything but the routine payments and charges. ?format=csv downloads it.
     */
    public function billing(Request $req): array|\Gabush\Http\Response
    {
        $this->staff($req, 'usuarios');
        $group = (string) $req->query('group', 'cambios');
        $actions = match (true) {
            isset(self::BILLING[$group]) => self::BILLING[$group],
            $group === 'todos' => array_merge(...array_values(self::BILLING)),
            default => array_merge(self::BILLING['anulaciones'], self::BILLING['descuentos'], self::BILLING['mora'], self::BILLING['valores'], self::BILLING['acuerdos']),
        };
        $w = ['a.action IN (' . implode(',', array_fill(0, count($actions), '?')) . ')'];
        $p = $actions;
        [$rw, $rp] = $this->range($req, 'a.created_at');
        $w = [...$w, ...$rw];
        $p = [...$p, ...$rp];
        $sid = 'COALESCE(ch.student_id, pm.student_id, en.student_id, IF(a.entity = \'student\', a.entity_id, NULL))';
        if ($student = (int) $req->query('student', 0)) { $w[] = "$sid = ?"; $p[] = $student; }
        if (($actor = (string) $req->query('actor', '')) !== '') { $w[] = 'a.actor_id = ?'; $p[] = $actor; }
        if (($q = trim((string) $req->query('q', ''))) !== '') { $w[] = '(a.data LIKE ? OR ch.description LIKE ? OR pm.receipt_number LIKE ?)'; array_push($p, "%$q%", "%$q%", "%$q%"); }
        $rows = $this->db()->all(
            "SELECT a.id, a.created_at AS at, a.action, a.entity, a.entity_id AS entityId, a.data, a.ip, a.actor_type AS actorType, a.actor_id AS actorId,
                    COALESCE(a.actor_name, (SELECT u.user_name FROM user_presence u WHERE u.portal = 'panel' AND u.user_id = a.actor_id LIMIT 1), a.actor_id) AS actorName,
                    $sid AS studentId, CONCAT(s.first_name, ' ', s.last_name) AS student,
                    ch.description AS chargeDescription, ch.amount AS chargeAmount, pm.receipt_number AS receipt, pm.amount AS paymentAmount
             FROM audit_log a
             LEFT JOIN charges ch ON a.entity = 'charge' AND ch.id = a.entity_id
             LEFT JOIN payments pm ON a.entity = 'payment' AND pm.id = a.entity_id
             LEFT JOIN enrollments en ON a.entity = 'enrollment' AND en.id = a.entity_id
             LEFT JOIN students s ON s.id = $sid
             WHERE " . implode(' AND ', $w) . ' ORDER BY a.id DESC LIMIT 1000',
            $p,
        );
        foreach ($rows as &$r) {
            $r['data'] = $r['data'] ? (json_decode((string) $r['data'], true) ?: []) : [];
            if ($r['actorType'] === 'system') $r['actorName'] = 'Sistema (automático)';
            foreach (['studentId', 'chargeAmount', 'paymentAmount'] as $k) $r[$k] = $r[$k] !== null ? (int) $r[$k] : null;
            $r['id'] = (int) $r['id'];
            $r['label'] = self::actionLabel($r['action']);
            $r['amount'] = self::amountOf($r) ?: null;
            $r['detail'] = self::detailOf($r);
        }
        unset($r);
        if ($req->query('format') === 'csv') {
            $from = (string) $req->query('from', '') ?: 'inicio';
            $to = (string) $req->query('to', '') ?: date('Y-m-d');
            return \Gabush\Http\Response::csv("movimientos-cartera-$from-a-$to.csv", ['Fecha', 'Quién', 'Acción', 'Estudiante', 'Cobro / recibo', 'Valor', 'Motivo / detalle', 'IP'], array_map(static fn($r) => [
                $r['at'], $r['actorName'], $r['label'], $r['student'], $r['receipt'] ? 'Recibo ' . $r['receipt'] : $r['chargeDescription'],
                $r['amount'], $r['detail'], $r['ip'],
            ], $rows));
        }
        $actors = $this->db()->all(
            "SELECT a.actor_id AS id, COALESCE(MAX(a.actor_name), MAX(u.user_name), a.actor_id) AS name FROM audit_log a
             LEFT JOIN user_presence u ON u.portal = 'panel' AND u.user_id = a.actor_id
             WHERE a.actor_type = 'staff' AND a.action IN (" . implode(',', array_fill(0, count(array_merge(...array_values(self::BILLING))), '?')) . ') GROUP BY a.actor_id ORDER BY name',
            array_merge(...array_values(self::BILLING)),
        );
        return ['events' => $rows, 'actors' => $actors];
    }

    private static function actionLabel(string $a): string
    {
        return [
            'charge.void' => 'Anuló un cobro', 'payment.void' => 'Anuló un pago', 'charges.void_after_withdrawal' => 'Anuló cobros por retiro', 'student.write_off' => 'Cerró la deuda',
            'charge.descuento' => 'Descuento', 'charge.adjustment_delete' => 'Quitó un descuento/recargo', 'charge.discount_expired' => 'Venció un descuento condicionado',
            'charges.monthly_discount' => 'Descuento mensual aplicado', 'charges.early_discount' => 'Pronto pago aplicado',
            'charge.recargo' => 'Recargo', 'charge.waive_late_fee' => 'Perdonó la mora', 'charge.restore_late_fee' => 'Restauró la mora', 'charges.enrollment_late_fee' => 'Matrícula extraordinaria',
            'charge.amount' => 'Cambió el valor', 'charge.due_date' => 'Cambió el vencimiento', 'student_price.save' => 'Precio especial', 'prices.save' => 'Cambió la tabla de precios',
            'grades.unlock' => 'Acuerdo de pago (notas visibles)', 'grades.unlock_remove' => 'Quitó acuerdo de pago',
            'payment.create' => 'Registró un pago', 'charge.create' => 'Creó un cobro', 'charges.monthly' => 'Generó pensiones', 'charges.days' => 'Generó cobros por días', 'charges.concept_to_enrolled' => 'Cobro masivo',
        ][$a] ?? $a;
    }

    /** @param array<string,mixed> $r */
    private static function amountOf(array $r): ?int
    {
        $d = $r['data'];
        if ($r['action'] === 'charge.amount') return isset($d['to']) ? (int) $d['to'] : null;
        if (in_array($r['action'], ['charge.void'], true)) return $r['chargeAmount'];
        if (in_array($r['action'], ['payment.void', 'payment.create'], true)) return $r['paymentAmount'] ?? (isset($d['amount']) ? (int) $d['amount'] : null);
        return isset($d['amount']) && is_numeric($d['amount']) ? (int) $d['amount'] : null;
    }

    /** @param array<string,mixed> $r */
    private static function detailOf(array $r): string
    {
        $d = $r['data'];
        $money = static fn($v) => '$' . number_format((int) $v, 0, ',', '.');
        $parts = [];
        if ($r['action'] === 'charge.amount') $parts[] = 'De ' . $money($d['from'] ?? 0) . ' a ' . $money($d['to'] ?? 0);
        if ($r['action'] === 'charge.due_date') $parts[] = 'Del ' . ($d['from'] ?? '?') . ' al ' . ($d['to'] ?? '?');
        if ($r['action'] === 'grades.unlock' && !empty($d['until'])) $parts[] = 'Hasta el ' . $d['until'];
        if (!empty($d['reason'])) $parts[] = (string) $d['reason'];
        if ($r['action'] === 'student.write_off' && !empty($d['items'])) {
            $parts[] = implode(', ', array_map(static fn($i) => $i['description'] . ' ' . $money($i['balance']), (array) $d['items']));
            if (!empty($d['lateFees'])) $parts[] = 'incluye ' . $money($d['lateFees']) . ' de mora';
            unset($d['charges']); // already in the list
        }
        if (!empty($d['validUntil'])) $parts[] = 'Solo si paga hasta el ' . $d['validUntil'];
        if (!empty($d['method'])) $parts[] = ucfirst((string) $d['method']) . (!empty($d['reference']) ? ' · ' . $d['reference'] : '');
        if (!empty($d['description'])) $parts[] = (string) $d['description'];
        foreach (['charges' => 'cobros', 'created' => 'creados', 'voided' => 'anulados'] as $k => $l) if (isset($d[$k]) && is_numeric($d[$k])) $parts[] = $d[$k] . " $l";
        return implode(' · ', $parts);
    }

    /** @return array{0:list<string>,1:list<mixed>} */
    private function portalFilter(Request $req, string $alias): array
    {
        $portal = (string) $req->query('portal', 'todos');
        return in_array($portal, ['familia', 'panel'], true) ? [["$alias.portal = ?"], [$portal]] : [['1=1'], []];
    }
}
