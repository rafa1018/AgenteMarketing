<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Domain\Shared\DomainError;
use Gabush\Http\HttpError;
use Gabush\Http\Request;
use Gabush\Http\Router;
use Gabush\Http\Validate;

/**
 * Messages to the staff: the rectora / administration (permission "usuarios" or "personal") writes to everyone,
 * to a role (docentes, auxiliares…) or to chosen people; each one reads them in "Mi bandeja" and gets a
 * notification on the phone when they turned them on. The sender sees who read it and when.
 */
final class StaffMessageController extends Controller
{
    private const ROLES = ['rectora' => 'Rectora', 'docente' => 'Docentes', 'auxiliar' => 'Auxiliares', 'personalizado' => 'Personalizados'];

    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/staff-messages/people', [$c, 'people']);
        $r->add('GET', '/staff-messages', [$c, 'index']);
        $r->add('GET', '/staff-messages/{id}', [$c, 'show']);
        $r->add('POST', '/staff-messages', [$c, 'send']);
        $r->add('DELETE', '/staff-messages/{id}', [$c, 'delete']);
        $r->add('GET', '/staff-inbox', [$c, 'inbox']);
        $r->add('POST', '/staff-inbox/{id}/read', [$c, 'markRead']);
    }

    /** Active panel users (users.json): [{id, name, role}]. */
    private function users(): array
    {
        $raw = json_decode((string) @file_get_contents($this->app->dataDir() . '/users.json'), true) ?: [];
        $out = [];
        foreach ((array) ($raw['users'] ?? []) as $u) {
            if (empty($u['active']) || empty($u['id'])) continue;
            $out[] = ['id' => (string) $u['id'], 'name' => (string) ($u['name'] ?? $u['user'] ?? $u['id']), 'role' => (string) ($u['role'] ?? '')];
        }
        usort($out, static fn($a, $b) => strcmp($a['name'], $b['name']));
        return $out;
    }

    /** Who can receive: the active panel users and the roles. */
    public function people(Request $req): array
    {
        $this->staff($req, 'usuarios', 'personal');
        return ['people' => $this->users(), 'roles' => self::ROLES];
    }

    public function index(Request $req): array
    {
        $this->staff($req, 'usuarios', 'personal');
        $rows = $this->db()->all(
            'SELECT m.id, m.subject, m.audience, m.sender_name AS sender, m.created_at AS createdAt, COUNT(r.user_id) AS recipients, SUM(r.read_at IS NOT NULL) AS readCount
             FROM staff_messages m LEFT JOIN staff_message_recipients r ON r.message_id = m.id GROUP BY m.id ORDER BY m.id DESC LIMIT 300',
        );
        return ['messages' => self::intsAll($rows, 'id', 'recipients', 'readCount')];
    }

    public function show(Request $req): array
    {
        $this->staff($req, 'usuarios', 'personal');
        $id = $req->intParam('id');
        $m = $this->db()->one('SELECT id, subject, body, audience, sender_name AS sender, created_at AS createdAt FROM staff_messages WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        $recipients = $this->db()->all('SELECT user_id AS id, user_name AS name, read_at AS readAt FROM staff_message_recipients WHERE message_id = ? ORDER BY read_at IS NULL DESC, user_name', [$id]);
        return ['message' => self::ints($m, 'id'), 'recipients' => $recipients];
    }

    /** {subject, body, audience: todos|rol|personas, role, userIds[]} */
    public function send(Request $req): array
    {
        $actor = $this->staffWrite($req, 'usuarios', 'personal');
        $v = Validate::of($req);
        $subject = $v->str('subject', 160, true, 'El asunto');
        $body = $v->text('body', 8000, true);
        $audience = $v->oneOf('audience', ['todos', 'rol', 'personas'], null, true);
        $v->check();
        $in = $req->json();
        $users = array_values(array_filter($this->users(), static fn($u) => $u['id'] !== $actor->id)); // not to oneself
        [$to, $label] = match ($audience) {
            'todos' => [$users, 'Todo el personal'],
            'rol' => (function () use ($users, $in): array {
                $role = (string) ($in['role'] ?? '');
                if (!isset(self::ROLES[$role])) throw HttpError::validation(['role' => 'Elige a quiénes (docentes, auxiliares…).']);
                return [array_values(array_filter($users, static fn($u) => $u['role'] === $role)), self::ROLES[$role]];
            })(),
            'personas' => (function () use ($users, $in): array {
                $ids = array_map('strval', (array) ($in['userIds'] ?? []));
                $sel = array_values(array_filter($users, static fn($u) => in_array($u['id'], $ids, true)));
                return [$sel, implode(', ', array_column($sel, 'name'))];
            })(),
        };
        if (!$to) throw new DomainError('nobody', 'No hay personas activas en ese destino.');
        $id = $this->db()->transaction(function ($db) use ($subject, $body, $label, $actor, $to): int {
            $id = $db->insert('staff_messages', ['subject' => $subject, 'body' => $body, 'audience' => mb_substr($label, 0, 160), 'sender_id' => $actor->id, 'sender_name' => $actor->name]);
            foreach ($to as $u) $db->run('INSERT IGNORE INTO staff_message_recipients (message_id, user_id, user_name) VALUES (?, ?, ?)', [$id, $u['id'], $u['name']]);
            return $id;
        });
        // phone notification to their devices (when they turned notifications on)
        if (function_exists('push_notify_users')) {
            \push_notify_users(array_column($to, 'id'), ['title' => '✉️ ' . $subject, 'body' => mb_substr(strip_tags($body), 0, 140) . ' — ' . $actor->name, 'url' => '/admin/#/bandeja', 'tag' => 'comunicado']);
        }
        $this->audit()->log($actor, 'staff_message.send', 'staff_message', $id, ['to' => $label, 'recipients' => count($to)]);
        return ['id' => $id, 'recipients' => count($to)];
    }

    public function delete(Request $req): array
    {
        $actor = $this->staffWrite($req, 'usuarios', 'personal');
        $id = $req->intParam('id');
        $this->db()->run('DELETE FROM staff_messages WHERE id = ?', [$id]);
        $this->audit()->log($actor, 'staff_message.delete', 'staff_message', $id);
        return [];
    }

    /** "Mi bandeja": the messages sent to me (any staff user), newest first, and how many are unread. */
    public function inbox(Request $req): array
    {
        $me = $this->staff($req);
        $rows = $this->db()->all(
            'SELECT m.id, m.subject, m.body, m.sender_name AS sender, m.created_at AS createdAt, r.read_at AS readAt
             FROM staff_message_recipients r JOIN staff_messages m ON m.id = r.message_id WHERE r.user_id = ? ORDER BY m.id DESC LIMIT 200',
            [$me->id],
        );
        return ['messages' => self::intsAll($rows, 'id'), 'unread' => count(array_filter($rows, static fn($r) => $r['readAt'] === null))];
    }

    public function markRead(Request $req): array
    {
        $me = $this->staffWrite($req);
        $this->db()->run('UPDATE staff_message_recipients SET read_at = NOW() WHERE message_id = ? AND user_id = ? AND read_at IS NULL', [$req->intParam('id'), $me->id]);
        return [];
    }
}
