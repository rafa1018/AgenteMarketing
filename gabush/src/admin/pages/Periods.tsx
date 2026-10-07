import { History, LogOut, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { addDays, dayDiff, formatDay, parseYMD, todayYMD } from '@/lib/dates'
import { cn } from '@/lib/utils'
import type { Period, StudentDraft } from '../store'
import { field, labelCls } from '../ui'

const days = (p: Period, today: string) => dayDiff(p.start, p.end ?? today) + 1

/**
 * Enrolment history inside the student editor: close the current period (vacations, withdrawal…)
 * or reactivate with a new entry date. Changes are saved with the student.
 */
export function Periods({ d, onChange }: { d: StudentDraft; onChange: (patch: Partial<StudentDraft>) => void }) {
  const today = todayYMD()
  const periods = d.periods ?? []
  const current = periods[periods.length - 1]
  const [mode, setMode] = useState<'close' | 'reopen' | null>(null)
  const [date, setDate] = useState(today)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  if (!current) return null // new student: the first period is created from the entry date

  const open = (m: 'close' | 'reopen') => {
    setMode(m)
    setError('')
    setReason('')
    setDate(m === 'reopen' && current.end && current.end >= today ? addDays(current.end, 1) : today)
  }

  const apply = () => {
    if (!date) return setError('Elige una fecha.')
    if (mode === 'close') {
      if (date < current.start) return setError('La salida no puede ser antes del ingreso.')
      onChange({ periods: [...periods.slice(0, -1), { ...current, end: date, reason: reason.trim() }], active: false })
    } else {
      if (current.end && date <= current.end) return setError('El nuevo ingreso debe ser después de la última salida.')
      onChange({ periods: [...periods, { start: date, end: null, reason: '' }], startDate: date, billingDay: parseYMD(date).d, active: true })
    }
    setMode(null)
  }

  return (
    <div className="rounded-xl border border-line p-4 sm:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-ink">
          <History size={17} className="text-royal" /> Historial de ingresos
        </p>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', d.active ? 'bg-[#e9f4ee] text-leaf' : 'bg-[#f1f2f5] text-muted')}>{d.active ? 'Activo' : 'Inactivo'}</span>
      </div>

      <ol className="mt-3 space-y-2">
        {[...periods].reverse().map((p, i) => (
          <li key={p.start} className="flex gap-3 text-[15px]">
            <span className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', p.end === null ? 'bg-leaf' : 'bg-muted/50')} />
            <span>
              <span className="font-medium text-ink">Ingresó el {formatDay(p.start, 'es')}</span>
              <span className="text-muted">
                {p.end ? ` → salió el ${formatDay(p.end, 'es')}` : ' → actualmente'} · {days(p, today)} días
                {p.reason && ` · ${p.reason}`}
              </span>
              {i === 0 && periods.length > 1 && <span className="ml-1 text-xs font-semibold text-royal">(periodo {periods.length})</span>}
            </span>
          </li>
        ))}
      </ol>

      {mode ? (
        <div className="mt-4 grid gap-3 rounded-lg bg-paper p-3 sm:grid-cols-2">
          <div>
            <label htmlFor="per-date" className={labelCls}>
              {mode === 'close' ? 'Fecha de salida' : 'Nueva fecha de ingreso'}
            </label>
            <input id="per-date" type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {mode === 'close' && (
            <div>
              <label htmlFor="per-reason" className={labelCls}>
                Motivo <span className="font-normal text-muted">(opcional)</span>
              </label>
              <input id="per-reason" list="per-reasons" className={field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Vacaciones, viaje, retiro…" maxLength={100} />
              <datalist id="per-reasons">
                <option value="Vacaciones" />
                <option value="Viaje" />
                <option value="Retiro" />
                <option value="Cambio de colegio" />
              </datalist>
            </div>
          )}
          {error && <p className="text-sm font-medium text-berry sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" onClick={apply} className="h-10 rounded-lg bg-ink px-4 text-sm font-semibold text-white">
              {mode === 'close' ? 'Cerrar periodo' : 'Reactivar'}
            </button>
            <button type="button" onClick={() => setMode(null)} className="h-10 rounded-lg border border-line px-4 text-sm font-semibold text-ink">
              Cancelar
            </button>
          </div>
          <p className="text-xs text-muted sm:col-span-2">{mode === 'close' ? 'Queda inactivo: no sale en asistencia ni en cobros. El historial se conserva.' : 'Empieza un periodo nuevo: la mensualidad se cuenta desde esta fecha.'} Recuerda pulsar Guardar.</p>
        </div>
      ) : current.end === null ? (
        <button type="button" onClick={() => open('close')} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:border-ink">
          <LogOut size={16} /> Cerrar periodo (pausa o retiro)
        </button>
      ) : (
        <button type="button" onClick={() => open('reopen')} className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-leaf px-3 text-sm font-semibold text-white">
          <RotateCcw size={16} /> Reactivar con nueva fecha de ingreso
        </button>
      )}
    </div>
  )
}
