<?php
declare(strict_types=1);

namespace Gabush\Infrastructure\Migration;

use Gabush\Infrastructure\Database\Database;

/**
 * Imports the Cerkademia export (.migration/raw/*.json) into the Gabush database.
 * Idempotent: every imported row carries legacy_ref (or a natural unique key) and is upserted, so it can
 * run again after a fresh export without duplicating anything. Order matters (foreign keys).
 */
final class CerkademiaImporter
{
    /** @var array<string,int> */
    private array $stats = [];
    /** @var array<string,int> code → student id */
    private array $studentIds = [];
    /** @var array<string,int> "year|course name" → course id */
    private array $courseIds = [];
    /** @var array<string,int> grade name → id */
    private array $gradeIds = [];
    /** @var array<string,int> name → staff id */
    private array $staffIds = [];
    /** @var array<string,int> "code|year" → enrollment id */
    private array $enrollmentIds = [];
    /** @var array<string,int> */
    private array $subjectIds = [];
    /** @var array<string,int> */
    private array $conceptIds = [];

    public function __construct(private readonly Database $db, private readonly string $rawDir, private readonly string $dataDir, private readonly ?\Closure $log = null)
    {
    }

    /** @return array<string,int> */
    public function run(): array
    {
        $this->db->transaction(function (): void {
            $catalog = $this->json('catalog');
            $this->years(array_keys($catalog));
            $this->grades($catalog);
            $this->staff($catalog);
            $this->courses($catalog);
            $this->academics($catalog);
            $this->billingCatalog($catalog);
            $this->students();
            $this->enrollments();
            $this->orphanStudents();
            $this->inscriptions($catalog);
            $this->grades2();
            $this->enrichPeople();
            $this->cartera();
            $this->cash();
        });
        $this->photos();
        return $this->stats;
    }

    // ───────────────────────── helpers ─────────────────────────
    private function json(string $name): array
    {
        $f = "{$this->rawDir}/$name.json";
        if (!is_file($f)) return [];
        return json_decode((string) file_get_contents($f), true, 512, JSON_THROW_ON_ERROR) ?? [];
    }

    private function count(string $what, int $n = 1): void
    {
        $this->stats[$what] = ($this->stats[$what] ?? 0) + $n;
    }

    private function say(string $msg): void
    {
        if ($this->log) ($this->log)($msg);
    }

    /** Insert or update by a unique column; returns the id. */
    private function upsert(string $table, array $row, string $key, string $idCol = 'id'): int
    {
        $existing = $this->db->value("SELECT `$idCol` FROM `$table` WHERE `$key` = ?", [$row[$key]]);
        if ($existing !== null) {
            $upd = $row;
            unset($upd[$key]);
            if ($upd) $this->db->update($table, $upd, [$idCol => $existing]);
            return (int) $existing;
        }
        return $this->db->insert($table, $row);
    }

    // ───────────────────────── catalog ─────────────────────────
    /** @param list<string> $years */
    private function years(array $years): void
    {
        $latest = max(array_map('intval', $years));
        foreach ($years as $y) {
            $y = (int) $y;
            $this->db->run(
                'INSERT INTO academic_years (id, name, starts_on, ends_on, status) VALUES (?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE name = VALUES(name)',
                [$y, "Año académico $y", "$y-02-01", "$y-11-30", $y === $latest ? 'active' : 'closed'],
            );
            for ($p = 1; $p <= 4; $p++) {
                $this->db->run(
                    'INSERT INTO periods (year_id, number, name, weight, grading_open, published) VALUES (?, ?, ?, 25, ?, ?)
                     ON DUPLICATE KEY UPDATE name = VALUES(name)',
                    [$y, $p, "Periodo $p", $y === $latest ? 1 : 0, $y === $latest ? 0 : 1],
                );
            }
            $this->count('años');
        }
    }

    private function grades(array $catalog): void
    {
        $order = ['Maternal' => 1, 'Párvulos' => 2, 'PreJardín' => 3, 'Jardín' => 4, 'Transición' => 5];
        $names = [];
        foreach ($catalog as $yr) foreach ($yr['courses'] ?? [] as $c) $names[Parse::gradeOfCourse($c['Nombre'])] = true;
        foreach (array_keys($names) as $n) {
            $this->db->run('INSERT INTO grade_levels (name, sort) VALUES (?, ?) ON DUPLICATE KEY UPDATE sort = VALUES(sort)', [$n, $order[$n] ?? 9]);
            $this->gradeIds[$n] = (int) $this->db->value('SELECT id FROM grade_levels WHERE name = ?', [$n]);
        }
        $this->count('grados', count($names));
    }

    private function staff(array $catalog): void
    {
        foreach ($catalog as $yr) {
            foreach ($yr['teachers'] ?? [] as $t) {
                $name = Parse::name($t['Nombre'] ?? '');
                if ($name === '' || isset($this->staffIds[$name])) continue;
                $this->staffIds[$name] = $this->upsert('staff', [
                    'legacy_ref' => 'prof:' . ($t['Nombre de Usuario'] ?: $name),
                    'full_name' => $name,
                    'phone' => Parse::nullIfEmpty($t['Telefono(s)'] ?? null),
                    'position' => 'Docente',
                ], 'legacy_ref');
                $this->count('profesores');
            }
        }
    }

    private function staffId(?string $name): ?int
    {
        $name = Parse::name($name);
        if ($name === '') return null;
        if (isset($this->staffIds[$name])) return $this->staffIds[$name];
        foreach ($this->staffIds as $n => $id) if (mb_strtolower($n) === mb_strtolower($name)) return $id;
        return null;
    }

    private function courses(array $catalog): void
    {
        foreach ($catalog as $y => $yr) {
            foreach ($yr['courses'] ?? [] as $c) {
                $grade = Parse::gradeOfCourse($c['Nombre']);
                $this->db->run(
                    'INSERT INTO courses (year_id, grade_level_id, name, alias, capacity, director_staff_id) VALUES (?, ?, ?, ?, 12, ?)
                     ON DUPLICATE KEY UPDATE grade_level_id = VALUES(grade_level_id), alias = VALUES(alias), director_staff_id = VALUES(director_staff_id)',
                    [(int) $y, $this->gradeIds[$grade], $c['Nombre'], Parse::nullIfEmpty($c['Alias'] ?? null), $this->staffId($c['Director'] ?? null)],
                );
                $this->courseIds["$y|{$c['Nombre']}"] = (int) $this->db->value('SELECT id FROM courses WHERE year_id = ? AND name = ?', [(int) $y, $c['Nombre']]);
                $this->count('cursos');
            }
        }
    }

    private function academics(array $catalog): void
    {
        $latest = $catalog[(string) max(array_map('intval', array_keys($catalog)))] ?? [];
        foreach ($latest['areas'] ?? [] as $a) {
            $this->db->run('INSERT INTO areas (name, report_position) VALUES (?, ?) ON DUPLICATE KEY UPDATE report_position = VALUES(report_position)', [Parse::name($a['Nombre']), (int) ($a['Posición en Boletín'] ?? 0)]);
            $this->count('dimensiones');
        }
        foreach ($latest['subjects'] ?? [] as $s) {
            $name = trim($s['Nombre']);
            if ($name === '' || preg_match('/^\.+$/', $name)) continue; // placeholder rows ".", ".." used by the old system
            $area = $this->db->value('SELECT id FROM areas WHERE name = ?', [Parse::name($s['Área Académica'] ?? '')]);
            $this->db->run('INSERT INTO subjects (name, area_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE area_id = VALUES(area_id)', [$name, $area]);
            $this->subjectIds[$name] = (int) $this->db->value('SELECT id FROM subjects WHERE name = ?', [$name]);
            $this->count('materias');
        }
        $sort = 0;
        foreach ($latest['levels'] ?? [] as $l) {
            [$min, $max] = array_map('floatval', array_map('trim', explode('-', $l['Rango'] ?? '0 - 0') + [1 => '0']));
            $this->db->run('INSERT INTO performance_levels (name, min_score, max_score, sort) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE min_score = VALUES(min_score), max_score = VALUES(max_score), sort = VALUES(sort)', [$l['Nivel'], $min, $max, ++$sort]);
            $this->count('niveles de desempeño');
        }
    }

    private function billingCatalog(array $catalog): void
    {
        $concepts = [
            'MATRICULA' => ['Matrícula', 'anual', 1, 0],
            'PENSION' => ['Pensión', 'mensual', 0, 1],
            'CLAUSURA' => ['Clausura', 'eventual', 0, 0],
            'OTRO' => ['Otro cobro', 'eventual', 0, 0],
        ];
        foreach ($concepts as $code => [$name, $freq, $onEnroll, $late]) {
            $this->conceptIds[$name] = $this->upsert('billing_concepts', ['code' => $code, 'name' => $name, 'frequency' => $freq, 'apply_on_enrollment' => $onEnroll, 'late_fee_applies' => $late], 'code');
        }
        foreach ($catalog as $y => $yr) {
            foreach ($yr['pricesByGrade'] ?? [] as $concept => $tables) {
                if (!isset($this->conceptIds[$concept])) continue;
                foreach ($tables as $t) {
                    $gi = array_search('Grado', $t['head'], true);
                    $pi = array_search('Precio Neto', $t['head'], true);
                    if ($gi === false || $pi === false) continue;
                    foreach ($t['rows'] as $r) {
                        $amount = Parse::money($r[$pi] ?? null);
                        $grade = $this->gradeIds[trim($r[$gi] ?? '')] ?? null;
                        if ($amount === null || $grade === null) continue;
                        $this->db->run(
                            'INSERT INTO prices (year_id, concept_id, grade_level_id, amount) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE amount = VALUES(amount)',
                            [(int) $y, $this->conceptIds[$concept], $grade, $amount],
                        );
                        $this->count('precios');
                    }
                }
            }
        }
    }

    // ───────────────────────── people ─────────────────────────
    private function students(): void
    {
        $details = $this->json('student-details.lite');
        $lists = $this->json('student-lists');
        // fallback names / documents from the yearly lists for anyone without a detail page
        $fromList = [];
        foreach ($lists as $rows) foreach ($rows as $r) $fromList[$r['Código']] = $r;

        // families: students that appear in each other's family group belong to the same family
        $parent = [];
        $find = function (string $x) use (&$parent, &$find): string { return ($parent[$x] ?? $x) === $x ? $x : ($parent[$x] = $find($parent[$x])); };
        foreach ($details as $code => $d) {
            $parent[$code] ??= $code;
            foreach ($d['family'] ?? [] as $m) {
                $other = trim($m['Código'] ?? '');
                if (preg_match('/^GAB-/', $other) && isset($details[$other])) {
                    $parent[$other] ??= $other;
                    $a = $find($code); $b = $find($other);
                    if ($a !== $b) $parent[max($a, $b)] = min($a, $b);
                }
            }
        }

        $familyIds = [];
        foreach ($details as $code => $d) {
            $root = $find($code);
            if (!isset($familyIds[$root])) {
                $adults = array_values(array_filter($d['family'] ?? [], static fn($m) => ($m['Parentesco'] ?? '') !== 'Estudiante'));
                $label = $adults ? implode(' · ', array_map(static fn($m) => Parse::name($m['Nombre']) . ' (' . $m['Parentesco'] . ')', array_slice($adults, 0, 2))) : 'Familia de ' . Parse::name(($d['firstName'] ?? '') . ' ' . ($d['lastName'] ?? ''));
                $familyIds[$root] = $this->upsert('families', ['legacy_ref' => "fam:$root", 'name' => mb_substr($label, 0, 160)], 'legacy_ref');
                $this->count('familias');
            }
            $fid = $familyIds[$root];
            // guardians (adults of every student of the family, deduplicated by document or name)
            foreach ($d['family'] ?? [] as $m) {
                if (($m['Parentesco'] ?? '') === 'Estudiante') continue;
                [$dt, $dn] = Parse::document($m['No. de Documento'] ?? null);
                $ref = 'acu:' . ($dn ?: mb_strtolower(Parse::name($m['Nombre']))) . ':' . $fid;
                $exists = $this->db->value('SELECT id FROM guardians WHERE legacy_ref = ?', [$ref]);
                $row = [
                    'family_id' => $fid,
                    'full_name' => Parse::name($m['Nombre']),
                    'relationship' => $m['Parentesco'] ?: 'Acudiente',
                    'doc_type' => $dt,
                    'doc_number' => $dn,
                    'phone' => Parse::nullIfEmpty($m['Teléfono(s)'] ?? null),
                    'email' => filter_var(trim($m['Dirección Email'] ?? ''), FILTER_VALIDATE_EMAIL) ?: null,
                    'address' => Parse::nullIfEmpty($m['Dirección'] ?? null) ?? (filter_var(trim($m['Dirección Email'] ?? ''), FILTER_VALIDATE_EMAIL) ? null : Parse::nullIfEmpty($m['Dirección Email'] ?? null)),
                    'legacy_ref' => $ref,
                ];
                if ($exists) $this->db->update('guardians', $row, ['id' => $exists]);
                else { $this->db->insert('guardians', $row); $this->count('acudientes'); }
            }
            // student
            $fallback = isset($fromList[$code]) ? Parse::listName($fromList[$code]['Nombre']) : ['', null, '', null];
            [$dt, $dn] = [$d['docType'] ?? null, $d['docNumber'] ?? null];
            $this->studentIds[$code] = $this->upsert('students', [
                'code' => $code,
                'first_name' => Parse::name($d['firstName'] ?: $fallback[0]),
                'middle_name' => Parse::nullIfEmpty(Parse::name($d['middleName'] ?? $fallback[1])),
                'last_name' => Parse::name($d['lastName'] ?: $fallback[2]),
                'second_last_name' => Parse::nullIfEmpty(Parse::name($d['secondLastName'] ?? $fallback[3])),
                'birth_date' => Parse::date($d['birthDate'] ?? null),
                'birth_city' => Parse::nullIfEmpty($d['birthCity'] ?? null),
                'gender' => in_array($d['gender'] ?? null, ['M', 'F'], true) ? $d['gender'] : null,
                'doc_type' => Parse::nullIfEmpty($dt),
                'doc_number' => Parse::nullIfEmpty(preg_replace('/[.\s]/', '', (string) $dn)),
                'eps' => Parse::nullIfEmpty($d['eps'] ?? null),
                'blood_type' => Parse::nullIfEmpty($d['bloodType'] ?? null),
                'religion' => Parse::nullIfEmpty($d['religion'] ?? null),
                'email' => filter_var(trim((string) ($d['email'] ?? '')), FILTER_VALIDATE_EMAIL) ?: null,
                'family_id' => $fid,
                'legacy_ref' => 'est:' . $code,
            ], 'code');
            $this->count('estudiantes');
        }
        // guardian flags: the mother (or first adult) is the primary contact and responsible for payments
        $this->db->run("UPDATE guardians g JOIN (SELECT family_id, MIN(CASE WHEN relationship = 'Madre' THEN id END) AS mom, MIN(id) AS first FROM guardians GROUP BY family_id) x ON x.family_id = g.family_id
                        SET g.is_primary = (g.id = COALESCE(x.mom, x.first)), g.is_billing = (g.id = COALESCE(x.mom, x.first))");
    }

    private function enrollments(): void
    {
        $lists = $this->json('student-lists');
        $states = $this->json('enrollments');
        $status = [];
        foreach ($states as $y => $block) {
            if (!is_array($block) || !isset($block['rows'])) continue;
            foreach ($block['rows'] as $r) {
                $title = '';
                foreach ($r['imgs'] ?? [] as $img) if (preg_match('/^(Activo|Retirado|En Prematr[ií]cula)/u', $img, $m)) { $title = $m[1]; break; }
                if ($r['code']) $status["{$r['code']}|$y"] = str_starts_with($title, 'Retirado') ? 'retirado' : (str_starts_with($title, 'En Prematr') ? 'prematricula' : 'activo');
            }
        }
        $seen = [];
        ksort($lists);
        foreach ($lists as $y => $rows) {
            foreach ($rows as $r) {
                $code = $r['Código'];
                $sid = $this->studentIds[$code] ?? null;
                if (!$sid) continue;
                $courseId = $this->courseIds["$y|{$r['Curso']}"] ?? null;
                $this->db->run(
                    'INSERT INTO enrollments (student_id, year_id, course_id, status, order_number, is_new, enrolled_on)
                     VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE course_id = VALUES(course_id), status = VALUES(status), order_number = VALUES(order_number), is_new = VALUES(is_new)',
                    [$sid, (int) $y, $courseId, $status["$code|$y"] ?? 'activo', ctype_digit((string) ($r['No. Orden'] ?? '')) ? (int) $r['No. Orden'] : null, isset($seen[$code]) ? 0 : 1, "$y-02-01"],
                );
                $seen[$code] = true;
                $this->enrollmentIds["$code|$y"] = (int) $this->db->value('SELECT id FROM enrollments WHERE student_id = ? AND year_id = ?', [$sid, (int) $y]);
                $this->count('matrículas');
            }
        }
    }

    /**
     * Students that only exist in the accounts (cartera) — withdrawn / removed from the yearly lists — are
     * created from what the account shows (name, course, state) so their payments are not lost.
     */
    private function orphanStudents(): void
    {
        foreach ($this->json('cartera') as $y => $accounts) {
            foreach ($accounts as $code => $acc) {
                if (isset($this->studentIds[$code]) || !preg_match('/^GAB-/', (string) $code)) continue;
                [$name, $state, , $course] = $acc['list'] + [null, null, null, null];
                [$first, $middle, $last, $second] = Parse::listName((string) $name);
                $fid = $this->upsert('families', ['legacy_ref' => "fam:$code", 'name' => 'Familia de ' . Parse::name("$first $last")], 'legacy_ref');
                $this->studentIds[$code] = $this->upsert('students', [
                    'code' => $code, 'first_name' => Parse::name($first) ?: '(sin nombre)', 'middle_name' => Parse::nullIfEmpty(Parse::name($middle)),
                    'last_name' => Parse::name($last) ?: '(sin apellido)', 'second_last_name' => Parse::nullIfEmpty(Parse::name($second)),
                    'family_id' => $fid, 'legacy_ref' => "est:$code", 'notes' => 'Importado solo desde la cartera de Cerkademia (no tenía ficha en las listas de estudiantes).',
                ], 'code');
                $this->db->run(
                    'INSERT INTO enrollments (student_id, year_id, course_id, status, is_new) VALUES (?, ?, ?, ?, 0)
                     ON DUPLICATE KEY UPDATE status = VALUES(status), course_id = VALUES(course_id)',
                    [$this->studentIds[$code], (int) $y, $this->courseIds["$y|$course"] ?? null, str_contains(mb_strtolower((string) $state), 'retir') ? 'retirado' : 'activo'],
                );
                $this->enrollmentIds["$code|$y"] = (int) $this->db->value('SELECT id FROM enrollments WHERE student_id = ? AND year_id = ?', [$this->studentIds[$code], (int) $y]);
                $this->count('estudiantes solo en cartera');
            }
        }
    }

    private function inscriptions(array $catalog): void
    {
        foreach ($catalog as $y => $yr) {
            foreach ($yr['inscriptions'] ?? [] as $i) {
                $grade = $this->gradeIds[trim($i['Grado al que aspira'] ?? '')] ?? null;
                $this->upsert('inscriptions', [
                    'legacy_ref' => 'insc:' . ($i['ID'] ?? md5(json_encode($i))),
                    'year_id' => (int) $y,
                    'grade_level_id' => $grade,
                    'child_name' => Parse::name(implode(' ', array_reverse(array_map('trim', explode(',', $i['Nombre'] ?? '', 2))))),
                    'origin' => str_contains(mb_strtolower($i['Origen Inscripción'] ?? ''), 'línea') ? 'web' : 'jardin',
                    'status' => 'nueva',
                    'data' => $i,
                ], 'legacy_ref');
                $this->count('inscripciones');
            }
        }
    }

    // ───────────────────────── grades ─────────────────────────
    /**
     * Cerkademia grades by marking achievements (logros), each with its performance level, per student,
     * subject and period; a numeric score exists only occasionally. Every offered achievement goes to the
     * bank; the checked ones are linked to the student's grade entry. The entry's level is the most common
     * level among the checked achievements.
     */
    private function grades2(): void
    {
        $data = $this->json('grades');
        if (!$data) return;
        $levels = [];
        foreach ($this->db->all('SELECT id, name FROM performance_levels') as $l) $levels[$l['name']] = (int) $l['id'];
        $periods = [];
        foreach ($this->db->all('SELECT id, year_id, number FROM periods') as $p) $periods["{$p['year_id']}|{$p['number']}"] = (int) $p['id'];
        $achIds = [];
        $insEntry = $this->db->pdo()->prepare(
            'INSERT INTO grade_entries (enrollment_id, subject_id, period_id, score, performance_level_id, absences, updated_by)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE score = VALUES(score), performance_level_id = VALUES(performance_level_id), absences = VALUES(absences), id = LAST_INSERT_ID(id)'
        );
        $insLink = $this->db->pdo()->prepare('INSERT IGNORE INTO grade_entry_achievements (grade_entry_id, achievement_id, performance_level_id) VALUES (?, ?, ?)');
        foreach ($data as $y => $byPeriod) {
            foreach (['1', '2', '3', '4'] as $p) {
                foreach ($byPeriod[$p] ?? [] as $course => $rows) {
                    $gradeId = $this->gradeIds[Parse::gradeOfCourse($course)] ?? null;
                    foreach ($rows as $r) {
                        $enr = $this->enrollmentIds[($r['code'] ?? '') . "|$y"] ?? null;
                        $subject = trim($r['subject'] ?? '');
                        if (!$enr || !$gradeId || $subject === '') continue;
                        $sid = $this->subjectIds[$subject] ??= $this->upsert('subjects', ['name' => $subject], 'name');
                        // academic assignment (course × subject × teacher) comes from the grade rows
                        if (isset($this->courseIds["$y|$course"])) {
                            $this->db->run('INSERT INTO course_subjects (course_id, subject_id, teacher_staff_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE teacher_staff_id = COALESCE(VALUES(teacher_staff_id), teacher_staff_id)', [$this->courseIds["$y|$course"], $sid, $this->staffId($r['teacher'] ?? null)]);
                        }
                        $checked = [];
                        foreach ($r['achievements'] ?? [] as $a) {
                            $text = trim($a['text'] ?? '');
                            if ($text === '') continue;
                            $lvl = $levels[$a['level'] ?? ''] ?? null;
                            $key = md5("$gradeId|$sid|$p|" . mb_strtolower($text));
                            if (!isset($achIds[$key])) {
                                $achIds[$key] = $this->upsert('achievements', ['legacy_ref' => "ach:$key", 'grade_level_id' => $gradeId, 'subject_id' => $sid, 'period_number' => (int) $p, 'performance_level_id' => $lvl, 'description' => $text], 'legacy_ref');
                                $this->count('logros');
                            }
                            if (!empty($a['checked'])) $checked[] = [$achIds[$key], $lvl];
                        }
                        if (!$checked && !$r['score']) continue;
                        $counts = array_count_values(array_filter(array_column($checked, 1)));
                        arsort($counts);
                        $score = is_numeric(str_replace(',', '.', (string) $r['score'])) ? (float) str_replace(',', '.', (string) $r['score']) : null;
                        $insEntry->execute([$enr, $sid, $periods["$y|$p"], $score, $counts ? array_key_first($counts) : null, ctype_digit((string) $r['absences']) ? (int) $r['absences'] : null, Parse::name($r['teacher'] ?? '') ?: null]);
                        $entryId = (int) $this->db->pdo()->lastInsertId();
                        foreach ($checked as [$aid, $lvl]) $insLink->execute([$entryId, $aid, $lvl]);
                        $this->count('calificaciones');
                    }
                }
            }
        }
        // current year: families see the periods that already have grades, course by course (from now on each
        // teacher publishes their course from Calificaciones)
        $this->db->run("INSERT IGNORE INTO course_period_publications (course_id, period_id, published_by)
                        SELECT DISTINCT e.course_id, ge.period_id, 'Cerkademia' FROM grade_entries ge
                        JOIN enrollments e ON e.id = ge.enrollment_id JOIN periods p ON p.id = ge.period_id
                        JOIN academic_years y ON y.id = p.year_id AND y.status = 'active'
                        WHERE e.course_id IS NOT NULL");
        // safety net: every subject graded in a course belongs to that course's plan
        $this->db->run('INSERT IGNORE INTO course_subjects (course_id, subject_id)
                        SELECT DISTINCT e.course_id, ge.subject_id FROM grade_entries ge JOIN enrollments e ON e.id = ge.enrollment_id WHERE e.course_id IS NOT NULL');
    }

    // ───────────────────────── people details ─────────────────────────
    /** Fills phones / e-mails / addresses of guardians and teachers from their own detail pages. */
    private function enrichPeople(): void
    {
        $p = $this->json('people');
        foreach ($p['guardians'] ?? [] as $g) {
            $f = $g['fields'];
            $doc = preg_replace('/[.\s]/', '', (string) ($f['TxtDocumento'] ?? ''));
            if ($doc === '') continue;
            $email = filter_var(trim((string) ($f['TxtEmail'] ?? '')), FILTER_VALIDATE_EMAIL) ?: null;
            $phones = preg_split('/\s*[,;\/-]\s*|\s{2,}/', trim((string) ($f['TxtTelefonos'] ?? ''))) ?: [];
            $n = $this->db->run(
                'UPDATE guardians SET phone = COALESCE(?, phone), phone2 = COALESCE(?, phone2), email = COALESCE(email, ?), address = COALESCE(address, ?) WHERE doc_number = ?',
                [Parse::nullIfEmpty($phones[0] ?? null), Parse::nullIfEmpty($phones[1] ?? null), $email, Parse::nullIfEmpty($f['TxtDireccion'] ?? null), $doc],
            )->rowCount();
            if ($n) $this->count('acudientes completados', $n);
        }
        foreach ($p['teachers'] ?? [] as $t) {
            $f = $t['fields'];
            $name = Parse::name(trim(implode(' ', array_filter([$f['TxtPrimerNombre'] ?? '', $f['TxtSegundoNombre'] ?? '', $f['TxtPrimerApellido'] ?? '', $f['TxtSegundoApellido'] ?? '']))));
            $id = $this->staffId($name);
            if (!$id) continue;
            $this->db->update('staff', array_filter([
                'phone' => Parse::nullIfEmpty($f['TxtTelefonos'] ?? null),
                'email' => filter_var(trim((string) ($f['TxtEmail'] ?? '')), FILTER_VALIDATE_EMAIL) ?: null,
            ], static fn($v) => $v !== null) ?: ['active' => 1], ['id' => $id]);
            $this->count('profesores completados');
        }
    }

    // ───────────────────────── cartera ─────────────────────────
    /**
     * Rebuilds every account from the Cerkademia movements ("Todos"): debits (pensión, matrícula, saldo
     * anterior, nota débito) become charges; payments, discounts, surcharges and balance transfers list the
     * exact debits they affect (ID + value), so allocations and adjustments are recreated one to one.
     */
    private function cartera(): void
    {
        $data = $this->json('cartera');
        if (!$data) return;
        $report = [];
        foreach ($this->json('payments') as $rows) foreach ($rows as $r) $report[$r['id']] = $r;
        $concept = [];
        foreach ($this->db->all('SELECT id, code FROM billing_concepts') as $c) $concept[$c['code']] = (int) $c['id'];
        $concept['SALDO_ANTERIOR'] = $this->upsert('billing_concepts', ['code' => 'SALDO_ANTERIOR', 'name' => 'Saldo anterior', 'frequency' => 'eventual', 'online_payable' => 1], 'code');
        $concept['NOTA_DEBITO'] = $this->upsert('billing_concepts', ['code' => 'NOTA_DEBITO', 'name' => 'Nota débito', 'frequency' => 'eventual'], 'code');
        $policy = \Gabush\Domain\Billing\LateFeePolicy::fromSettings([]);

        // 1) collect unique movements (the same movement can show up in two years)
        $moves = [];
        foreach ($data as $y => $accounts) {
            foreach ($accounts as $code => $acc) {
                foreach ($acc['movements'] ?? [] as $m) {
                    if (!ctype_digit((string) $m['id'])) continue;
                    $moves[$m['id']] ??= $m + ['_code' => $code, '_year' => (int) $y];
                }
            }
        }
        $kindOf = static function (array $m): string {
            $t = mb_strtoupper((string) ($m['spans']['lblTituloMovto'] ?? ''));
            return match (true) {
                str_starts_with($t, 'PENSI') => 'PENSION',
                str_starts_with($t, 'MATR') => 'MATRICULA',
                str_starts_with($t, 'SALDO ANTERIOR') => 'SALDO_ANTERIOR',
                str_starts_with($t, 'NOTA D') => 'NOTA_DEBITO',
                str_starts_with($t, 'CLAUSURA') => 'CLAUSURA',
                str_starts_with($t, 'PAGO') => 'pago',
                str_starts_with($t, 'DESCUENTO') => 'descuento',
                str_starts_with($t, 'RECARGO') => 'recargo',
                str_starts_with($t, 'TRASLADO') => 'traslado',
                default => 'otro',
            };
        };
        /** rows of the "ID | … | Referencia | Valor" table: [[debitId, value], …] */
        $affected = static function (array $m): array {
            $out = [];
            foreach ($m['tables'] as $t) {
                if (($t[0][0] ?? '') !== 'ID') continue;
                foreach (array_slice($t, 1) as $r) if (ctype_digit((string) ($r[0] ?? ''))) $out[] = [(string) $r[0], abs((int) Parse::money(end($r)))];
            }
            return $out;
        };

        // 2) debits → charges
        $chargeIds = [];
        $dupMonth = null;
        foreach ($moves as $id => $m) {
            $k = $kindOf($m);
            if (!in_array($k, ['PENSION', 'MATRICULA', 'SALDO_ANTERIOR', 'NOTA_DEBITO', 'CLAUSURA', 'otro'], true)) continue;
            $sid = $this->studentIds[$m['_code']] ?? null;
            if (!$sid) continue;
            $desc = Parse::name($m['kv']['Descripción'] ?? ($m['spans']['lblTituloMovto'] ?? 'Cobro'));
            if ($k === 'NOTA_DEBITO') $desc = 'Nota débito' . (isset($m['kv']['Motivo/Descripción']) ? ' (' . Parse::name($m['kv']['Motivo/Descripción']) . ')' : '');
            if ($k === 'SALDO_ANTERIOR') $desc = Parse::name($m['spans']['lblTituloMovto'] ?? 'Saldo anterior');
            $month = $k === 'PENSION' ? Parse::monthOf($m['spans']['lblTituloMovto'] ?? $desc) : null;
            $created = Parse::datetime($m['date']) ?? "{$m['_year']}-01-01 00:00:00";
            // Cerkademia sometimes charged the same month twice: the extra one is kept, without the month key
            // (one pension per student and month is what stops the automatic billing from duplicating)
            if ($month && $this->db->value('SELECT 1 FROM charges WHERE student_id = ? AND concept_id = ? AND period_month = ? AND (legacy_ref IS NULL OR legacy_ref <> ?)', [$sid, $concept[$k], $month, "mov:$id"])) {
                $this->count('pensiones repetidas en Cerkademia');
                $dupMonth = $month;
                $month = null;
            }
            $chargeIds[$id] = $this->upsert('charges', [
                'legacy_ref' => "mov:$id",
                'student_id' => $sid,
                'enrollment_id' => $this->enrollmentIds["{$m['_code']}|{$m['_year']}"] ?? null,
                'year_id' => $month ? (int) substr($month, 0, 4) : $m['_year'],
                'concept_id' => $concept[$k] ?? $concept['OTRO'],
                'description' => mb_substr($desc, 0, 160),
                'period_month' => $month,
                'amount' => abs((int) Parse::money($m['kv']['VALOR'] ?? '0')),
                'due_on' => ($month ?? ($dupMonth ?? null)) ? $policy->dueDateFor(new \DateTimeImmutable($month ?? $dupMonth))->format('Y-m-d') : substr($created, 0, 10),
                'status' => 'abierto',
                'source' => 'importado',
                'created_by' => 'Cerkademia',
                'created_at' => $created,
            ], 'legacy_ref');
            $this->count('cobros');
            $dupMonth = null;
        }

        // 3) payments: union of the PAGO movements and the payments report (some only appear in the report).
        //    Allocations, in order of reliability: the PAGO movement's affected debits, the "pagos" table inside
        //    each debit (payment ID + value), or the report's affected charges matched by description.
        $fromDebits = [];
        foreach ($moves as $id => $m) {
            if (!isset($chargeIds[$id])) continue;
            foreach ($m['tables'] as $t) {
                if (($t[0][0] ?? '') !== 'ID' || !in_array('Punto de Pago', $t[0], true)) continue;
                foreach (array_slice($t, 1) as $r) if (ctype_digit((string) ($r[0] ?? ''))) $fromDebits[$r[0]][] = [$chargeIds[$id], abs((int) Parse::money(end($r)))];
            }
        }
        $norm = static fn(string $s) => preg_replace('/\s+/', ' ', mb_strtolower(strtr(trim($s), ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'Á' => 'a', 'É' => 'e', 'Í' => 'i', 'Ó' => 'o', 'Ú' => 'u'])));
        $byDesc = [];
        foreach ($this->db->all("SELECT id, student_id, description FROM charges WHERE source = 'importado'") as $c) $byDesc[$c['student_id'] . '|' . $norm($c['description'])][] = (int) $c['id'];
        $payments = [];
        foreach ($moves as $id => $m) if ($kindOf($m) === 'pago') $payments[$id] = ['move' => $m, 'code' => $m['_code']];
        foreach ($report as $id => $r) if (!isset($payments[$id]) && !empty($r['code']) && isset($this->studentIds[$r['code']])) $payments[$id] = ['move' => null, 'code' => $r['code']];
        $insAlloc = $this->db->pdo()->prepare('INSERT INTO payment_allocations (payment_id, charge_id, amount) VALUES (?, ?, ?)');
        $matched = ['movimiento' => 0, 'cobro' => 0, 'descripción' => 0, 'a favor' => 0];
        foreach ($payments as $id => $pp) {
            $id = (string) $id;
            $m = $pp['move'];
            $rep = $report[$id] ?? null;
            $sid = $this->studentIds[$pp['code']] ?? null;
            if (!$sid) { $this->count('pagos de estudiantes sin ficha'); continue; }
            $info = [];
            foreach ($m['tables'] ?? [] as $t) foreach ($t as $r) if (isset($r[0], $r[1]) && str_ends_with($r[0], ':')) $info[rtrim($r[0], ':')] = $r[1];
            $paid = Parse::date($info['Fecha de pago'] ?? ($rep['paidAt'] ?? ($m['date'] ?? ''))) ?? substr((string) Parse::datetime($m['date'] ?? ''), 0, 10);
            if (!$paid) continue;
            $amount = abs((int) Parse::money($m['kv']['VALOR'] ?? ($rep['total'] ?? '0')));
            $entered = Parse::datetime($rep['details']['Fecha de ingreso'] ?? null) ?? ($paid . ' 00:00:00');
            $pid = $this->upsert('payments', [
                'legacy_ref' => "pay:$id",
                'student_id' => $sid,
                'receipt_number' => $id,
                'paid_on' => $paid,
                'amount' => $amount,
                'method' => mb_strtolower(Parse::nullIfEmpty($m['kv']['Punto de pago'] ?? ($info['Punto de pago'] ?? ($rep['details']['Punto de pago'] ?? null))) ?? 'colegio'),
                'reference' => Parse::nullIfEmpty($m['kv']['Referencia'] ?? ($info['Referencia'] ?? ($rep['details']['Referencia'] ?? null))),
                'status' => 'aprobado',
                'source' => 'importado',
                'created_by' => Parse::name($rep['details']['Ingresado por'] ?? ($m['spans']['lblNombreUsuario'] ?? 'Cerkademia')),
                'created_at' => $entered,
                'approved_at' => $entered,
            ], 'legacy_ref');
            $this->db->run('DELETE FROM payment_allocations WHERE payment_id = ?', [$pid]);
            $alloc = [];
            if ($m) foreach ($affected($m) as [$debit, $value]) if (isset($chargeIds[$debit]) && $value > 0) $alloc[] = [$chargeIds[$debit], $value];
            $how = 'movimiento';
            if (!$alloc && isset($fromDebits[$id])) { $alloc = $fromDebits[$id]; $how = 'cobro'; }
            if (!$alloc && $rep) {
                foreach ($rep['charges'] as $c) {
                    $cands = $byDesc[$sid . '|' . $norm((string) ($c[0] ?? ''))] ?? [];
                    if ($cands) $alloc[] = [$cands[0], abs((int) Parse::money($c[1] ?? '0'))];
                }
                $how = 'descripción';
            }
            if (!$alloc) $how = 'a favor';
            foreach ($alloc as [$cid, $value]) if ($value > 0) $insAlloc->execute([$pid, $cid, $value]);
            $matched[$how]++;
            $this->count('pagos');
        }
        foreach ($matched as $k => $v) $this->count("pagos enlazados por $k", $v);

        // 4) discounts, surcharges, transfers
        foreach ($moves as $id => $m) {
            $k = $kindOf($m);
            $sid = $this->studentIds[$m['_code']] ?? null;
            if (!$sid) continue;
            if (in_array($k, ['descuento', 'recargo', 'traslado'], true)) {
                $reason = Parse::nullIfEmpty(trim((string) ($m['kv']['Motivo/Descripción'] ?? ''), ' .')) ?? ucfirst($k);
                foreach ($affected($m) as $i => [$debit, $value]) {
                    if (!isset($chargeIds[$debit]) || $value <= 0) continue;
                    $this->upsert('charge_adjustments', [
                        'legacy_ref' => "adj:$id:$i",
                        'charge_id' => $chargeIds[$debit],
                        'kind' => $k,
                        'amount' => $value,
                        'reason' => $k === 'traslado' ? 'Traslado de saldo al año siguiente' : mb_substr($reason, 0, 200),
                        'created_by' => 'Cerkademia',
                        'created_at' => Parse::datetime($m['date']) ?? date('Y-m-d H:i:s'),
                    ], 'legacy_ref');
                    $this->count($k === 'descuento' ? 'descuentos' : ($k === 'recargo' ? 'recargos' : 'traslados'));
                }
            }
        }

        // 4) status of every imported charge from its balance
        $this->db->run(
            "UPDATE charges c
             LEFT JOIN (SELECT charge_id,
                               SUM(CASE WHEN kind IN ('descuento','traslado') THEN -amount WHEN kind = 'recargo' THEN amount WHEN kind = 'mora' AND waived = 0 THEN amount ELSE 0 END) AS adj
                        FROM charge_adjustments GROUP BY charge_id) a ON a.charge_id = c.id
             LEFT JOIN (SELECT pa.charge_id, SUM(pa.amount) AS paid FROM payment_allocations pa JOIN payments p ON p.id = pa.payment_id AND p.status = 'aprobado' GROUP BY pa.charge_id) p ON p.charge_id = c.id
             SET c.status = IF(GREATEST(0, c.amount + COALESCE(a.adj, 0)) - COALESCE(p.paid, 0) <= 0, 'pagado', 'abierto')
             WHERE c.source = 'importado'"
        );
        // late fees only for charges that fall due after the import (no retroactive fees on old debts)
        $lf = (array) (json_decode((string) $this->db->value("SELECT value FROM settings WHERE `key` = 'late_fee'"), true) ?? []);
        if (empty($lf['appliesFrom'])) {
            $lf = ['enabled' => true, 'amountPerDay' => 10000, 'dueDay' => 5, 'graceDays' => 0, 'maxAmount' => null] + $lf;
            $lf['appliesFrom'] = date('Y-m-d');
            $this->db->run("INSERT INTO settings (`key`, value) VALUES ('late_fee', ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [json_encode($lf)]);
        }
    }

    // ───────────────────────── cash ─────────────────────────
    private function cash(): void
    {
        $misc = $this->json('misc');
        $this->db->run("INSERT IGNORE INTO cash_boxes (name) VALUES ('Principal')");
        foreach ($misc['cashConcepts']['egreso'] ?? [] as $c) {
            $this->db->run('INSERT INTO cash_concepts (kind, name, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE description = VALUES(description)', ['egreso', Parse::name(ucfirst((string) $c['Nombre'])), Parse::nullIfEmpty($c['Descripción'] ?? null)]);
            $this->count('conceptos de egreso');
        }
        foreach (array_merge(['Pagos estudiantes'], array_map('ucfirst', (array) ($misc['cashConcepts']['ingreso'] ?? []))) as $name) {
            $this->db->run('INSERT IGNORE INTO cash_concepts (kind, name) VALUES (?, ?)', ['ingreso', $name]);
        }
    }

    // ───────────────────────── photos ─────────────────────────
    private function photos(): void
    {
        $src = dirname($this->rawDir) . '/photos';
        $dest = $this->dataDir . '/students';
        if (!is_dir($dest)) mkdir($dest, 0750, true);
        foreach ($this->studentIds as $code => $id) {
            $file = "$src/$code.jpg";
            if (!is_file($file)) continue;
            $name = "$code.jpg";
            if (!is_file("$dest/$name")) self::resizeJpeg($file, "$dest/$name", 720);
            $this->db->update('students', ['photo_path' => "students/$name"], ['id' => $id]);
            $this->count('fotos');
        }
    }

    public static function resizeJpeg(string $from, string $to, int $max): void
    {
        $img = @imagecreatefromjpeg($from);
        if (!$img) { copy($from, $to); return; }
        if (function_exists('exif_read_data')) {
            $o = (int) (@exif_read_data($from)['Orientation'] ?? 1);
            $img = match ($o) { 3 => imagerotate($img, 180, 0), 6 => imagerotate($img, -90, 0), 8 => imagerotate($img, 90, 0), default => $img };
        }
        $w = imagesx($img); $h = imagesy($img);
        $scale = min(1, $max / max($w, $h));
        $out = imagescale($img, (int) round($w * $scale), (int) round($h * $scale), IMG_BICUBIC);
        imagejpeg($out ?: $img, $to, 82);
    }
}
