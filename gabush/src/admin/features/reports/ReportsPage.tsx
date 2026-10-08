import { BookOpenCheck, ClipboardCheck, Download, FileCheck2, PiggyBank, Receipt, Users, Wallet } from 'lucide-react'
import { useState, type ComponentType } from 'react'
import { can, type Perm } from '@/lib/calendar'
import { todayISO } from '@/shared/format'
import { PageHead } from '../../ui'
import { qs, useSetup } from '../../v2/api'
import { Field, YearPicker, inputCls } from '../../v2/kit'

type Filter = 'year' | 'range' | 'period'
type Report = { key: string; title: string; detail: string; icon: ComponentType<{ size?: number; className?: string }>; perms: Perm[]; filter: Filter }

const REPORTS: Report[] = [
  { key: 'estudiantes', title: 'Estudiantes y acudientes', detail: 'Datos de cada estudiante del año, su curso, plan y los teléfonos y correos de la familia.', icon: Users, perms: ['estudiantes', 'matriculas'], filter: 'year' },
  { key: 'matriculas', title: 'Matrículas', detail: 'Estado de la matrícula, contrato, desde cuándo está en el jardín, retiros y documentos pendientes.', icon: FileCheck2, perms: ['matriculas'], filter: 'year' },
  { key: 'cartera', title: 'Cartera por estudiante', detail: 'Cobrado, pagado, pendiente, vencido, mora, saldo a favor y si está a paz y salvo.', icon: Wallet, perms: ['pagos'], filter: 'year' },
  { key: 'cobros', title: 'Cobros del año', detail: 'Cada pensión y cobro con sus descuentos, recargos, mora, lo pagado y el saldo.', icon: Receipt, perms: ['pagos'], filter: 'year' },
  { key: 'pagos', title: 'Pagos recibidos', detail: 'Comprobante, fecha, valor, medio de pago y a qué cobros se aplicó cada pago.', icon: Receipt, perms: ['pagos'], filter: 'range' },
  { key: 'notas', title: 'Calificaciones', detail: 'Desempeño, nota, fallas y logros de cada estudiante por materia y periodo.', icon: BookOpenCheck, perms: ['calificaciones', 'academico'], filter: 'period' },
  { key: 'asistencia', title: 'Asistencia', detail: 'Días que asistió, llegó tarde o faltó cada estudiante, con el porcentaje.', icon: ClipboardCheck, perms: ['asistencia'], filter: 'range' },
  { key: 'caja', title: 'Caja: ingresos y egresos', detail: 'Movimientos de caja con su concepto y el comprobante del pago que los originó.', icon: PiggyBank, perms: ['caja'], filter: 'range' },
]

/** Every report downloads as an Excel-ready file (CSV with ; and accents). */
export function ReportsPage() {
  const { year } = useSetup()
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`)
  const [to, setTo] = useState(todayISO())
  const [period, setPeriod] = useState('')
  const visible = REPORTS.filter((r) => r.perms.some((p) => can(p)))
  const href = (r: Report) => `/api/v2/reports/${r.key}` + qs(r.filter === 'range' ? { from, to } : r.filter === 'period' ? { year, period: period || null } : { year })
  return (
    <div className="space-y-5">
      <PageHead title="Reportes" sub="Descárgalos y ábrelos en Excel. El año se elige arriba a la derecha." actions={<YearPicker />} />
      <section className="card grid gap-3 p-4 sm:grid-cols-3">
        <Field label="Desde (pagos, asistencia, caja)">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls()} />
        </Field>
        <Field label="Hasta">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls()} />
        </Field>
        <Field label="Periodo (calificaciones)">
          <select value={period} onChange={(e) => setPeriod(e.target.value)} className={inputCls()}>
            <option value="">Todos los periodos</option>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>
                Periodo {n}
              </option>
            ))}
          </select>
        </Field>
      </section>
      <ul className="grid gap-3 md:grid-cols-2">
        {visible.map((r) => (
          <li key={r.key} className="card flex flex-col gap-3 p-4">
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#eeedfb] text-royal">
                <r.icon size={21} />
              </span>
              <span>
                <span className="block font-semibold text-ink">{r.title}</span>
                <span className="block text-[14px] text-muted">{r.detail}</span>
                <span className="mt-1 block text-[12px] font-semibold text-muted">
                  {r.filter === 'range' ? `Del ${from} al ${to}` : r.filter === 'period' ? `${year} · ${period ? `periodo ${period}` : 'todos los periodos'}` : `Año ${year}`}
                </span>
              </span>
            </div>
            <a href={href(r)} className="btn btn-primary mt-auto !min-h-10 !text-sm" download>
              <Download size={17} /> Descargar Excel
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
