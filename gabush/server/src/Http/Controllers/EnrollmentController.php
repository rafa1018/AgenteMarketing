<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Application\Billing\BillingService;
use Gabush\Application\Shared\Actor;
use Gabush\Domain\Enrollment\EnrollmentRules;
use Gabush\Http\Auth\FamilyAuth;
use Gabush\Http\HttpError;
use Gabush\Http\Request;
use Gabush\Http\Response;
use Gabush\Http\Router;
use Gabush\Http\Validate;
use Gabush\Infrastructure\Storage\PrivateFiles;

/**
 * Enrollment of a student in a year (prematrícula / activo / retirado), the course and its capacity,
 * required documents (configurable list; uploaded by the rectora or by the family) and inscriptions.
 */
final class EnrollmentController extends Controller
{
    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('POST', '/enrollments', [$c, 'enroll']);
        $r->add('PUT', '/enrollments/{id}', [$c, 'update']);
        $r->add('POST', '/enrollments/{id}/status', [$c, 'changeStatus']);
        $r->add('POST', '/enrollments/promote', [$c, 'promote']);
        $r->add('GET', '/enrollments/{id}/documents', [$c, 'documents']);
        $r->add('POST', '/enrollments/{id}/documents/{type}', [$c, 'uploadDocument']);
        $r->add('PUT', '/enrollment-documents/{id}', [$c, 'reviewDocument']);
        $r->add('GET', '/enrollment-documents/{id}/file', [$c, 'documentFile']);
        $r->add('POST', '/document-types', [$c, 'saveDocType']);
        $r->add('PUT', '/document-types/{id}', [$c, 'saveDocType']);
        $r->add('DELETE', '/document-types/{id}', [$c, 'deleteDocType']);
        $r->add('GET', '/inscriptions', [$c, 'inscriptions']);
        $r->add('PUT', '/inscriptions/{id}', [$c, 'updateInscription']);
    }

    private function files(): PrivateFiles
    {
        return $this->app->service(PrivateFiles::class, static fn(App $a) => new PrivateFiles($a->dataDir()));
    }

    private function billing(): BillingService
    {
        return BillingService::from($this->app);
    }

    private function occupied(int $courseId, ?int $exceptEnrollment = null): int
    {
        return (int) $this->db()->value("SELECT COUNT(*) FROM enrollments WHERE course_id = ? AND status IN ('activo','prematricula') AND id <> ?", [$courseId, $exceptEnrollment ?? 0]);
    }

    private function checkCapacity(int $courseId, ?int $exceptEnrollment = null): void
    {
        $c = $this->db()->one('SELECT name, capacity FROM courses WHERE id = ?', [$courseId]) ?? throw HttpError::notFound('course');
        EnrollmentRules::assertCapacity($this->occupied($courseId, $exceptEnrollment), (int) $c['capacity'], $c['name']);
    }

    /** Creates the document checklist of an enrollment from the active document types. */
    private function seedDocuments(int $enrollmentId, bool $isNew): void
    {
        $this->db()->run(
            "INSERT IGNORE INTO enrollment_documents (enrollment_id, document_type_id)
             SELECT ?, id FROM document_types WHERE active = 1 AND (applies_to = 'todos' OR ? = 1)",
            [$enrollmentId, $isNew ? 1 : 0],
        );
    }

    /** Enroll an existing student in a year (prematrícula by default). */
    public function enroll(Request $req): array
    {
        $actor = $this->staffWrite($req, 'matriculas');
        $v = Validate::of($req);
        $studentId = $v->int('studentId', 1, null, true);
        $year = $v->int('year', 2000, 2100, true);
        $courseId = $v->int('courseId', 1);
        $status = $v->oneOf('status', ['prematricula', 'activo'], 'prematricula');
        $v->check();
        if ($this->db()->value('SELECT 1 FROM enrollments WHERE student_id = ? AND year_id = ?', [$studentId, $year])) {
            throw HttpError::conflict('exists', "El estudiante ya tiene matrícula en $year.");
        }
        if ($courseId) $this->checkCapacity($courseId);
        $isNew = !$this->db()->value('SELECT 1 FROM enrollments WHERE student_id = ?', [$studentId]);
        $id = $this->db()->insert('enrollments', ['student_id' => $studentId, 'year_id' => $year, 'course_id' => $courseId, 'status' => $status, 'is_new' => $isNew, 'enrolled_on' => date('Y-m-d')]);
        $this->seedDocuments($id, $isNew);
        if ($status === 'activo') $this->billing()->onEnrollmentActivated($id, $actor);
        $this->audit()->log($actor, 'enrollment.create', 'enrollment', $id, compact('studentId', 'year', 'courseId', 'status'));
        return ['id' => $id];
    }

    /** Course, order number, contract signed. */
    public function update(Request $req): array
    {
        $actor = $this->staffWrite($req, 'matriculas');
        $id = $req->intParam('id');
        $e = $this->db()->one('SELECT * FROM enrollments WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        $v = Validate::of($req);
        $row = [];
        if ($v->has('courseId')) $row['course_id'] = $v->int('courseId', 1);
        if ($v->has('orderNumber')) $row['order_number'] = $v->int('orderNumber', 1, 9999);
        if ($v->has('contractSigned')) $row['contract_signed'] = $v->bool('contractSigned');
        $v->check();
        if (!empty($row['course_id']) && (int) $row['course_id'] !== (int) $e['course_id'] && $e['status'] !== 'retirado') $this->checkCapacity((int) $row['course_id'], $id);
        if ($row) $this->db()->update('enrollments', $row, ['id' => $id]);
        $this->audit()->log($actor, 'enrollment.update', 'enrollment', $id, $row);
        return [];
    }

    /** prematrícula → activo (matricular), activo → retirado (retirar), retirado → activo (reintegrar). */
    public function changeStatus(Request $req): array
    {
        $actor = $this->staffWrite($req, 'matriculas');
        $id = $req->intParam('id');
        $e = $this->db()->one('SELECT * FROM enrollments WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        $v = Validate::of($req);
        $to = $v->oneOf('status', EnrollmentRules::STATES, null, true);
        $reason = $v->str('reason', 200);
        $date = $v->date('date') ?? date('Y-m-d');
        $v->check();
        EnrollmentRules::assertTransition($e['status'], $to);
        if ($to !== 'retirado' && $e['status'] === 'retirado' && $e['course_id']) $this->checkCapacity((int) $e['course_id'], $id);
        $row = ['status' => $to];
        if ($to === 'retirado') { $row['withdrawn_on'] = $date; $row['withdraw_reason'] = $reason; }
        else { $row['withdrawn_on'] = null; $row['withdraw_reason'] = null; }
        if ($to === 'activo' && !$e['enrolled_on']) $row['enrolled_on'] = $date;
        $this->db()->update('enrollments', $row, ['id' => $id]);
        if ($to === 'activo') $this->billing()->onEnrollmentActivated($id, $actor);
        if ($to === 'retirado') $this->billing()->onEnrollmentWithdrawn($id, $date, $actor);
        $this->audit()->log($actor, 'enrollment.status', 'enrollment', $id, ['from' => $e['status'], 'to' => $to, 'reason' => $reason]);
        return [];
    }

    /**
     * Pre-enroll for next year every student active in $from, in the course of the next grade level with the
     * same letter (Párvulos A → PreJardín A). Students of the last grade (Transición) graduate: not included.
     */
    public function promote(Request $req): array
    {
        $actor = $this->staffWrite($req, 'matriculas');
        $v = Validate::of($req);
        $from = $v->int('from', 2000, 2100, true);
        $to = $v->int('to', 2000, 2100, true);
        $v->check();
        $levels = $this->db()->all('SELECT id, name, sort FROM grade_levels WHERE active = 1 ORDER BY sort');
        $next = [];
        foreach ($levels as $i => $l) $next[(int) $l['id']] = $levels[$i + 1]['id'] ?? null;
        $targets = $this->db()->all('SELECT id, name, grade_level_id FROM courses WHERE year_id = ?', [$to]);
        if (!$targets) throw HttpError::conflict('no_courses', "Primero crea el año $to con sus cursos.");
        $rows = $this->db()->all(
            "SELECT e.student_id, c.name AS course, c.grade_level_id FROM enrollments e JOIN courses c ON c.id = e.course_id
             WHERE e.year_id = ? AND e.status = 'activo' AND NOT EXISTS (SELECT 1 FROM enrollments x WHERE x.student_id = e.student_id AND x.year_id = ?)",
            [$from, $to],
        );
        $done = 0;
        $graduates = 0;
        foreach ($rows as $r) {
            $ng = $next[(int) $r['grade_level_id']] ?? null;
            if (!$ng) { $graduates++; continue; }
            $letter = preg_match('/\s([A-Z])$/u', $r['course'], $m) ? $m[1] : null;
            $cands = array_values(array_filter($targets, static fn($t) => (int) $t['grade_level_id'] === (int) $ng));
            $pick = null;
            foreach ($cands as $t) if ($letter && str_ends_with($t['name'], " $letter")) $pick = $t;
            $pick ??= $cands[0] ?? null;
            $eid = $this->db()->insert('enrollments', ['student_id' => $r['student_id'], 'year_id' => $to, 'course_id' => $pick['id'] ?? null, 'status' => 'prematricula', 'is_new' => 0]);
            $this->seedDocuments($eid, false);
            $done++;
        }
        $this->audit()->log($actor, 'enrollment.promote', 'academic_year', $to, ['from' => $from, 'count' => $done]);
        return ['promoted' => $done, 'graduates' => $graduates];
    }

    // ───────────────────────── documents ─────────────────────────
    /** @return list<array<string,mixed>> */
    public function documentList(int $enrollmentId): array
    {
        $rows = $this->db()->all(
            'SELECT t.id AS typeId, t.name, t.description, t.required, t.family_can_upload AS familyUpload,
                    d.id, d.status, d.file_name AS fileName, d.mime, d.uploaded_by AS uploadedBy, d.uploaded_at AS uploadedAt, d.note, d.reviewed_at AS reviewedAt
             FROM enrollment_documents d JOIN document_types t ON t.id = d.document_type_id
             WHERE d.enrollment_id = ? ORDER BY t.sort, t.name',
            [$enrollmentId],
        );
        return self::intsAll($rows, 'typeId', 'required', 'familyUpload', 'id');
    }

    public function documents(Request $req): array
    {
        $this->staff($req, 'matriculas', 'estudiantes');
        $id = $req->intParam('id');
        $e = $this->db()->one('SELECT is_new FROM enrollments WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        $this->seedDocuments($id, (bool) $e['is_new']); // types added later also show up
        return ['documents' => $this->documentList($id)];
    }

    /** Upload (or replace) the file of one required document — staff here; families use the portal route. */
    public function uploadDocument(Request $req): array
    {
        $actor = $this->staffWrite($req, 'matriculas', 'estudiantes');
        return ['documents' => $this->storeDocument($req, $req->intParam('id'), $req->intParam('type'), $actor)];
    }

    /** Shared by the panel and the portal. @return list<array<string,mixed>> */
    public function storeDocument(Request $req, int $enrollmentId, int $typeId, Actor $actor): array
    {
        $e = $this->db()->one('SELECT e.id, s.code FROM enrollments e JOIN students s ON s.id = e.student_id WHERE e.id = ?', [$enrollmentId]) ?? throw HttpError::notFound();
        $type = $this->db()->one('SELECT * FROM document_types WHERE id = ?', [$typeId]) ?? throw HttpError::notFound();
        if ($actor->type === 'family' && !$type['family_can_upload']) throw HttpError::forbidden();
        $current = $this->db()->value('SELECT status FROM enrollment_documents WHERE enrollment_id = ? AND document_type_id = ?', [$enrollmentId, $typeId]);
        if ($actor->type === 'family' && $current === 'aprobado') throw new HttpError(409, 'approved', 'Este documento ya fue aprobado por el jardín.');
        $file = $req->files['file'] ?? throw HttpError::validation(['file' => 'Elige el archivo.']);
        $stored = $this->files()->storeUpload($file, 'documents/' . $e['code'], 'doc' . $typeId, ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], 10_000_000);
        $old = $this->db()->value('SELECT file_path FROM enrollment_documents WHERE enrollment_id = ? AND document_type_id = ?', [$enrollmentId, $typeId]);
        $this->db()->run(
            "INSERT INTO enrollment_documents (enrollment_id, document_type_id, status, file_path, file_name, mime, uploaded_by, uploaded_by_id, uploaded_at)
             VALUES (?, ?, 'recibido', ?, ?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE status = 'recibido', file_path = VALUES(file_path), file_name = VALUES(file_name), mime = VALUES(mime),
                                     uploaded_by = VALUES(uploaded_by), uploaded_by_id = VALUES(uploaded_by_id), uploaded_at = NOW(), note = NULL, reviewed_at = NULL",
            [$enrollmentId, $typeId, $stored['path'], mb_substr($stored['name'], 0, 160), $stored['mime'], $actor->type, $actor->id],
        );
        if ($old && $old !== $stored['path']) $this->files()->delete($old);
        $this->audit()->log($actor, 'document.upload', 'enrollment', $enrollmentId, ['type' => $type['name']]);
        return $this->documentList($enrollmentId);
    }

    /** Approve / reject (with a note the family sees) / mark as received on paper. */
    public function reviewDocument(Request $req): array
    {
        $actor = $this->staffWrite($req, 'matriculas', 'estudiantes');
        $id = $req->intParam('id');
        $d = $this->db()->one('SELECT enrollment_id FROM enrollment_documents WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        $v = Validate::of($req);
        $status = $v->oneOf('status', ['pendiente', 'recibido', 'aprobado', 'rechazado'], null, true);
        $note = $v->str('note', 300);
        $v->check();
        $this->db()->update('enrollment_documents', ['status' => $status, 'note' => $note, 'reviewed_at' => date('Y-m-d H:i:s')], ['id' => $id]);
        $this->audit()->log($actor, 'document.review', 'enrollment_document', $id, compact('status', 'note'));
        return ['documents' => $this->documentList((int) $d['enrollment_id'])];
    }

    public function documentFile(Request $req): Response
    {
        $id = $req->intParam('id');
        $d = $this->db()->one('SELECT d.file_path, d.file_name, d.mime, e.student_id FROM enrollment_documents d JOIN enrollments e ON e.id = d.enrollment_id WHERE d.id = ?', [$id]) ?? throw HttpError::notFound();
        $family = FamilyAuth::current();
        if (!$family || $family->studentId !== (int) $d['student_id']) $this->staff($req, 'matriculas', 'estudiantes');
        if (!$this->files()->exists($d['file_path'])) throw HttpError::notFound();
        return Response::file($this->files()->path($d['file_path']), $d['mime'] ?: 'application/octet-stream', $d['file_name']);
    }

    public function saveDocType(Request $req): array
    {
        $actor = $this->staffWrite($req, 'matriculas', 'ajustes');
        $v = Validate::of($req);
        $row = [
            'name' => $v->str('name', 100, true, 'El nombre'),
            'description' => $v->str('description', 300),
            'required' => $v->bool('required', true),
            'applies_to' => $v->oneOf('appliesTo', ['nuevos', 'todos'], 'nuevos'),
            'family_can_upload' => $v->bool('familyUpload', true),
            'sort' => $v->int('sort', 0, 99) ?? 0,
            'active' => $v->bool('active', true),
        ];
        $v->check();
        $id = $this->persist('document_types', $row, self::optionalId($req));
        $this->audit()->log($actor, 'document_type.save', 'document_type', $id, $row);
        return ['id' => $id];
    }

    public function deleteDocType(Request $req): array
    {
        $actor = $this->staffWrite($req, 'matriculas', 'ajustes');
        $id = $req->intParam('id');
        if ($this->db()->value("SELECT 1 FROM enrollment_documents WHERE document_type_id = ? AND file_path IS NOT NULL LIMIT 1", [$id])) {
            $this->db()->update('document_types', ['active' => 0], ['id' => $id]); // files already uploaded: keep them, hide the type
        } else {
            $this->db()->run('DELETE FROM enrollment_documents WHERE document_type_id = ?', [$id]);
            $this->db()->run('DELETE FROM document_types WHERE id = ?', [$id]);
        }
        $this->audit()->log($actor, 'document_type.delete', 'document_type', $id);
        return [];
    }

    // ───────────────────────── inscriptions ─────────────────────────
    public function inscriptions(Request $req): array
    {
        $this->staff($req, 'inscripciones', 'matriculas');
        $rows = $this->db()->all(
            'SELECT i.id, i.year_id AS year, i.child_name AS childName, i.child_birth_date AS childBirthDate, i.guardian_name AS guardianName,
                    i.guardian_phone AS guardianPhone, i.guardian_email AS guardianEmail, i.origin, i.status, i.data, i.created_at AS createdAt,
                    g.name AS gradeLevel, i.student_id AS studentId
             FROM inscriptions i LEFT JOIN grade_levels g ON g.id = i.grade_level_id ORDER BY i.created_at DESC'
        );
        foreach ($rows as &$r) $r['data'] = $r['data'] ? json_decode($r['data'], true) : null;
        return ['inscriptions' => self::intsAll($rows, 'id', 'year', 'studentId')];
    }

    public function updateInscription(Request $req): array
    {
        $actor = $this->staffWrite($req, 'inscripciones', 'matriculas');
        $id = $req->intParam('id');
        $v = Validate::of($req);
        $row = array_filter(['status' => $v->oneOf('status', ['nueva', 'contactada', 'visita', 'prematriculada', 'descartada']), 'student_id' => $v->int('studentId', 1)], static fn($x) => $x !== null);
        $v->check();
        if ($row) $this->db()->update('inscriptions', $row, ['id' => $id]);
        $this->audit()->log($actor, 'inscription.update', 'inscription', $id, $row);
        return [];
    }
}
