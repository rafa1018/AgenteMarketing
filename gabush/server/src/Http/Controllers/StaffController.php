<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Application\Billing\Signature;
use Gabush\Domain\Shared\DomainError;
use Gabush\Http\HttpError;
use Gabush\Http\Request;
use Gabush\Http\Router;
use Gabush\Http\Validate;
use Gabush\Infrastructure\Storage\PrivateFiles;

/**
 * Teachers and staff: list with what each one has this year (group director, subjects), activate /
 * deactivate (deactivating frees their courses and subjects of the current and next years; earlier years keep
 * them, so the history of who taught what stays), delete only when never assigned, and their signature for
 * the report cards (image, or just the name).
 */
final class StaffController extends Controller
{
    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/staff', [$c, 'index']);
        $r->add('POST', '/staff', [$c, 'save']);
        $r->add('PUT', '/staff/{id}', [$c, 'save']);
        $r->add('DELETE', '/staff/{id}', [$c, 'delete']);
        $r->add('POST', '/staff/{id}/deactivate', [$c, 'deactivate']);
        $r->add('POST', '/staff/{id}/activate', [$c, 'activate']);
        $r->add('POST', '/staff/{id}/signature', [$c, 'saveSignature']);
        $r->add('DELETE', '/staff/{id}/signature', [$c, 'deleteSignature']);
    }

    private function files(): PrivateFiles
    {
        return $this->app->service(PrivateFiles::class, static fn(App $a) => new PrivateFiles($a->dataDir()));
    }

    /** ?q=&status=activo|inactivo|todos — with this year's assignments. */
    public function index(Request $req): array
    {
        $this->staff($req, 'academico', 'usuarios');
        $year = $this->year($req);
        $where = ['1=1'];
        $params = [$year, $year];
        $status = (string) $req->query('status', 'activo');
        if ($status === 'activo') $where[] = 's.active = 1';
        if ($status === 'inactivo') $where[] = 's.active = 0';
        if (($q = trim((string) $req->query('q', ''))) !== '') {
            $where[] = '(s.full_name LIKE ? OR s.position LIKE ? OR s.email LIKE ? OR s.phone LIKE ?)';
            array_push($params, "%$q%", "%$q%", "%$q%", "%$q%");
        }
        $rows = $this->db()->all(
            "SELECT s.id, s.full_name AS name, s.position, s.phone, s.email, s.user_id AS userId, s.active, s.inactive_since AS inactiveSince,
                    s.signature_path IS NOT NULL AS hasSignature,
                    (SELECT GROUP_CONCAT(c.name ORDER BY c.name SEPARATOR ', ') FROM courses c WHERE c.director_staff_id = s.id AND c.year_id = ?) AS directs,
                    (SELECT GROUP_CONCAT(DISTINCT CONCAT(sub.name, ' (', c.name, ')') ORDER BY c.name, sub.name SEPARATOR ' · ') FROM course_subjects cs JOIN courses c ON c.id = cs.course_id JOIN subjects sub ON sub.id = cs.subject_id WHERE cs.teacher_staff_id = s.id AND c.year_id = ?) AS teaches,
                    (SELECT MAX(c.year_id) FROM course_subjects cs JOIN courses c ON c.id = cs.course_id WHERE cs.teacher_staff_id = s.id) AS lastYear
             FROM staff s WHERE " . implode(' AND ', $where) . ' ORDER BY s.active DESC, s.full_name',
            $params,
        );
        $counts = $this->db()->one('SELECT SUM(active = 1) AS active, SUM(active = 0) AS inactive FROM staff');
        return ['year' => $year, 'staff' => self::intsAll($rows, 'id', 'active', 'hasSignature', 'lastYear'), 'counts' => ['active' => (int) $counts['active'], 'inactive' => (int) $counts['inactive']]];
    }

    public function save(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico', 'usuarios');
        $v = Validate::of($req);
        $row = ['full_name' => $v->str('name', 120, true, 'El nombre'), 'phone' => $v->str('phone', 40), 'email' => $v->email('email'), 'position' => $v->str('position', 60), 'user_id' => $v->str('userId', 64)];
        $v->check();
        $id = $this->persist('staff', $row, self::optionalId($req));
        $this->audit()->log($actor, 'staff.save', 'staff', $id, $row);
        return ['id' => $id];
    }

    /**
     * Inactive from today: removed as group director and as teacher in the courses of the current and next
     * years (the ones not closed). Closed years keep them — the report cards of those years still say who it was.
     */
    public function deactivate(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico', 'usuarios');
        $id = $req->intParam('id');
        $this->db()->one('SELECT id FROM staff WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        $r = $this->db()->transaction(function () use ($id): array {
            $this->db()->update('staff', ['active' => 0, 'inactive_since' => date('Y-m-d')], ['id' => $id]);
            $directs = $this->db()->run("UPDATE courses c JOIN academic_years y ON y.id = c.year_id AND y.status <> 'closed' SET c.director_staff_id = NULL WHERE c.director_staff_id = ?", [$id])->rowCount();
            $teaches = $this->db()->run("UPDATE course_subjects cs JOIN courses c ON c.id = cs.course_id JOIN academic_years y ON y.id = c.year_id AND y.status <> 'closed' SET cs.teacher_staff_id = NULL WHERE cs.teacher_staff_id = ?", [$id])->rowCount();
            return ['coursesFreed' => $directs, 'subjectsFreed' => $teaches];
        });
        $this->audit()->log($actor, 'staff.deactivate', 'staff', $id, $r);
        return $r;
    }

    public function activate(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico', 'usuarios');
        $id = $req->intParam('id');
        $this->db()->update('staff', ['active' => 1, 'inactive_since' => null], ['id' => $id]);
        $this->audit()->log($actor, 'staff.activate', 'staff', $id);
        return [];
    }

    /** Only someone who was never assigned anywhere; otherwise deactivate (keeps the history). */
    public function delete(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico', 'usuarios');
        $id = $req->intParam('id');
        $used = (int) $this->db()->value('SELECT (SELECT COUNT(*) FROM courses WHERE director_staff_id = ?) + (SELECT COUNT(*) FROM course_subjects WHERE teacher_staff_id = ?)', [$id, $id]);
        if ($used > 0) throw new DomainError('in_use', 'Esta persona tiene cursos o materias en su historial: inactívala en lugar de eliminarla, así se conserva quién dio cada materia.');
        $sig = $this->db()->value('SELECT signature_path FROM staff WHERE id = ?', [$id]);
        $this->db()->run('DELETE FROM staff WHERE id = ?', [$id]);
        if ($sig) $this->files()->delete($sig);
        $this->audit()->log($actor, 'staff.delete', 'staff', $id);
        return [];
    }

    /** multipart: file, clean (1/0) */
    public function saveSignature(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico', 'usuarios');
        $id = $req->intParam('id');
        $old = $this->db()->one('SELECT signature_path FROM staff WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        $upload = $req->files['file'] ?? throw HttpError::validation(['file' => 'Elige la imagen de la firma.']);
        $path = Signature::storeImage($this->files(), $upload, ($req->post['clean'] ?? '1') !== '0', "signature/staff-$id");
        $this->db()->update('staff', ['signature_path' => $path], ['id' => $id]);
        if ($old['signature_path'] && $old['signature_path'] !== $path) $this->files()->delete($old['signature_path']);
        $this->audit()->log($actor, 'staff.signature', 'staff', $id);
        return ['signature' => Signature::dataUri($this->files(), $path)];
    }

    public function deleteSignature(Request $req): array
    {
        $actor = $this->staffWrite($req, 'academico', 'usuarios');
        $id = $req->intParam('id');
        $path = $this->db()->value('SELECT signature_path FROM staff WHERE id = ?', [$id]);
        $this->db()->update('staff', ['signature_path' => null], ['id' => $id]);
        if ($path) $this->files()->delete($path);
        $this->audit()->log($actor, 'staff.signature_delete', 'staff', $id);
        return [];
    }
}
