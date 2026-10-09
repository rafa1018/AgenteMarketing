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
        if (in_array($ev = (string) $req->query('event', ''), ['ingreso', 'salida', 'fallido'], true)) { $where[] = 'a.event = ?'; $p[] = $ev; }
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

    /** @return array{0:list<string>,1:list<mixed>} */
    private function portalFilter(Request $req, string $alias): array
    {
        $portal = (string) $req->query('portal', 'todos');
        return in_array($portal, ['familia', 'panel'], true) ? [["$alias.portal = ?"], [$portal]] : [['1=1'], []];
    }
}
