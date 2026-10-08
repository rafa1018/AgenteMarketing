import { CalendarCheck, Plus, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@/shared/useQuery'
import { MONTH_NAMES, parseMoney } from '@/shared/format'
import { toast } from '../../store'
import { api2 } from '../../v2/api'
import { ErrorBox, Field, Spinner, inputCls } from '../../v2/kit'
import type { Plan } from '../students/EnrollmentTab'

type Draft = { id?: number; name: string; type: 'mensual' | 'dia'; shift: Plan['shift']; price: string; active: boolean }
const SHIFTS: [NonNullable<Plan['shift']>, string][] = [
  ['manana', 'Mañana'],
  ['tarde', 'Tarde'],
  ['completa', 'Completa'],
]

/**
 * Plans: what each student pays. Monthly → the pension of the month; per day → the days attended (charged on
 * the 1st for the month before). Each student's plan and discount are chosen in their enrollment.
 */
export function PlansPanel() {
  const { data, error, loading, reload } = useQuery('plans', () => api2.get<{ plans: Plan[] }>('/billing/plans'))
  const [rows, setRows] = useState<Draft[]>([])
  const m = useMutation()
  useEffect(() => {
    if (data) setRows(data.plans.map((p) => ({ id: p.id, name: p.name, type: p.type, shift: p.shift, price: String(p.price), active: Boolean(p.active) })))
  }, [data])
  if (error) return <ErrorBox message={error.message} onRetry={reload} />
  if (loading && !data) return <Spinner />
  const original = (d: Draft) => data?.plans.find((p) => p.id === d.id)
  const changed = (d: Draft) => {
    const o = original(d)
    return !o || o.name !== d.name || o.type !== d.type || o.shift !== d.shift || o.price !== parseMoney(d.price) || Boolean(o.active) !== d.active
  }
  const save = async () => {
    for (const d of rows.filter(changed)) {
      const body = { name: d.name, type: d.type, shift: d.shift, price: parseMoney(d.price), active: d.active }
      const ok = await m.run(() => (d.id ? api2.put(`/billing/plans/${d.id}`, body) : api2.post('/billing/plans', body)))
      if (!ok) return
    }
    toast('Planes guardados')
    reload()
  }
  const up = (i: number, p: Partial<Draft>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)))
  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-4 sm:p-6">
        <div>
          <h3 className="text-lg">Planes</h3>
          <p className="mt-1 text-[14px] text-muted">
            Elige el plan de cada estudiante en su matrícula. <b>Mensual</b>: se cobra como pensión cada mes. <b>Por día</b>: el día 1 se cobran los días que asistió el mes anterior (según la asistencia). Sin plan, la pensión sale de la lista de precios del grado.
          </p>
        </div>
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.id ?? `new-${i}`} className={`grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1.6fr_1fr_1fr_1fr_auto] ${r.active ? '' : 'opacity-60'}`}>
              <input aria-label="Nombre del plan" value={r.name} onChange={(e) => up(i, { name: e.target.value })} className={inputCls()} />
              <select aria-label="Tipo" value={r.type} onChange={(e) => up(i, { type: e.target.value as Draft['type'] })} className={inputCls()}>
                <option value="mensual">Mensual</option>
                <option value="dia">Por día</option>
              </select>
              <select aria-label="Jornada" value={r.shift ?? ''} onChange={(e) => up(i, { shift: (e.target.value || null) as Draft['shift'] })} className={inputCls()}>
                <option value="">Cualquier jornada</option>
                {SHIFTS.map(([id, label]) => (
                  <option key={id} value={id}>
                    Jornada {label.toLowerCase()}
                  </option>
                ))}
              </select>
              <input aria-label={r.type === 'dia' ? 'Valor por día' : 'Valor mensual'} value={r.price} onChange={(e) => up(i, { price: e.target.value })} inputMode="numeric" placeholder={r.type === 'dia' ? 'Valor por día' : 'Valor mensual'} className={inputCls()} />
              <label className="flex items-center gap-2 px-1 text-[14px] font-semibold text-ink">
                <input type="checkbox" checked={r.active} onChange={(e) => up(i, { active: e.target.checked })} className="size-5 accent-[#3a36a8]" /> Activo
              </label>
              {r.id && (original(r)?.students ?? 0) > 0 && <p className="text-[12px] text-muted sm:col-span-5">{original(r)!.students} estudiantes con este plan este año</p>}
            </li>
          ))}
        </ul>
        {m.message && <ErrorBox message={m.message} />}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setRows([...rows, { name: 'Nuevo plan', type: 'mensual', shift: null, price: '', active: true }])} className="btn btn-ghost !text-sm">
            <Plus size={17} /> Agregar plan
          </button>
          <button type="button" disabled={m.busy || !rows.some(changed)} onClick={save} className="btn btn-primary !text-sm disabled:opacity-50">
            <Save size={17} /> Guardar planes
          </button>
        </div>
      </section>
      {rows.some((r) => r.type === 'dia') && <ChargeDays />}
    </div>
  )
}

/** Charges the days of the per-day plans for a month that already ended (the cron does it on the 1st). */
function ChargeDays() {
  const last = new Date()
  last.setDate(1)
  last.setMonth(last.getMonth() - 1)
  const [month, setMonth] = useState(`${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`)
  const m = useMutation()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(last.getFullYear(), last.getMonth() - i, 1)
    return [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`]
  })
  return (
    <section className="card space-y-3 p-4 sm:p-6">
      <h3 className="flex items-center gap-2 text-lg">
        <CalendarCheck size={19} className="text-royal" /> Cobrar días asistidos
      </h3>
      <p className="text-[14px] text-muted">Se hace solo el día 1 de cada mes. Úsalo si quieres cobrar un mes antes de esa fecha o si corregiste la asistencia (no duplica cobros).</p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Mes">
          <select value={month} onChange={(e) => setMonth(e.target.value)} className={inputCls() + ' capitalize'}>
            {months.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          disabled={m.busy}
          onClick={async () => {
            const r = await m.run(() => api2.post<{ created: number; skipped: number }>('/billing/days', { month }))
            if (r) toast(r.created ? `${r.created} cobros de días creados (las familias reciben el aviso)` : 'No hay días nuevos por cobrar en ese mes')
          }}
          className="btn btn-primary !min-h-[46px] !text-sm"
        >
          Cobrar días
        </button>
      </div>
      {m.message && <ErrorBox message={m.message} />}
    </section>
  )
}
