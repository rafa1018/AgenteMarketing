<?php
declare(strict_types=1);

namespace Gabush\Http\Controllers;

use Gabush\App;
use Gabush\Application\Billing\BillingService;
use Gabush\Http\HttpError;
use Gabush\Http\Request;
use Gabush\Http\Response;
use Gabush\Http\Router;

/**
 * Downloadable reports (Excel / CSV) for the panel. Each one needs the permission of its area; the year comes
 * from ?year= (working year by default) and date ranges from ?from=&to=.
 */
final class ReportsController extends Controller
{
    /** key => [title, permissions] */
    private const REPORTS = [
        'estudiantes' => ['Estudiantes y acudientes', ['estudiantes', 'matriculas']],
        'matriculas' => ['Matrículas', ['matriculas']],
        'cartera' => ['Cartera por estudiante', ['pagos']],
        'cobros' => ['Cobros del año', ['pagos']],
        'pagos' => ['Pagos recibidos', ['pagos']],
        'notas' => ['Calificaciones', ['calificaciones', 'academico']],
        'asistencia' => ['Asistencia', ['asistencia']],
        'caja' => ['Caja: ingresos y egresos', ['caja']],
    ];

    public static function routes(Router $r, App $app): void
    {
        $c = new self($app);
        $r->add('GET', '/reports/{key}', [$c, 'download']);
    }

    public function download(Request $req): Response
    {
        $key = $req->param('key');
        [$title, $perms] = self::REPORTS[$key] ?? throw HttpError::notFound();
        $this->staff($req, ...$perms);
        $year = $this->year($req);
        $from = self::day($req->query('from')) ?? "$year-01-01";
        $to = self::day($req->query('to')) ?? "$year-12-31";
        [$head, $rows, $suffix] = match ($key) {
            'estudiantes' => $this->students($year),
            'matriculas' => $this->enrollments($year),
            'cartera' => $this->balances($year),
            'cobros' => $this->charges($year),
            'pagos' => $this->payments($from, $to),
            'notas' => $this->grades($year, $req->query('period') ? (int) $req->query('period') : null),
            'asistencia' => $this->attendance($from, $to),
            'caja' => $this->cash($from, $to),
        };
        $name = strtolower(strtr($title, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n', ':' => '', ' ' => '-'])) . "-$suffix.csv";
        return Response::csv(preg_replace('/-+/', '-', $name), $head, $rows);
    }

    private static function day(mixed $v): ?string
    {
        return is_string($v) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $v) ? $v : null;
    }

    private static function name(array $r): string
    {
        return trim(trim(($r['last_name'] ?? '') . ' ' . ($r['second_last_name'] ?? '')) . ', ' . trim(($r['first_name'] ?? '') . ' ' . ($r['middle_name'] ?? '')), ', ');
    }

    // ───────────────────────── reports ─────────────────────────
    private function students(int $year): array
    {
        $rows = $this->db()->all(
            "SELECT s.*, c.name AS course, e.status, pl.name AS plan,
                    g.full_name AS g_name, g.relationship AS g_rel, g.doc_number AS g_doc, g.phone AS g_phone, g.email AS g_email, g.address AS g_address,
                    (SELECT GROUP_CONCAT(CONCAT(g2.full_name, ' (', g2.relationship, ') ', COALESCE(g2.phone, '')) SEPARATOR ' | ') FROM guardians g2 WHERE g2.family_id = s.family_id AND g2.id <> g.id) AS others
             FROM enrollments e JOIN students s ON s.id = e.student_id LEFT JOIN courses c ON c.id = e.course_id LEFT JOIN plans pl ON pl.id = e.plan_id
             LEFT JOIN guardians g ON g.id = (SELECT id FROM guardians WHERE family_id = s.family_id ORDER BY is_primary DESC, is_billing DESC, id LIMIT 1)
             WHERE e.year_id = ? ORDER BY c.name, s.last_name, s.first_name",
            [$year],
        );
        return [
            ['Código', 'Estudiante', 'Tipo de documento', 'Documento', 'Fecha de nacimiento', 'Género', 'EPS', 'RH', 'Alergias', 'Curso', 'Estado', 'Plan', 'Acudiente principal', 'Parentesco', 'Cédula acudiente', 'Teléfono', 'Correo', 'Dirección', 'Otros acudientes'],
            array_map(static fn($r) => [$r['code'], self::name($r), $r['doc_type'], $r['doc_number'], $r['birth_date'], $r['gender'], $r['eps'], $r['blood_type'], $r['allergies'], $r['course'], $r['status'], $r['plan'], $r['g_name'], $r['g_rel'], $r['g_doc'], $r['g_phone'], $r['g_email'], $r['g_address'], $r['others']], $rows),
            (string) $year,
        ];
    }

    private function enrollments(int $year): array
    {
        $rows = $this->db()->all(
            "SELECT s.code, s.first_name, s.middle_name, s.last_name, s.second_last_name, c.name AS course, e.status, e.is_new, e.order_number, e.contract_signed, e.enrolled_on, e.withdrawn_on, e.withdraw_reason,
                    (SELECT MIN(e2.year_id) FROM enrollments e2 WHERE e2.student_id = s.id) AS since,
                    (SELECT COUNT(*) FROM enrollment_documents d JOIN document_types t ON t.id = d.document_type_id WHERE d.enrollment_id = e.id AND t.required = 1 AND d.status IN ('pendiente','rechazado')) AS docs_pending,
                    (SELECT COUNT(*) FROM portal_accounts pa WHERE pa.student_id = s.id AND pa.active = 1) AS portal
             FROM enrollments e JOIN students s ON s.id = e.student_id LEFT JOIN courses c ON c.id = e.course_id
             WHERE e.year_id = ? ORDER BY c.name, s.last_name",
            [$year],
        );
        return [
            ['Código', 'Estudiante', 'Curso', 'Estado', 'Nuevo', 'No. de orden', 'Contrato firmado', 'Fecha de matrícula', 'En el jardín desde', 'Fecha de retiro', 'Motivo de retiro', 'Documentos pendientes', 'Acceso al portal'],
            array_map(static fn($r) => [$r['code'], self::name($r), $r['course'], $r['status'], $r['is_new'] ? 'Sí' : 'No', $r['order_number'], $r['contract_signed'] ? 'Sí' : 'No', $r['enrolled_on'], $r['since'], $r['withdrawn_on'], $r['withdraw_reason'], (int) $r['docs_pending'], $r['portal'] ? 'Sí' : 'No'], $rows),
            (string) $year,
        ];
    }

    private function balances(int $year): array
    {
        $b = BillingService::from($this->app);
        $students = $this->db()->all(
            "SELECT s.id, s.code, s.first_name, s.middle_name, s.last_name, s.second_last_name, c.name AS course, e.status,
                    g.full_name AS guardian, g.phone
             FROM enrollments e JOIN students s ON s.id = e.student_id LEFT JOIN courses c ON c.id = e.course_id
             LEFT JOIN guardians g ON g.id = (SELECT id FROM guardians WHERE family_id = s.family_id ORDER BY is_billing DESC, is_primary DESC, id LIMIT 1)
             WHERE e.year_id = ? ORDER BY c.name, s.last_name",
            [$year],
        );
        $rows = [];
        foreach ($students as $s) {
            $y = $b->summary((int) $s['id'], $year);
            $t = $b->summary((int) $s['id']);
            $rows[] = [$s['code'], self::name($s), $s['course'], $s['status'], $s['guardian'], $s['phone'], $y['charged'], $y['paid'], $y['balance'], $y['overdue'], $y['lateFees'], $t['balance'], $t['credit'], $t['balance'] <= 0 ? 'Sí' : 'No'];
        }
        return [['Código', 'Estudiante', 'Curso', 'Estado', 'Responsable de pagos', 'Teléfono', "Cobrado $year", "Pagado $year", "Pendiente $year", 'Vencido', 'Mora', 'Pendiente total (todos los años)', 'Saldo a favor', 'Paz y salvo'], $rows, (string) $year];
    }

    private function charges(int $year): array
    {
        $b = BillingService::from($this->app);
        $rows = [];
        foreach ($this->db()->all('SELECT DISTINCT s.id, s.code, s.first_name, s.middle_name, s.last_name, s.second_last_name FROM charges c JOIN students s ON s.id = c.student_id WHERE c.year_id = ? ORDER BY s.last_name', [$year]) as $s) {
            foreach ($b->charges((int) $s['id'], $year) as $c) {
                $rows[] = [$s['code'], self::name($s), $c['concept'], $c['description'], $c['periodMonth'] ? substr((string) $c['periodMonth'], 0, 7) : '', $c['dueOn'], $c['amount'], $c['discounts'], $c['surcharges'], $c['lateFees'], $c['net'], $c['paid'], $c['balance'], $c['status'], $c['overdue'] ? 'Sí' : 'No'];
            }
        }
        return [['Código', 'Estudiante', 'Concepto', 'Descripción', 'Mes', 'Vence', 'Valor', 'Descuentos', 'Recargos', 'Mora', 'Neto', 'Pagado', 'Saldo', 'Estado', 'Vencido'], $rows, (string) $year];
    }

    private function payments(string $from, string $to): array
    {
        $rows = $this->db()->all(
            "SELECT p.*, s.code, s.first_name, s.middle_name, s.last_name, s.second_last_name,
                    (SELECT GROUP_CONCAT(CONCAT(c.description, ' $', pa.amount) SEPARATOR ' | ') FROM payment_allocations pa JOIN charges c ON c.id = pa.charge_id WHERE pa.payment_id = p.id) AS items
             FROM payments p JOIN students s ON s.id = p.student_id WHERE p.paid_on BETWEEN ? AND ? ORDER BY p.paid_on, p.id",
            [$from, $to],
        );
        return [
            ['Comprobante', 'Fecha de pago', 'Código', 'Estudiante', 'Valor', 'Medio de pago', 'Referencia', 'Origen', 'Estado', 'Cargos afectados', 'Ingresado por', 'Observaciones'],
            array_map(static fn($r) => [$r['receipt_number'], $r['paid_on'], $r['code'], self::name($r), (int) $r['amount'], $r['method'], $r['reference'], $r['source'], $r['status'], $r['items'], $r['created_by'], $r['notes']], $rows),
            "$from-a-$to",
        ];
    }

    private function grades(int $year, ?int $period): array
    {
        $rows = $this->db()->all(
            'SELECT s.code, s.first_name, s.middle_name, s.last_name, s.second_last_name, c.name AS course, p.number, p.name AS period, a.name AS area, sub.name AS subject,
                    pl.name AS level, ge.score, ge.absences, ge.comments,
                    (SELECT GROUP_CONCAT(ac.description SEPARATOR " | ") FROM grade_entry_achievements gea JOIN achievements ac ON ac.id = gea.achievement_id WHERE gea.grade_entry_id = ge.id) AS achievements
             FROM grade_entries ge JOIN enrollments e ON e.id = ge.enrollment_id JOIN students s ON s.id = e.student_id JOIN periods p ON p.id = ge.period_id
             JOIN subjects sub ON sub.id = ge.subject_id LEFT JOIN areas a ON a.id = sub.area_id LEFT JOIN courses c ON c.id = e.course_id
             LEFT JOIN performance_levels pl ON pl.id = ge.performance_level_id
             WHERE e.year_id = ?' . ($period ? ' AND p.number = ?' : '') . ' ORDER BY c.name, s.last_name, p.number, a.report_position, sub.name',
            $period ? [$year, $period] : [$year],
        );
        return [
            ['Curso', 'Código', 'Estudiante', 'Periodo', 'Dimensión', 'Materia', 'Desempeño', 'Nota', 'Fallas', 'Logros', 'Comentario'],
            array_map(static fn($r) => [$r['course'], $r['code'], self::name($r), $r['period'], $r['area'], $r['subject'], $r['level'], $r['score'], $r['absences'], $r['achievements'], $r['comments']], $rows),
            $year . ($period ? "-periodo-$period" : ''),
        ];
    }

    private function attendance(string $from, string $to): array
    {
        $rows = $this->db()->all(
            "SELECT s.code, s.first_name, s.middle_name, s.last_name, s.second_last_name, c.name AS course,
                    SUM(a.status = 'presente') AS present, SUM(a.status = 'tarde') AS late, SUM(a.status = 'justificada') AS justified, SUM(a.status = 'ausente') AS absent, COUNT(a.id) AS days
             FROM attendance a JOIN students s ON s.id = a.student_id
             LEFT JOIN enrollments e ON e.student_id = s.id AND e.year_id = YEAR(?) LEFT JOIN courses c ON c.id = e.course_id
             WHERE a.day BETWEEN ? AND ? GROUP BY s.id, c.name ORDER BY c.name, s.last_name",
            [$from, $from, $to],
        );
        return [
            ['Curso', 'Código', 'Estudiante', 'Días registrados', 'Asistió', 'Llegó tarde', 'Falta justificada', 'Falta', '% asistencia'],
            array_map(static fn($r) => [$r['course'], $r['code'], self::name($r), (int) $r['days'], (int) $r['present'], (int) $r['late'], (int) $r['justified'], (int) $r['absent'], $r['days'] ? round(((int) $r['present'] + (int) $r['late']) / (int) $r['days'] * 100) . '%' : ''], $rows),
            "$from-a-$to",
        ];
    }

    private function cash(string $from, string $to): array
    {
        $rows = $this->db()->all(
            'SELECT m.occurred_on, m.kind, cc.name AS concept, m.description, m.amount, p.receipt_number, m.created_by
             FROM cash_movements m LEFT JOIN cash_concepts cc ON cc.id = m.concept_id LEFT JOIN payments p ON p.id = m.payment_id
             WHERE m.occurred_on BETWEEN ? AND ? ORDER BY m.occurred_on, m.id',
            [$from, $to],
        );
        return [
            ['Fecha', 'Tipo', 'Concepto', 'Descripción', 'Ingreso', 'Egreso', 'Comprobante de pago', 'Registrado por'],
            array_map(static fn($r) => [$r['occurred_on'], $r['kind'], $r['concept'], $r['description'], $r['kind'] === 'ingreso' ? (int) $r['amount'] : '', $r['kind'] === 'egreso' ? (int) $r['amount'] : '', $r['receipt_number'], $r['created_by']], $rows),
            "$from-a-$to",
        ];
    }
}
