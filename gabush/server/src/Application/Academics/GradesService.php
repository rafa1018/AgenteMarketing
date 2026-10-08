<?php
declare(strict_types=1);

namespace Gabush\Application\Academics;

use Gabush\App;
use Gabush\Domain\Academics\ReportCard;
use Gabush\Infrastructure\Database\Database;

/** Grade sheets (planilla) per course/subject/period and report cards (boletín) per student and year. */
final class GradesService
{
    public function __construct(private readonly Database $db)
    {
    }

    public static function from(App $app): self
    {
        return $app->service(self::class, static fn(App $a) => new self($a->db()));
    }

    public function reportCardRules(): ReportCard
    {
        $levels = array_map(static fn($l) => ['id' => (int) $l['id'], 'name' => $l['name'], 'min' => (float) $l['min_score'], 'max' => (float) $l['max_score']], $this->db->all('SELECT * FROM performance_levels ORDER BY min_score'));
        return new ReportCard(array_values(array_filter($levels, static fn($l) => $l['max'] > 0)));
    }

    /**
     * The sheet a teacher fills: students of the course × the achievements available for the grade/subject/
     * period, with what is already marked.
     * @return array<string,mixed>
     */
    public function sheet(int $courseId, int $subjectId, int $periodId): array
    {
        $course = $this->db->one('SELECT c.id, c.name, c.grade_level_id, c.year_id FROM courses c WHERE c.id = ?', [$courseId]);
        $period = $this->db->one('SELECT id, number, name, grading_open, published FROM periods WHERE id = ?', [$periodId]);
        if (!$course || !$period) return [];
        $students = $this->db->all(
            "SELECT e.id AS enrollmentId, s.id, s.code, s.first_name AS firstName, s.last_name AS lastName, s.second_last_name AS secondLastName, s.photo_path IS NOT NULL AS hasPhoto
             FROM enrollments e JOIN students s ON s.id = e.student_id WHERE e.course_id = ? AND e.status = 'activo' ORDER BY s.last_name, s.first_name",
            [$courseId],
        );
        $achievements = $this->db->all(
            'SELECT id, description, performance_level_id AS levelId, period_number AS period FROM achievements
             WHERE grade_level_id = ? AND subject_id = ? AND active = 1 AND (period_number IS NULL OR period_number = ?) ORDER BY period_number IS NULL, performance_level_id DESC, description',
            [$course['grade_level_id'], $subjectId, $period['number']],
        );
        $entries = [];
        foreach ($this->db->all(
            "SELECT ge.id, ge.enrollment_id, ge.score, ge.performance_level_id AS levelId, ge.level_manual AS levelManual, ge.absences, ge.comments,
                    (SELECT GROUP_CONCAT(CONCAT(achievement_id, ':', COALESCE(performance_level_id, ''))) FROM grade_entry_achievements WHERE grade_entry_id = ge.id) AS marked
             FROM grade_entries ge JOIN enrollments e ON e.id = ge.enrollment_id WHERE e.course_id = ? AND ge.subject_id = ? AND ge.period_id = ?",
            [$courseId, $subjectId, $periodId],
        ) as $g) {
            // achievementLevels: the level the teacher gave this child in each marked achievement
            $levels = [];
            foreach ($g['marked'] ? explode(',', $g['marked']) : [] as $pair) {
                [$aid, $lid] = array_pad(explode(':', $pair), 2, '');
                $levels[(int) $aid] = $lid !== '' ? (int) $lid : null;
            }
            $entries[(int) $g['enrollment_id']] = [
                'score' => $g['score'] !== null ? (float) $g['score'] : null, 'levelId' => $g['levelId'] !== null ? (int) $g['levelId'] : null, 'levelManual' => (bool) $g['levelManual'],
                'absences' => $g['absences'] !== null ? (int) $g['absences'] : null, 'comments' => $g['comments'],
                'achievements' => array_keys($levels), 'achievementLevels' => $levels ?: new \stdClass(),
            ];
        }
        return [
            'course' => ['id' => (int) $course['id'], 'name' => $course['name'], 'gradeLevelId' => (int) $course['grade_level_id']],
            'period' => [
                'id' => (int) $period['id'], 'number' => (int) $period['number'], 'name' => $period['name'], 'gradingOpen' => (bool) $period['grading_open'],
                // visible to the families of this course: published for the whole school or for this course
                'published' => (bool) $period['published'] || (bool) $this->db->value('SELECT 1 FROM course_period_publications WHERE course_id = ? AND period_id = ?', [$courseId, $periodId]),
                'publishedForAll' => (bool) $period['published'],
            ],
            'achievements' => array_map(static fn($a) => ['id' => (int) $a['id'], 'levelId' => $a['levelId'] !== null ? (int) $a['levelId'] : null, 'period' => $a['period'] !== null ? (int) $a['period'] : null, 'description' => $a['description']], $achievements),
            'students' => array_map(static fn($s) => ['enrollmentId' => (int) $s['enrollmentId'], 'id' => (int) $s['id'], 'code' => $s['code'], 'name' => trim("{$s['lastName']} {$s['secondLastName']}, {$s['firstName']}"), 'hasPhoto' => (bool) $s['hasPhoto'], 'entry' => $entries[(int) $s['enrollmentId']] ?? null], $students),
        ];
    }

    /**
     * Saves the sheet. Per enrollment:
     *  - achievements: marked ids, and achievementLevels {id: levelId} = the level the teacher gave this child in
     *    each one (default: the level the achievement has in the bank);
     *  - levelId: the subject level set by hand (null = automatic: from the score 0–10, else from the levels
     *    of the marked achievements);
     *  - score, absences, comments.
     * @param list<array<string,mixed>> $rows
     */
    public function saveSheet(int $subjectId, int $periodId, array $rows, string $by): int
    {
        $rules = $this->reportCardRules();
        $validLevels = array_map('intval', array_column($this->db->all('SELECT id FROM performance_levels'), 'id'));
        $bankLevel = [];
        foreach ($this->db->all('SELECT id, performance_level_id FROM achievements WHERE subject_id = ?', [$subjectId]) as $a) $bankLevel[(int) $a['id']] = $a['performance_level_id'] !== null ? (int) $a['performance_level_id'] : null;
        $valid = static fn($l) => $l !== null && $l !== '' && in_array((int) $l, $validLevels, true) ? (int) $l : null;
        $saved = 0;
        $this->db->transaction(function () use ($rows, $subjectId, $periodId, $by, $rules, $bankLevel, $valid, &$saved): void {
            foreach ($rows as $r) {
                $ach = array_values(array_filter(array_map('intval', (array) ($r['achievements'] ?? [])), static fn($id) => array_key_exists($id, $bankLevel)));
                $given = (array) ($r['achievementLevels'] ?? []);
                $linkLevel = [];
                foreach ($ach as $a) $linkLevel[$a] = $valid($given[$a] ?? $given[(string) $a] ?? null) ?? $bankLevel[$a];
                $score = isset($r['score']) && $r['score'] !== '' && $r['score'] !== null ? round((float) str_replace(',', '.', (string) $r['score']), 1) : null;
                $manual = $valid($r['levelId'] ?? null);
                $level = $manual ?? $rules->levelOfScore($score) ?? $rules->levelOfAchievements(array_values($linkLevel));
                $this->db->run(
                    'INSERT INTO grade_entries (enrollment_id, subject_id, period_id, score, performance_level_id, level_manual, absences, comments, updated_by)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE score = VALUES(score), performance_level_id = VALUES(performance_level_id), level_manual = VALUES(level_manual),
                                             absences = VALUES(absences), comments = VALUES(comments), updated_by = VALUES(updated_by), id = LAST_INSERT_ID(id)',
                    [(int) $r['enrollmentId'], $subjectId, $periodId, $score, $level, $manual !== null ? 1 : 0, isset($r['absences']) && $r['absences'] !== '' ? (int) $r['absences'] : null, $r['comments'] ?? null, $by],
                );
                $entry = (int) $this->db->pdo()->lastInsertId();
                $this->db->run('DELETE FROM grade_entry_achievements WHERE grade_entry_id = ?', [$entry]);
                foreach ($linkLevel as $a => $l) $this->db->run('INSERT INTO grade_entry_achievements (grade_entry_id, achievement_id, performance_level_id) VALUES (?, ?, ?)', [$entry, $a, $l]);
                $saved++;
            }
        });
        return $saved;
    }

    /**
     * Report card of a student for a year: per area → subject → period (level, achievements, absences) and
     * the final level. $onlyPublished hides periods the school has not published (portal).
     * @return array<string,mixed>
     */
    public function reportCard(int $studentId, int $year, bool $onlyPublished = false): array
    {
        $rules = $this->reportCardRules();
        $enr = $this->db->one('SELECT e.id, e.course_id, c.name AS course, c.grade_level_id FROM enrollments e LEFT JOIN courses c ON c.id = e.course_id WHERE e.student_id = ? AND e.year_id = ?', [$studentId, $year]);
        if (!$enr) return ['year' => $year, 'course' => null, 'periods' => [], 'areas' => []];
        // a period is published for the whole school (rectora) or for the student's course (its teacher)
        $periods = $this->db->all(
            'SELECT p.id, p.number, p.name, p.weight, (p.published OR cpp.course_id IS NOT NULL) AS published
             FROM periods p LEFT JOIN course_period_publications cpp ON cpp.period_id = p.id AND cpp.course_id = ?
             WHERE p.year_id = ? ORDER BY p.number',
            [(int) $enr['course_id'], $year],
        );
        if ($onlyPublished) $periods = array_values(array_filter($periods, static fn($p) => (bool) $p['published']));
        $pIds = array_map(static fn($p) => (int) $p['id'], $periods);
        $entries = $pIds ? $this->db->all(
            'SELECT ge.id, ge.subject_id, ge.period_id, ge.score, ge.performance_level_id AS levelId, ge.absences, ge.comments, s.name AS subject, s.area_id, a.name AS area, a.report_position
             FROM grade_entries ge JOIN subjects s ON s.id = ge.subject_id LEFT JOIN areas a ON a.id = s.area_id
             WHERE ge.enrollment_id = ? AND ge.period_id IN (' . implode(',', $pIds) . ')',
            [$enr['id']],
        ) : [];
        $ach = [];
        if ($entries) {
            foreach ($this->db->all('SELECT gea.grade_entry_id, a.description, gea.performance_level_id AS levelId FROM grade_entry_achievements gea JOIN achievements a ON a.id = gea.achievement_id WHERE gea.grade_entry_id IN (' . implode(',', array_map(static fn($e) => (int) $e['id'], $entries)) . ')') as $x) {
                $ach[(int) $x['grade_entry_id']][] = ['description' => $x['description'], 'level' => $rules->name($x['levelId'] !== null ? (int) $x['levelId'] : null)];
            }
        }
        $areas = [];
        foreach ($entries as $e) {
            $aKey = (string) ($e['area_id'] ?? 0);
            $areas[$aKey] ??= ['name' => $e['area'] ?? 'Otras', 'position' => (int) ($e['report_position'] ?? 99), 'subjects' => []];
            $areas[$aKey]['subjects'][$e['subject_id']] ??= ['name' => $e['subject'], 'periods' => []];
            $areas[$aKey]['subjects'][$e['subject_id']]['periods'][(int) $e['period_id']] = [
                'level' => $rules->name($e['levelId'] !== null ? (int) $e['levelId'] : null), 'levelId' => $e['levelId'] !== null ? (int) $e['levelId'] : null,
                'score' => $e['score'] !== null ? (float) $e['score'] : null, 'absences' => $e['absences'] !== null ? (int) $e['absences'] : null,
                'comments' => $e['comments'], 'achievements' => $ach[(int) $e['id']] ?? [],
            ];
        }
        $weights = [];
        foreach ($periods as $p) $weights[(int) $p['id']] = (float) $p['weight'];
        foreach ($areas as &$a) {
            foreach ($a['subjects'] as &$s) {
                $final = $rules->finalLevel(array_map(static fn($pid, $x) => ['level' => $x['levelId'], 'weight' => $weights[$pid] ?? 25], array_keys($s['periods']), $s['periods']));
                $s['final'] = $rules->name($final);
                $s['absences'] = array_sum(array_map(static fn($x) => (int) $x['absences'], $s['periods']));
            }
            unset($s);
            uasort($a['subjects'], static fn($x, $y) => strcmp($x['name'], $y['name']));
            $a['subjects'] = array_values($a['subjects']);
        }
        unset($a);
        uasort($areas, static fn($x, $y) => $x['position'] <=> $y['position']);
        return [
            'year' => $year,
            'course' => $enr['course'],
            'periods' => array_map(static fn($p) => ['id' => (int) $p['id'], 'number' => (int) $p['number'], 'name' => $p['name'], 'published' => (bool) $p['published']], $periods),
            'areas' => array_values($areas),
        ];
    }
}
