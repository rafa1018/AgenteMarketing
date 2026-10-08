<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Application\Academics\GradesService;
use Gabush\Application\Billing\BillingService;
use Gabush\Application\Payments\CheckoutService;
use Gabush\Application\Portal\PortalAccounts;
use Gabush\Application\Shared\Actor;
use Gabush\Domain\Shared\DomainError;
use Gabush\Http\Auth\FamilyAuth;
use Gabush\Http\HttpError;
use Gabush\Http\Request;
use Gabush\Http\Router;
use Gabush\Http\Validate;

/**
 * Family portal (/familia/): everything a family sees about ITS student — never anyone else's.
 * Every route takes the student from the session, not from the URL.
 */
final class PortalController extends Controller
{
    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        // session
        $r->add('POST', '/portal/login', [$c, 'login']);
        $r->add('POST', '/portal/logout', [$c, 'logout']);
        $r->add('GET', '/portal/me', [$c, 'me']);
        $r->add('POST', '/portal/password', [$c, 'password']);
        $r->add('POST', '/portal/forgot', [$c, 'forgot']);
        $r->add('POST', '/portal/reset', [$c, 'reset']);
        // content
        $r->add('GET', '/portal/home', [$c, 'home']);
        $r->add('GET', '/portal/notifications', [$c, 'notifications']);
        $r->add('POST', '/portal/notifications/read', [$c, 'readNotifications']);
        $r->add('GET', '/portal/messages', [$c, 'messages']);
        $r->add('GET', '/portal/messages/{id}', [$c, 'message']);
        $r->add('GET', '/portal/subjects', [$c, 'subjects']);
        $r->add('GET', '/portal/calendar', [$c, 'calendar']);
        $r->add('GET', '/portal/attendance', [$c, 'attendance']);
        $r->add('GET', '/portal/grades', [$c, 'grades']);
        $r->add('GET', '/portal/observations', [$c, 'observations']);
        $r->add('GET', '/portal/account', [$c, 'account']);
        $r->add('POST', '/portal/checkout', [$c, 'checkout']);
        $r->add('GET', '/portal/checkout/{reference}', [$c, 'checkoutState']);
        $r->add('GET', '/portal/documents', [$c, 'documents']);
        $r->add('POST', '/portal/documents/{type}', [$c, 'uploadDocument']);
        $r->add('POST', '/portal/push', [$c, 'subscribe']);
        $r->add('DELETE', '/portal/push', [$c, 'unsubscribe']);
        // panel: accounts
        $r->add('GET', '/portal-accounts', [$c, 'accounts']);
        $r->add('POST', '/portal-accounts/issue', [$c, 'issue']);
        $r->add('PUT', '/portal-accounts/{id}', [$c, 'toggle']);
    }

    private function accountsSvc(): PortalAccounts
    {
        return PortalAccounts::from($this->app);
    }

    private function family(Request $req, bool $write = false): Actor
    {
        return FamilyAuth::require($req, $write);
    }

    // ───────────────────────── session ─────────────────────────
    public function login(Request $req): array
    {
        $v = Validate::of($req);
        $user = $v->str('username', 40, true, 'El usuario');
        $pass = (string) ($req->json()['password'] ?? '');
        $v->check();
        usleep(random_int(150000, 350000)); // slows down guessing
        $a = $this->accountsSvc()->authenticate((string) $user, $pass);
        $csrf = FamilyAuth::login($a['student_id'], $a['username']);
        return ['csrf' => $csrf, 'mustChangePassword' => $a['must_change']] + $this->profile($a['student_id']);
    }

    public function logout(Request $req): array
    {
        FamilyAuth::logout();
        return [];
    }

    public function me(Request $req): array
    {
        $f = $this->family($req);
        $must = (bool) $this->db()->value('SELECT must_change_password FROM portal_accounts WHERE student_id = ?', [$f->studentId]);
        return ['csrf' => FamilyAuth::csrf(), 'mustChangePassword' => $must] + $this->profile((int) $f->studentId);
    }

    /** @return array<string,mixed> */
    private function profile(int $studentId): array
    {
        $year = $this->settings()->activeYear();
        $s = $this->db()->one(
            'SELECT s.id, s.code, s.first_name AS firstName, s.middle_name AS middleName, s.last_name AS lastName, s.second_last_name AS secondLastName, s.birth_date AS birthDate,
                    s.photo_path IS NOT NULL AS hasPhoto, c.name AS course, e.status, g.name AS gradeLevel, st.full_name AS director
             FROM students s
             LEFT JOIN enrollments e ON e.student_id = s.id AND e.year_id = ?
             LEFT JOIN courses c ON c.id = e.course_id LEFT JOIN grade_levels g ON g.id = c.grade_level_id LEFT JOIN staff st ON st.id = c.director_staff_id
             WHERE s.id = ?',
            [$year, $studentId],
        );
        $guardians = $this->db()->all('SELECT full_name AS name, relationship FROM guardians WHERE family_id = (SELECT family_id FROM students WHERE id = ?) ORDER BY is_primary DESC', [$studentId]);
        $years = array_map('intval', array_column($this->db()->all('SELECT year_id FROM enrollments WHERE student_id = ? ORDER BY year_id DESC', [$studentId]), 'year_id'));
        $vapid = function_exists('push_vapid') ? \push_vapid()['public'] : null;
        $c = (array) $this->settings()->get('payments', []);
        return ['student' => self::ints($s ?? [], 'id', 'hasPhoto'), 'guardians' => $guardians, 'year' => $year, 'years' => $years, 'vapidKey' => $vapid, 'onlinePayments' => !empty($c['provider']), 'school' => $this->settings()->get('school', ['name' => 'Jardín Infantil Gabush'])];
    }

    public function password(Request $req): array
    {
        $f = $this->family($req, true);
        $j = $req->json();
        $this->accountsSvc()->changePassword((int) $f->studentId, (string) ($j['current'] ?? ''), (string) ($j['password'] ?? ''));
        $this->audit()->log($f, 'portal.password', 'student', $f->studentId);
        return [];
    }

    public function forgot(Request $req): array
    {
        $v = Validate::of($req);
        $user = $v->str('username', 40, true, 'El usuario');
        $v->check();
        $this->accountsSvc()->requestReset((string) $user);
        return ['message' => 'Si el usuario existe, enviamos un enlace al correo de la familia registrado en el jardín.'];
    }

    public function reset(Request $req): array
    {
        $j = $req->json();
        $this->accountsSvc()->reset((string) ($j['token'] ?? ''), (string) ($j['password'] ?? ''));
        return [];
    }

    // ───────────────────────── content ─────────────────────────
    public function home(Request $req): array
    {
        $f = $this->family($req);
        $sid = (int) $f->studentId;
        $year = $this->settings()->activeYear();
        $b = BillingService::from($this->app);
        $open = $b->charges($sid, null, true);
        usort($open, static fn($x, $y) => strcmp((string) $x['dueOn'], (string) $y['dueOn']));
        $att = AttendanceController::historyOf($this->app, $sid, $year);
        return [
            'balance' => $b->summary($sid),
            'nextDue' => $open[0] ?? null,
            'unreadMessages' => (int) $this->db()->value('SELECT COUNT(*) FROM message_recipients WHERE student_id = ? AND read_at IS NULL', [$sid]),
            'unreadNotifications' => (int) $this->db()->value('SELECT COUNT(*) FROM notifications WHERE student_id = ? AND read_at IS NULL', [$sid]),
            'notifications' => self::intsAll($this->db()->all('SELECT id, kind, title, body, url, read_at AS readAt, created_at AS createdAt FROM notifications WHERE student_id = ? ORDER BY id DESC LIMIT 6', [$sid]), 'id'),
            'attendance' => $att['totals'],
            'events' => array_slice($this->publicEvents(date('Y-m-d')), 0, 4),
            'documentsPending' => (int) $this->db()->value("SELECT COUNT(*) FROM enrollment_documents d JOIN enrollments e ON e.id = d.enrollment_id JOIN document_types t ON t.id = d.document_type_id WHERE e.student_id = ? AND e.year_id = ? AND t.required = 1 AND d.status IN ('pendiente','rechazado')", [$sid, $year]),
        ];
    }

    public function notifications(Request $req): array
    {
        $f = $this->family($req);
        return ['notifications' => self::intsAll($this->db()->all('SELECT id, kind, title, body, url, read_at AS readAt, created_at AS createdAt FROM notifications WHERE student_id = ? ORDER BY id DESC LIMIT 100', [$f->studentId]), 'id')];
    }

    public function readNotifications(Request $req): array
    {
        $f = $this->family($req, true);
        $this->db()->run('UPDATE notifications SET read_at = NOW() WHERE student_id = ? AND read_at IS NULL', [$f->studentId]);
        return [];
    }

    public function messages(Request $req): array
    {
        $f = $this->family($req);
        $rows = $this->db()->all('SELECT m.id, m.subject, m.kind, m.due_on AS dueOn, m.created_by AS createdBy, m.created_at AS createdAt, r.read_at AS readAt, LEFT(m.body, 160) AS preview FROM message_recipients r JOIN messages m ON m.id = r.message_id WHERE r.student_id = ? ORDER BY m.id DESC LIMIT 200', [$f->studentId]);
        return ['messages' => self::intsAll($rows, 'id')];
    }

    public function message(Request $req): array
    {
        $f = $this->family($req);
        $id = $req->intParam('id');
        $m = $this->db()->one('SELECT m.id, m.subject, m.body, m.kind, m.due_on AS dueOn, m.created_by AS createdBy, m.created_at AS createdAt FROM message_recipients r JOIN messages m ON m.id = r.message_id WHERE r.student_id = ? AND m.id = ?', [$f->studentId, $id]) ?? throw HttpError::notFound();
        $this->db()->run('UPDATE message_recipients SET read_at = COALESCE(read_at, NOW()) WHERE message_id = ? AND student_id = ?', [$id, $f->studentId]);
        return ['message' => self::ints($m, 'id')];
    }

    /** Subjects of the student's course in a year, with teachers and the course director. */
    public function subjects(Request $req): array
    {
        $f = $this->family($req);
        $year = $this->year($req);
        $rows = $this->db()->all(
            'SELECT sub.name AS subject, a.name AS area, st.full_name AS teacher
             FROM enrollments e JOIN course_subjects cs ON cs.course_id = e.course_id JOIN subjects sub ON sub.id = cs.subject_id
             LEFT JOIN areas a ON a.id = sub.area_id LEFT JOIN staff st ON st.id = cs.teacher_staff_id
             WHERE e.student_id = ? AND e.year_id = ? ORDER BY a.report_position, sub.name',
            [$f->studentId, $year],
        );
        $course = $this->db()->one('SELECT c.name, st.full_name AS director FROM enrollments e JOIN courses c ON c.id = e.course_id LEFT JOIN staff st ON st.id = c.director_staff_id WHERE e.student_id = ? AND e.year_id = ?', [$f->studentId, $year]);
        return ['year' => $year, 'course' => $course, 'subjects' => $rows];
    }

    /** Public events of the school calendar (the panel keeps them in events.json). */
    private function publicEvents(string $from = '0000-00-00'): array
    {
        $file = \rp_data_dir() . '/events.json';
        $events = is_file($file) ? (json_decode((string) file_get_contents($file), true)['events'] ?? []) : [];
        $events = array_values(array_filter($events, static fn($e) => ($e['visibility'] ?? 'publico') !== 'privado' && ($e['end'] ?? $e['start'] ?? '') >= $from));
        usort($events, static fn($a, $b) => strcmp((string) $a['start'], (string) $b['start']));
        return array_map(static fn($e) => ['title' => $e['title'], 'description' => $e['description'] ?? '', 'type' => $e['type'] ?? 'evento', 'color' => $e['color'] ?? null, 'start' => $e['start'], 'end' => $e['end'] ?? $e['start']], $events);
    }

    public function calendar(Request $req): array
    {
        $this->family($req);
        return ['events' => $this->publicEvents((string) $req->query('from', date('Y-01-01')))];
    }

    public function attendance(Request $req): array
    {
        $f = $this->family($req);
        return AttendanceController::historyOf($this->app, (int) $f->studentId, $this->year($req));
    }

    public function grades(Request $req): array
    {
        $f = $this->family($req);
        return ['reportCard' => GradesService::from($this->app)->reportCard((int) $f->studentId, $this->year($req), true)];
    }

    public function observations(Request $req): array
    {
        $f = $this->family($req);
        return ['observations' => self::intsAll($this->db()->all('SELECT id, observed_on AS date, category, body, created_by AS createdBy FROM observations WHERE student_id = ? AND visible_to_family = 1 ORDER BY observed_on DESC', [$f->studentId]), 'id')];
    }

    /** Pending and paid charges, payments with receipts. ?year= limits to one academic year. */
    public function account(Request $req): array
    {
        $f = $this->family($req);
        $sid = (int) $f->studentId;
        $year = $req->query('year') ? (int) $req->query('year') : null;
        $b = BillingService::from($this->app);
        $c = (array) $this->settings()->get('payments', []);
        return [
            'summary' => $b->summary($sid, $year),
            'total' => $b->summary($sid),
            'charges' => $b->charges($sid, $year),
            'payments' => array_values(array_filter($b->payments($sid, $year), static fn($p) => $p['status'] === 'aprobado')),
            'onlinePayments' => !empty($c['provider']),
            'provider' => $c['provider'] ?? null,
            'lateFee' => $b->lateFeePolicy()->toArray(),
        ];
    }

    public function checkout(Request $req): array
    {
        $f = $this->family($req, true);
        $ids = Validate::of($req)->ids('chargeIds');
        return CheckoutService::from($this->app)->start((int) $f->studentId, $ids, $f);
    }

    public function checkoutState(Request $req): array
    {
        $f = $this->family($req);
        $tx = (string) ($req->query('id') ?? $req->query('payment_id') ?? '');
        return ['checkout' => CheckoutService::from($this->app)->refresh($req->param('reference'), (int) $f->studentId, $tx ?: null)];
    }

    public function documents(Request $req): array
    {
        $f = $this->family($req);
        $year = $this->settings()->activeYear();
        $e = $this->db()->one('SELECT id, is_new FROM enrollments WHERE student_id = ? AND year_id = ?', [$f->studentId, $year]);
        if (!$e) return ['documents' => []];
        $ctl = new EnrollmentController($this->app);
        $this->db()->run("INSERT IGNORE INTO enrollment_documents (enrollment_id, document_type_id) SELECT ?, id FROM document_types WHERE active = 1 AND (applies_to = 'todos' OR ? = 1)", [$e['id'], $e['is_new']]);
        return ['enrollmentId' => (int) $e['id'], 'documents' => $ctl->documentList((int) $e['id'])];
    }

    public function uploadDocument(Request $req): array
    {
        $f = $this->family($req, true);
        $year = $this->settings()->activeYear();
        $eid = (int) ($this->db()->value('SELECT id FROM enrollments WHERE student_id = ? AND year_id = ?', [$f->studentId, $year]) ?? throw HttpError::notFound());
        $ctl = new EnrollmentController($this->app);
        $docs = $ctl->storeDocument($req, $eid, $req->intParam('type'), $f);
        if (function_exists('push_notify')) @\push_notify('inscripciones', ['title' => 'Documento recibido', 'body' => 'Una familia subió un documento de matrícula.', 'url' => '/admin/#/matriculas', 'tag' => 'documento']);
        return ['documents' => $docs];
    }

    /** {endpoint, keys:{p256dh, auth}, prefs?} from the browser's PushManager. */
    public function subscribe(Request $req): array
    {
        $f = $this->family($req, true);
        $j = $req->json();
        $endpoint = (string) ($j['endpoint'] ?? '');
        if (!preg_match('#^https://#', $endpoint) || empty($j['keys']['p256dh']) || empty($j['keys']['auth'])) throw HttpError::validation(['endpoint' => 'Suscripción inválida.']);
        $this->db()->run(
            'INSERT INTO push_subscriptions (student_id, endpoint, endpoint_hash, p256dh, auth, prefs, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE student_id = VALUES(student_id), p256dh = VALUES(p256dh), auth = VALUES(auth), prefs = VALUES(prefs)',
            [$f->studentId, $endpoint, hash('sha256', $endpoint), (string) $j['keys']['p256dh'], (string) $j['keys']['auth'], json_encode($j['prefs'] ?? new \stdClass()), mb_substr($req->header('user-agent'), 0, 200)],
        );
        return [];
    }

    public function unsubscribe(Request $req): array
    {
        $f = $this->family($req, true);
        $endpoint = (string) ($req->json()['endpoint'] ?? '');
        $this->db()->run('DELETE FROM push_subscriptions WHERE endpoint_hash = ? AND student_id = ?', [hash('sha256', $endpoint), $f->studentId]);
        return [];
    }

    // ───────────────────────── panel: accounts ─────────────────────────
    public function accounts(Request $req): array
    {
        $this->staff($req, 'estudiantes', 'matriculas');
        $year = $this->year($req);
        $rows = $this->db()->all(
            "SELECT s.id, s.code, s.first_name AS firstName, s.last_name AS lastName, c.name AS course, e.status,
                    pa.active, pa.must_change_password AS mustChange, pa.last_login_at AS lastLogin, pa.created_at AS createdAt,
                    (SELECT COUNT(*) FROM push_subscriptions ps WHERE ps.student_id = s.id) AS devices,
                    (SELECT COUNT(*) FROM guardians g WHERE g.family_id = s.family_id AND g.email IS NOT NULL) AS emails
             FROM enrollments e JOIN students s ON s.id = e.student_id LEFT JOIN courses c ON c.id = e.course_id
             LEFT JOIN portal_accounts pa ON pa.student_id = s.id
             WHERE e.year_id = ? AND e.status IN ('activo','prematricula') ORDER BY c.name, s.last_name",
            [$year],
        );
        return ['accounts' => self::intsAll($rows, 'id', 'active', 'mustChange', 'devices', 'emails')];
    }

    /** {studentIds:[...]} or {all:true, onlyMissing:true}, sendEmail → temporary passwords (shown once, to print/share). */
    public function issue(Request $req): array
    {
        $actor = $this->staffWrite($req, 'estudiantes', 'matriculas');
        $v = Validate::of($req);
        $ids = $v->ids('studentIds');
        $send = $v->bool('sendEmail');
        if ($v->bool('all')) {
            $sql = "SELECT e.student_id FROM enrollments e WHERE e.year_id = ? AND e.status = 'activo'" . ($v->bool('onlyMissing', true) ? ' AND NOT EXISTS (SELECT 1 FROM portal_accounts pa WHERE pa.student_id = e.student_id)' : '');
            $ids = array_map('intval', array_column($this->db()->all($sql, [$this->settings()->activeYear()]), 'student_id'));
        }
        if (!$ids) throw new DomainError('empty', 'No hay estudiantes para crear acceso.');
        $out = [];
        foreach ($ids as $id) $out[] = $this->accountsSvc()->issue($id, $send);
        $this->audit()->log($actor, 'portal.issue', 'portal_accounts', null, ['count' => count($out)]);
        return ['credentials' => $out];
    }

    public function toggle(Request $req): array
    {
        $actor = $this->staffWrite($req, 'estudiantes', 'matriculas');
        $active = Validate::of($req)->bool('active', true);
        $this->db()->run('UPDATE portal_accounts SET active = ? WHERE student_id = ?', [$active ? 1 : 0, $req->intParam('id')]);
        $this->audit()->log($actor, $active ? 'portal.enable' : 'portal.disable', 'student', $req->intParam('id'));
        return [];
    }
}
