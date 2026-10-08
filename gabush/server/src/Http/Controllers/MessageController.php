<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Application\Notifications\Notifier;
use Gabush\Http\HttpError;
use Gabush\Http\Request;
use Gabush\Http\Router;
use Gabush\Http\Validate;

/** Messages, activities and circulars to the families' inbox (everyone, a course or one student). */
final class MessageController extends Controller
{
    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/messages', [$c, 'index']);
        $r->add('GET', '/messages/{id}', [$c, 'show']);
        $r->add('POST', '/messages', [$c, 'send']);
        $r->add('DELETE', '/messages/{id}', [$c, 'delete']);
    }

    public function index(Request $req): array
    {
        $this->staff($req, 'mensajes');
        $rows = $this->db()->all(
            "SELECT m.id, m.subject, m.kind, m.audience, m.audience_id AS audienceId, m.due_on AS dueOn, m.send_email AS sendEmail, m.created_by AS createdBy, m.created_at AS createdAt,
                    COUNT(r.student_id) AS recipients, SUM(r.read_at IS NOT NULL) AS readCount,
                    CASE m.audience WHEN 'curso' THEN (SELECT name FROM courses WHERE id = m.audience_id)
                                    WHEN 'estudiante' THEN (SELECT CONCAT(first_name, ' ', last_name) FROM students WHERE id = m.audience_id) ELSE 'Todas las familias' END AS audienceName
             FROM messages m LEFT JOIN message_recipients r ON r.message_id = m.id
             GROUP BY m.id ORDER BY m.id DESC LIMIT 300"
        );
        return ['messages' => self::intsAll($rows, 'id', 'audienceId', 'sendEmail', 'recipients', 'readCount')];
    }

    public function show(Request $req): array
    {
        $this->staff($req, 'mensajes');
        $id = $req->intParam('id');
        $m = $this->db()->one('SELECT id, subject, body, kind, audience, audience_id AS audienceId, due_on AS dueOn, send_email AS sendEmail, created_by AS createdBy, created_at AS createdAt FROM messages WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        $recipients = $this->db()->all('SELECT s.id, s.code, s.first_name AS firstName, s.last_name AS lastName, r.read_at AS readAt FROM message_recipients r JOIN students s ON s.id = r.student_id WHERE r.message_id = ? ORDER BY r.read_at IS NULL DESC, s.first_name', [$id]);
        return ['message' => self::ints($m, 'id', 'audienceId', 'sendEmail'), 'recipients' => self::intsAll($recipients, 'id')];
    }

    /** {subject, body, kind, audience: todos|curso|estudiante, audienceId, dueOn, sendEmail} */
    public function send(Request $req): array
    {
        $actor = $this->staffWrite($req, 'mensajes');
        $v = Validate::of($req);
        $row = [
            'subject' => $v->str('subject', 160, true, 'El asunto'),
            'body' => $v->text('body', 8000, true),
            'kind' => $v->oneOf('kind', ['mensaje', 'actividad', 'circular', 'recordatorio'], 'mensaje'),
            'audience' => $v->oneOf('audience', ['todos', 'curso', 'estudiante'], null, true),
            'audience_id' => $v->int('audienceId', 1),
            'due_on' => $v->date('dueOn'),
            'send_email' => $v->bool('sendEmail'),
        ];
        if ($row['audience'] !== 'todos' && !$row['audience_id']) $v->fail('audienceId', 'Elige el curso o el estudiante.');
        $v->check();
        $year = $this->settings()->activeYear();
        $students = match ($row['audience']) {
            'todos' => array_column($this->db()->all("SELECT student_id FROM enrollments WHERE year_id = ? AND status = 'activo'", [$year]), 'student_id'),
            'curso' => array_column($this->db()->all("SELECT student_id FROM enrollments WHERE course_id = ? AND status = 'activo'", [$row['audience_id']]), 'student_id'),
            'estudiante' => [$row['audience_id']],
        };
        if (!$students) throw HttpError::validation(['audience' => 'No hay estudiantes activos en ese destino.']);
        $id = $this->db()->transaction(function ($db) use ($row, $actor, $students): int {
            $id = $db->insert('messages', $row + ['created_by' => $actor->label()]);
            foreach ($students as $sid) $db->run('INSERT IGNORE INTO message_recipients (message_id, student_id) VALUES (?, ?)', [$id, $sid]);
            return $id;
        });
        $n = Notifier::from($this->app);
        foreach ($students as $sid) $n->messageSent($id, (int) $sid, $row['subject'], $row['body'], (bool) $row['send_email']);
        $this->audit()->log($actor, 'message.send', 'message', $id, ['recipients' => count($students)]);
        return ['id' => $id, 'recipients' => count($students)];
    }

    public function delete(Request $req): array
    {
        $actor = $this->staffWrite($req, 'mensajes');
        $id = $req->intParam('id');
        $this->db()->run('DELETE FROM messages WHERE id = ?', [$id]);
        $this->audit()->log($actor, 'message.delete', 'message', $id);
        return [];
    }
}
