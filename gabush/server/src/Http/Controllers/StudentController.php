<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Http\Auth\FamilyAuth;
use Gabush\Http\HttpError;
use Gabush\Http\Request;
use Gabush\Http\Response;
use Gabush\Http\Router;
use Gabush\Http\Validate;
use Gabush\Infrastructure\Storage\PrivateFiles;

/** Students, their family group and guardians, photos and the enrollment history. */
final class StudentController extends Controller
{
    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/students', [$c, 'index']);
        $r->add('GET', '/students/lookup', [$c, 'lookup']);
        $r->add('GET', '/students/{id}', [$c, 'show']);
        $r->add('POST', '/students', [$c, 'create']);
        $r->add('PUT', '/students/{id}', [$c, 'update']);
        $r->add('POST', '/students/{id}/photo', [$c, 'uploadPhoto']);
        $r->add('GET', '/students/{id}/photo', [$c, 'photo']);
        $r->add('PUT', '/students/{id}/family', [$c, 'moveFamily']);
        $r->add('GET', '/families', [$c, 'families']);
        $r->add('PUT', '/families/{id}', [$c, 'updateFamily']);
        $r->add('POST', '/families/{id}/guardians', [$c, 'saveGuardian']);
        $r->add('PUT', '/guardians/{id}', [$c, 'saveGuardian']);
        $r->add('DELETE', '/guardians/{id}', [$c, 'deleteGuardian']);
    }

    private function files(): PrivateFiles
    {
        return $this->app->service(PrivateFiles::class, static fn(App $a) => new PrivateFiles($a->dataDir()));
    }

    /**
     * ?q= (name, code, document or a guardian) → students of ANY year, with their last year in the school and
     * whether they already have an enrollment in ?year= — to re-enroll someone instead of typing them again.
     * ?doc= exact document number → the same, to warn before creating a duplicate.
     */
    public function lookup(Request $req): array
    {
        $this->staff($req, 'estudiantes', 'matriculas');
        $year = $this->year($req);
        $q = trim((string) $req->query('q', ''));
        $doc = preg_replace('/[^0-9A-Za-z]/', '', (string) $req->query('doc', ''));
        if (mb_strlen($q) < 2 && strlen($doc) < 5) return ['students' => []];
        [$where, $params] = strlen($doc) >= 5
            ? ["REGEXP_REPLACE(COALESCE(s.doc_number, ''), '[^0-9A-Za-z]', '') = ?", [$doc]]
            : ["(CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name, s.second_last_name) LIKE ? OR s.code LIKE ? OR s.doc_number LIKE ?
                 OR EXISTS (SELECT 1 FROM guardians g2 WHERE g2.family_id = s.family_id AND g2.full_name LIKE ?))", ["%$q%", "%$q%", "%$q%", "%$q%"]];
        $rows = $this->db()->all(
            "SELECT s.id, s.code, s.first_name AS firstName, s.middle_name AS middleName, s.last_name AS lastName, s.second_last_name AS secondLastName,
                    s.birth_date AS birthDate, s.doc_number AS docNumber, s.photo_path IS NOT NULL AS hasPhoto,
                    le.year_id AS lastYear, lc.name AS lastCourse, le.status AS lastStatus,
                    (SELECT COUNT(*) FROM enrollments x WHERE x.student_id = s.id) AS years,
                    (SELECT x.status FROM enrollments x WHERE x.student_id = s.id AND x.year_id = ?) AS statusThisYear,
                    (SELECT g.full_name FROM guardians g WHERE g.family_id = s.family_id ORDER BY g.is_primary DESC, g.id LIMIT 1) AS guardian
             FROM students s
             LEFT JOIN enrollments le ON le.id = (SELECT x.id FROM enrollments x WHERE x.student_id = s.id ORDER BY x.year_id DESC LIMIT 1)
             LEFT JOIN courses lc ON lc.id = le.course_id
             WHERE $where ORDER BY le.year_id DESC, s.last_name LIMIT 12",
            [$year, ...$params],
        );
        foreach ($rows as &$r) {
            $r['suggestedCourse'] = $r['statusThisYear'] === null ? (EnrollmentController::suggestCourse($this->db(), (int) $r['id'], $year)['name'] ?? null) : null;
        }
        unset($r);
        return ['year' => $year, 'students' => self::intsAll($rows, 'id', 'hasPhoto', 'lastYear', 'years')];
    }

    /** List for a year: every student with an enrollment that year (or ?all=1 for everyone ever). */
    public function index(Request $req): array
    {
        $this->staff($req, 'estudiantes', 'matriculas', 'asistencia', 'pagos', 'calificaciones', 'observador');
        $year = $this->year($req);
        $where = ['1=1'];
        $params = [$year];
        if ($req->query('course')) { $where[] = 'e.course_id = ?'; $params[] = (int) $req->query('course'); }
        if ($req->query('status')) { $where[] = 'e.status = ?'; $params[] = (string) $req->query('status'); }
        if (($q = trim((string) $req->query('q', ''))) !== '') {
            $where[] = "(CONCAT_WS(' ', s.first_name, s.middle_name, s.last_name, s.second_last_name) LIKE ? OR s.code LIKE ? OR s.doc_number LIKE ? OR EXISTS (SELECT 1 FROM guardians g2 WHERE g2.family_id = s.family_id AND (g2.full_name LIKE ? OR g2.doc_number LIKE ?)))";
            array_push($params, "%$q%", "%$q%", "%$q%", "%$q%", "%$q%");
        }
        $join = $req->query('all') ? 'LEFT JOIN' : 'JOIN';
        $rows = $this->db()->all(
            "SELECT s.id, s.code, s.first_name AS firstName, s.middle_name AS middleName, s.last_name AS lastName, s.second_last_name AS secondLastName,
                    s.birth_date AS birthDate, s.gender, s.photo_path IS NOT NULL AS hasPhoto, s.family_id AS familyId,
                    e.id AS enrollmentId, e.status, e.order_number AS orderNumber, e.contract_signed AS contractSigned, c.id AS courseId, c.name AS course,
                    g.full_name AS guardian, g.phone AS guardianPhone, g.relationship AS guardianRelationship,
                    (SELECT COUNT(*) FROM enrollment_documents d JOIN document_types t ON t.id = d.document_type_id WHERE d.enrollment_id = e.id AND t.required = 1 AND d.status IN ('pendiente','rechazado')) AS docsPending,
                    (SELECT COUNT(*) FROM portal_accounts pa WHERE pa.student_id = s.id AND pa.active = 1) AS hasPortal
             FROM students s
             $join enrollments e ON e.student_id = s.id AND e.year_id = ?
             LEFT JOIN courses c ON c.id = e.course_id
             LEFT JOIN guardians g ON g.family_id = s.family_id AND g.is_primary = 1
             WHERE " . implode(' AND ', $where) . '
             ORDER BY s.last_name, s.second_last_name, s.first_name',
            $params,
        );
        return ['year' => $year, 'students' => self::intsAll($rows, 'id', 'hasPhoto', 'familyId', 'enrollmentId', 'orderNumber', 'contractSigned', 'courseId', 'docsPending', 'hasPortal')];
    }

    public function show(Request $req): array
    {
        $this->staff($req, 'estudiantes', 'matriculas', 'asistencia', 'pagos', 'calificaciones', 'observador');
        $id = $req->intParam('id');
        return $this->detail($id);
    }

    /** @return array<string,mixed> */
    public function detail(int $id): array
    {
        $db = $this->db();
        $s = $db->one('SELECT * FROM students WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        $family = $s['family_id'] ? $db->one('SELECT id, name, notes FROM families WHERE id = ?', [$s['family_id']]) : null;
        $guardians = $s['family_id'] ? $db->all('SELECT id, full_name AS name, relationship, doc_type AS docType, doc_number AS docNumber, phone, phone2, email, address, occupation, is_primary AS isPrimary, is_billing AS isBilling FROM guardians WHERE family_id = ? ORDER BY is_primary DESC, relationship, full_name', [$s['family_id']]) : [];
        $siblings = $s['family_id'] ? $db->all(
            "SELECT s.id, s.code, s.first_name AS firstName, s.last_name AS lastName, c.name AS course
             FROM students s LEFT JOIN enrollments e ON e.student_id = s.id AND e.year_id = ? LEFT JOIN courses c ON c.id = e.course_id
             WHERE s.family_id = ? AND s.id <> ? ORDER BY s.first_name",
            [$this->settings()->activeYear(), $s['family_id'], $id],
        ) : [];
        $enrollments = $db->all(
            'SELECT e.id, e.year_id AS year, e.status, e.order_number AS orderNumber, e.contract_signed AS contractSigned, e.enrolled_on AS enrolledOn,
                    e.withdrawn_on AS withdrawnOn, e.withdraw_reason AS withdrawReason, e.is_new AS isNew, c.id AS courseId, c.name AS course,
                    e.plan_id AS planId, pl.name AS plan, e.monthly_discount AS monthlyDiscount, e.monthly_discount_reason AS monthlyDiscountReason
             FROM enrollments e LEFT JOIN courses c ON c.id = e.course_id LEFT JOIN plans pl ON pl.id = e.plan_id WHERE e.student_id = ? ORDER BY e.year_id DESC',
            [$id],
        );
        foreach ($enrollments as &$en) foreach (['planId', 'monthlyDiscount'] as $k) $en[$k] = $en[$k] !== null ? (int) $en[$k] : null;
        unset($en);
        $portal = $db->one('SELECT username, active, must_change_password AS mustChange, last_login_at AS lastLogin FROM portal_accounts WHERE student_id = ?', [$id]);
        return [
            'student' => [
                'id' => (int) $s['id'], 'code' => $s['code'], 'firstName' => $s['first_name'], 'middleName' => $s['middle_name'], 'lastName' => $s['last_name'],
                'secondLastName' => $s['second_last_name'], 'birthDate' => $s['birth_date'], 'birthCity' => $s['birth_city'], 'gender' => $s['gender'],
                'docType' => $s['doc_type'], 'docNumber' => $s['doc_number'], 'eps' => $s['eps'], 'bloodType' => $s['blood_type'], 'religion' => $s['religion'],
                'email' => $s['email'], 'allergies' => $s['allergies'], 'authorizedPickup' => $s['authorized_pickup'], 'notes' => $s['notes'],
                'hasPhoto' => $s['photo_path'] !== null, 'photoVersion' => substr(md5((string) $s['photo_path']), 0, 8), 'familyId' => $s['family_id'] ? (int) $s['family_id'] : null,
            ],
            'family' => $family ? self::ints($family, 'id') : null,
            'guardians' => self::intsAll($guardians, 'id', 'isPrimary', 'isBilling'),
            'siblings' => self::intsAll($siblings, 'id'),
            'enrollments' => self::intsAll($enrollments, 'id', 'year', 'orderNumber', 'contractSigned', 'isNew', 'courseId'),
            'portal' => $portal ? self::ints($portal, 'active', 'mustChange') : null,
        ];
    }

    /** @return array<string,mixed> */
    private function studentFields(Validate $v): array
    {
        return [
            'first_name' => $v->str('firstName', 60, true, 'El primer nombre'),
            'middle_name' => $v->str('middleName', 60),
            'last_name' => $v->str('lastName', 60, true, 'El primer apellido'),
            'second_last_name' => $v->str('secondLastName', 60),
            'birth_date' => $v->date('birthDate'),
            'birth_city' => $v->str('birthCity', 80),
            'gender' => $v->oneOf('gender', ['M', 'F']),
            'doc_type' => $v->str('docType', 40),
            'doc_number' => ($n = $v->str('docNumber', 32)) !== null ? preg_replace('/[.\s]/', '', $n) : null,
            'eps' => $v->str('eps', 80),
            'blood_type' => $v->str('bloodType', 8),
            'religion' => $v->str('religion', 40),
            'email' => $v->email('email'),
            'allergies' => $v->text('allergies', 1000),
            'authorized_pickup' => $v->text('authorizedPickup', 1000),
            'notes' => $v->text('notes', 2000),
        ];
    }

    /** @return array<string,mixed> */
    private function guardianFields(Validate $v): array
    {
        return [
            'full_name' => $v->str('name', 160, true, 'El nombre del acudiente'),
            'relationship' => $v->str('relationship', 40) ?? 'Acudiente',
            'doc_type' => $v->str('docType', 8),
            'doc_number' => ($n = $v->str('docNumber', 32)) !== null ? preg_replace('/[.\s]/', '', $n) : null,
            'phone' => $v->str('phone', 40),
            'phone2' => $v->str('phone2', 40),
            'email' => $v->email('email'),
            'address' => $v->str('address', 200),
            'occupation' => $v->str('occupation', 100),
            'is_primary' => $v->bool('isPrimary'),
            'is_billing' => $v->bool('isBilling'),
        ];
    }

    /**
     * New student: personal data + family (an existing one — siblings — or a new one with its guardians)
     * + optional enrollment in a year/course. The code is the next GAB-#### number.
     */
    public function create(Request $req): array
    {
        $actor = $this->staffWrite($req, 'estudiantes', 'matriculas');
        $v = Validate::of($req);
        $row = $this->studentFields($v);
        $familyId = $v->int('familyId', 1);
        $guardians = $v->arr('guardians');
        $year = $v->int('year', 2000, 2100);
        $courseId = $v->int('courseId', 1);
        $status = $v->oneOf('status', ['prematricula', 'activo'], 'prematricula');
        if (!$familyId && !$guardians) $v->fail('guardians', 'Agrega al menos un acudiente (o elige la familia de un hermano).');
        $v->check();
        if ($row['doc_number'] && ($dup = $this->db()->one('SELECT id, code FROM students WHERE doc_number = ?', [$row['doc_number']]))) {
            throw HttpError::conflict('duplicate', "Ya existe un estudiante con ese documento ({$dup['code']}).");
        }
        $id = $this->db()->transaction(function ($db) use ($row, $familyId, $guardians, $year, $courseId, $status) {
            if (!$familyId) {
                $first = $guardians[0] ?? [];
                $familyId = $db->insert('families', ['name' => mb_substr(trim(($first['name'] ?? 'Familia') . ' (' . ($first['relationship'] ?? 'Acudiente') . ')'), 0, 160)]);
                foreach ($guardians as $i => $g) {
                    $gv = new Validate($g);
                    $gRow = $this->guardianFields($gv);
                    $gv->check();
                    if ($i === 0) $gRow['is_primary'] = $gRow['is_billing'] = true;
                    $db->insert('guardians', $gRow + ['family_id' => $familyId]);
                }
            }
            $next = (int) $db->value("SELECT COALESCE(MAX(CAST(SUBSTRING(code, 5) AS UNSIGNED)), 0) + 1 FROM students WHERE code REGEXP '^GAB-[0-9]+$'");
            $id = $db->insert('students', $row + ['code' => sprintf('GAB-%04d', $next), 'family_id' => $familyId]);
            if ($year) {
                $db->insert('enrollments', ['student_id' => $id, 'year_id' => $year, 'course_id' => $courseId, 'status' => $status, 'is_new' => 1, 'enrolled_on' => date('Y-m-d')]);
            }
            return $id;
        });
        $this->audit()->log($actor, 'student.create', 'student', $id);
        return $this->detail($id);
    }

    public function update(Request $req): array
    {
        $actor = $this->staffWrite($req, 'estudiantes', 'matriculas');
        $id = $req->intParam('id');
        $v = Validate::of($req);
        $row = $this->studentFields($v);
        $v->check();
        if ($row['doc_number'] && $this->db()->value('SELECT id FROM students WHERE doc_number = ? AND id <> ?', [$row['doc_number'], $id])) {
            throw HttpError::conflict('duplicate', 'Otro estudiante ya tiene ese número de documento.');
        }
        $this->db()->update('students', $row, ['id' => $id]);
        $this->audit()->log($actor, 'student.update', 'student', $id);
        return $this->detail($id);
    }

    public function uploadPhoto(Request $req): array
    {
        $actor = $this->staffWrite($req, 'estudiantes', 'matriculas');
        $id = $req->intParam('id');
        $s = $this->db()->one('SELECT code, photo_path FROM students WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        $file = $req->files['photo'] ?? throw HttpError::validation(['photo' => 'Elige una foto.']);
        $stored = $this->files()->storeUpload($file, 'students', $s['code'], ['image/jpeg', 'image/png', 'image/webp'], 10_000_000, 900);
        $this->files()->delete($s['photo_path']);
        $this->db()->update('students', ['photo_path' => $stored['path']], ['id' => $id]);
        $this->audit()->log($actor, 'student.photo', 'student', $id);
        return $this->detail($id);
    }

    /** Photo for the panel (staff) or for the family of that same student (portal). */
    public function photo(Request $req): Response
    {
        $id = $req->intParam('id');
        $family = FamilyAuth::current();
        if (!$family || $family->studentId !== $id) $this->staff($req);
        $path = $this->db()->value('SELECT photo_path FROM students WHERE id = ?', [$id]);
        if (!$this->files()->exists($path)) throw HttpError::notFound();
        return Response::file($this->files()->path($path), $this->files()->mime($path), null, 3600);
    }

    /** Move a student to another family (e.g. link siblings) or to a new empty one. */
    public function moveFamily(Request $req): array
    {
        $actor = $this->staffWrite($req, 'estudiantes', 'matriculas');
        $id = $req->intParam('id');
        $v = Validate::of($req);
        $familyId = $v->int('familyId', 1);
        $v->check();
        if (!$familyId) {
            $name = $this->db()->value("SELECT CONCAT('Familia de ', first_name, ' ', last_name) FROM students WHERE id = ?", [$id]);
            $familyId = $this->db()->insert('families', ['name' => $name]);
        } elseif (!$this->db()->value('SELECT 1 FROM families WHERE id = ?', [$familyId])) {
            throw HttpError::notFound();
        }
        $old = $this->db()->value('SELECT family_id FROM students WHERE id = ?', [$id]);
        $this->db()->update('students', ['family_id' => $familyId], ['id' => $id]);
        // a family left without students and without guardians is removed
        if ($old && !$this->db()->value('SELECT 1 FROM students WHERE family_id = ?', [$old]) && !$this->db()->value('SELECT 1 FROM guardians WHERE family_id = ?', [$old])) {
            $this->db()->run('DELETE FROM families WHERE id = ?', [$old]);
        }
        $this->audit()->log($actor, 'student.family', 'student', $id, ['from' => $old, 'to' => $familyId]);
        return $this->detail($id);
    }

    /** Family search (to link siblings): by guardian name/document or student name. */
    public function families(Request $req): array
    {
        $this->staff($req, 'estudiantes', 'matriculas');
        $q = trim((string) $req->query('q', ''));
        if (mb_strlen($q) < 2) return ['families' => []];
        $rows = $this->db()->all(
            "SELECT f.id, f.name,
                    GROUP_CONCAT(DISTINCT CONCAT(s.first_name, ' ', s.last_name) ORDER BY s.first_name SEPARATOR ', ') AS students
             FROM families f
             LEFT JOIN students s ON s.family_id = f.id
             LEFT JOIN guardians g ON g.family_id = f.id
             WHERE f.name LIKE ? OR g.full_name LIKE ? OR g.doc_number LIKE ? OR CONCAT(s.first_name, ' ', s.last_name) LIKE ?
             GROUP BY f.id ORDER BY f.name LIMIT 15",
            ["%$q%", "%$q%", "%$q%", "%$q%"],
        );
        return ['families' => self::intsAll($rows, 'id')];
    }

    public function updateFamily(Request $req): array
    {
        $actor = $this->staffWrite($req, 'estudiantes', 'matriculas');
        $id = $req->intParam('id');
        $v = Validate::of($req);
        $row = ['name' => $v->str('name', 160, true, 'El nombre'), 'notes' => $v->text('notes', 2000)];
        $v->check();
        $this->db()->update('families', $row, ['id' => $id]);
        $this->audit()->log($actor, 'family.update', 'family', $id);
        return [];
    }

    public function saveGuardian(Request $req): array
    {
        $actor = $this->staffWrite($req, 'estudiantes', 'matriculas');
        $v = Validate::of($req);
        $row = $this->guardianFields($v);
        $v->check();
        $isNew = str_contains($req->path, '/families/');
        $familyId = $isNew ? $req->intParam('id') : (int) $this->db()->value('SELECT family_id FROM guardians WHERE id = ?', [$req->intParam('id')]);
        if (!$familyId) throw HttpError::notFound();
        $id = $this->db()->transaction(function ($db) use ($row, $isNew, $familyId, $req) {
            // only one primary contact / one person responsible for payments per family
            if ($row['is_primary']) $db->run('UPDATE guardians SET is_primary = 0 WHERE family_id = ?', [$familyId]);
            if ($row['is_billing']) $db->run('UPDATE guardians SET is_billing = 0 WHERE family_id = ?', [$familyId]);
            if ($isNew) return $db->insert('guardians', $row + ['family_id' => $familyId]);
            $db->update('guardians', $row, ['id' => $req->intParam('id')]);
            return $req->intParam('id');
        });
        $this->audit()->log($actor, 'guardian.save', 'guardian', $id);
        return ['id' => $id];
    }

    public function deleteGuardian(Request $req): array
    {
        $actor = $this->staffWrite($req, 'estudiantes', 'matriculas');
        $id = $req->intParam('id');
        $g = $this->db()->one('SELECT family_id, full_name FROM guardians WHERE id = ?', [$id]) ?? throw HttpError::notFound();
        if ((int) $this->db()->value('SELECT COUNT(*) FROM guardians WHERE family_id = ?', [$g['family_id']]) <= 1) {
            throw HttpError::conflict('last_guardian', 'La familia debe tener al menos un acudiente.');
        }
        $this->db()->run('DELETE FROM guardians WHERE id = ?', [$id]);
        $this->audit()->log($actor, 'guardian.delete', 'guardian', $id, ['name' => $g['full_name']]);
        return [];
    }
}
