import { CheckCheck, Download, Loader2, Save, UserRoundCheck, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'
import { date, dateTime, todayISO } from '@/shared/format'
import { useMutation, useQuery } from '@/shared/useQuery'
import { toast } from '../../store'
import { PageHead } from '../../ui'
import { api2, qs } from '../../v2/api'
import { Empty, ErrorBox, Spinner, Tabs, useTab } from '../../v2/kit'

type Person = { id: number; name: string; position: string | null; active: number; status: string | null; checkIn: string | null; checkOut: string | null; note: string | null; recordedBy: string | null; recordedAt: string | null }
type Mark = { status: string | null; checkIn: string; checkOut: string; note: string }
type SummaryRow = { id: number; name: string; position: string | null; active: number; presente: number; tarde: number; ausente: number; permiso: number; incapacidad: number; vacaciones: number; marcados: number }

const STATES: { id: string; label: string; short: string; cls: string }[] = [
  { id: 'presente', label: 'Presente', short: 'P', cls: 'bg-leaf text-white' },
  { id: 'tarde', label: 'Llegó tarde', short: 'T', cls: 'bg-gold text-ink' },
  { id: 'ausente', label: 'Ausente', short: 'A', cls: 'bg-berry text-white' },
  { id: 'permiso', label: 'Permiso', short: 'Pe', cls: 'bg-ocean text-white' },
  { id: 'incapacidad', label: 'Incapacidad', short: 'In', cls: 'bg-royal text-white' },
  { id: 'vacaciones', label: 'Vacaciones', short: 'V', cls: 'bg-[#8e44c9] text-white' },
]
const label = (s: string | null) => STATES.find((x) => x.id === s)?.label ?? '—'

/** Attendance of the school's staff — only for the rectora / administration (permission "Asistencia del personal"). */
export function StaffAttendancePage() {
  const [tab, setTab] = useTab<'dia' | 'resumen'>('dia')
  return (
    <div className="space-y-5">
      <PageHead title="Asistencia del personal" sub="Lleva el registro diario de tu equipo: entrada, salida, tardanzas, permisos e incapacidades." />
      <Tabs tabs={[{ id: 'dia', label: 'Marcar el día' }, { id: 'resumen', label: 'Resumen y trazabilidad' }]} value={tab} onChange={setTab} />
      {tab === 'dia' ? <DaySheet /> : <Summary />}
    </div>
  )
}

function DaySheet() {
  const [day, setDay] = useState(todayISO())
  const { data, error, loading, reload } = useQuery(`staffatt:${day}`, () => api2.get<{ staff: Person[] }>('/staff-attendance' + qs({ date: day })))
  const [marks, setMarks] = useState<Record<number, Mark>>({})
  const m = useMutation()
  const toMark = (p: Person): Mark => ({ status: p.status, checkIn: p.checkIn ?? '', checkOut: p.checkOut ?? '', note: p.note ?? '' })
  useEffect(() => {
    setMarks(Object.fromEntries((data?.staff ?? []).map((p) => [p.id, toMark(p)])))
  }, [data])
  const dirty = useMemo(() => (data?.staff ?? []).some((p) => JSON.stringify(marks[p.id] ?? null) !== JSON.stringify(toMark(p))), [data, marks])
  const counts = useMemo(() => Object.values(marks).reduce<Record<string, number>>((a, x) => (x.status ? { ...a, [x.status]: (a[x.status] ?? 0) + 1 } : a), {}), [marks])
  const set = (id: number, p: Partial<Mark>) => setMarks((ms) => ({ ...ms, [id]: { ...(ms[id] ?? { status: null, checkIn: '', checkOut: '', note: '' }), ...p } }))
  const save = async () => {
    const items = Object.entries(marks).map(([id, v]) => ({ staffId: Number(id), status: v.status ?? '', checkIn: v.checkIn || null, checkOut: v.checkOut || null, note: v.note }))
    if (await m.run(() => api2.put('/staff-attendance', { date: day, items }))) {
      toast('Asistencia del personal guardada')
      reload()
    }
  }
  const now = new Date().toTimeString().slice(0, 5)
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={day} max={todayISO()} onChange={(e) => setDay(e.target.value)} className="rounded-lg border border-line bg-white px-3 py-2 font-semibold" aria-label="Fecha" />
        <span className="text-sm text-muted">{date(day)}</span>
        <button type="button" onClick={() => setMarks(Object.fromEntries((data?.staff ?? []).map((p) => [p.id, marks[p.id]?.status ? marks[p.id] : { ...(marks[p.id] ?? toMark(p)), status: 'presente' }])))} className="btn btn-ghost ml-auto !min-h-10 !text-sm">
          <CheckCheck size={17} /> Los demás presentes
        </button>
      </div>
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data?.staff.length ? (
        <Empty title="No hay personal activo">Regístralo en Gestión académica → Personal.</Empty>
      ) : (
        <>
          <ul className="space-y-2">
            {data.staff.map((p) => {
              const v = marks[p.id] ?? toMark(p)
              const works = v.status === 'presente' || v.status === 'tarde'
              return (
                <li key={p.id} className="card space-y-3 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#eeedfb] font-serif font-semibold text-royal">{p.name.trim().slice(0, 1)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold text-ink">{p.name}</span>
                      <span className="block text-[12px] text-muted">
                        {p.position ?? 'Personal'}
                        {p.recordedBy && ` · marcado por ${p.recordedBy}`}
                      </span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {STATES.map((st) => (
                        <button key={st.id} type="button" title={st.label} aria-pressed={v.status === st.id} onClick={() => set(p.id, { status: v.status === st.id ? null : st.id, checkIn: v.checkIn || (v.status !== st.id && (st.id === 'presente' || st.id === 'tarde') && day === todayISO() ? now : v.checkIn) })} className={cn('grid h-10 min-w-10 place-items-center rounded-xl px-2 text-[14px] font-bold transition-colors', v.status === st.id ? st.cls : 'bg-paper text-muted hover:text-ink')}>
                          {st.short}
                        </button>
                      ))}
                    </div>
                  </div>
                  {v.status && (
                    <div className="grid gap-2 sm:grid-cols-[120px_120px_1fr]">
                      {works ? (
                        <>
                          <label className="text-[12px] font-semibold text-muted">
                            Entrada
                            <input type="time" value={v.checkIn} onChange={(e) => set(p.id, { checkIn: e.target.value })} className="mt-0.5 block w-full rounded-lg border border-line px-2 py-1.5 text-[15px] text-ink" />
                          </label>
                          <label className="text-[12px] font-semibold text-muted">
                            Salida
                            <input type="time" value={v.checkOut} onChange={(e) => set(p.id, { checkOut: e.target.value })} className="mt-0.5 block w-full rounded-lg border border-line px-2 py-1.5 text-[15px] text-ink" />
                          </label>
                        </>
                      ) : (
                        <span className="sm:col-span-2 self-center text-[13px] font-semibold text-ink">{label(v.status)}</span>
                      )}
                      <label className="text-[12px] font-semibold text-muted">
                        Nota
                        <input value={v.note} onChange={(e) => set(p.id, { note: e.target.value })} maxLength={200} placeholder={works ? 'Opcional' : 'Motivo, soporte…'} className="mt-0.5 block w-full rounded-lg border border-line px-3 py-1.5 text-[15px] text-ink" />
                      </label>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          <div className="sticky bottom-20 z-10 flex flex-wrap items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-lg lg:bottom-4">
            <span className="text-sm">{STATES.filter((st) => counts[st.id]).map((st) => `${st.label}: ${counts[st.id]}`).join(' · ') || 'Sin marcar'}</span>
            <button type="button" disabled={!dirty || m.busy} onClick={save} className="btn btn-gold ml-auto !min-h-10 !text-sm disabled:opacity-50">
              {m.busy ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Guardar
            </button>
          </div>
          {m.message && <ErrorBox message={m.message} />}
        </>
      )}
    </div>
  )
}

function Summary() {
  const [from, setFrom] = useState(todayISO().slice(0, 8) + '01')
  const [to, setTo] = useState(todayISO())
  const [person, setPerson] = useState<SummaryRow | null>(null)
  const { data, error, loading, reload } = useQuery(`staffsum:${from}:${to}`, () => api2.get<{ days: number; staff: SummaryRow[] }>('/staff-attendance/summary' + qs({ from, to })))
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Desde" className="rounded-lg border border-line bg-white px-3 py-2 font-semibold" />
        <span className="text-muted">a</span>
        <input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Hasta" className="rounded-lg border border-line bg-white px-3 py-2 font-semibold" />
        <a href={'/api/v2/staff-attendance/export' + qs({ from, to })} className="btn btn-ghost ml-auto !min-h-10 !text-sm">
          <Download size={16} /> Descargar Excel
        </a>
      </div>
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : (
        <>
          <p className="text-sm text-muted">{data?.days ?? 0} días marcados en el rango. Toca a una persona para ver su detalle día por día.</p>
          <div className="card overflow-x-auto p-0">
            <table className="w-full min-w-[680px] text-[14px]">
              <thead>
                <tr className="bg-paper text-left text-[12px] font-bold tracking-wide text-muted uppercase">
                  <th className="px-4 py-2.5">Persona</th>
                  {STATES.map((s) => (
                    <th key={s.id} className="px-2 py-2.5 text-center">{s.label}</th>
                  ))}
                  <th className="px-3 py-2.5 text-center">Asistencia</th>
                </tr>
              </thead>
              <tbody>
                {data?.staff.map((p) => {
                  const worked = p.presente + p.tarde
                  const expected = worked + p.ausente
                  return (
                    <tr key={p.id} className="border-t border-line">
                      <td className="px-4 py-2.5">
                        <button type="button" onClick={() => setPerson(p)} className="text-left font-semibold text-ink hover:text-royal">
                          {p.name}
                        </button>
                        <span className="block text-[12px] text-muted">{p.position ?? 'Personal'}{!p.active && ' · inactivo'}</span>
                      </td>
                      <td className="px-2 text-center tabular-nums">{p.presente}</td>
                      <td className={cn('px-2 text-center tabular-nums', p.tarde > 0 && 'font-bold text-[#8a5716]')}>{p.tarde}</td>
                      <td className={cn('px-2 text-center tabular-nums', p.ausente > 0 && 'font-bold text-berry')}>{p.ausente}</td>
                      <td className="px-2 text-center tabular-nums">{p.permiso}</td>
                      <td className="px-2 text-center tabular-nums">{p.incapacidad}</td>
                      <td className="px-2 text-center tabular-nums">{p.vacaciones}</td>
                      <td className="px-3 text-center font-semibold tabular-nums">{expected ? `${Math.round((worked / expected) * 100)}%` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <p className="text-[12px] text-muted">Asistencia = días presentes o con llegada tarde sobre los días que debía trabajar (no cuenta permisos, incapacidades ni vacaciones).</p>
        </>
      )}
      <Modal open={Boolean(person)} onClose={() => setPerson(null)} label="Detalle" closeLabel="Cerrar" className="sm:!max-w-xl">
        {person && <PersonDetail person={person} from={from} to={to} onClose={() => setPerson(null)} />}
      </Modal>
    </div>
  )
}

function PersonDetail({ person, from, to, onClose }: { person: SummaryRow; from: string; to: string; onClose: () => void }) {
  const { data, error, loading } = useQuery(`staffperson:${person.id}:${from}:${to}`, () =>
    api2.get<{ days: { day: string; status: string; checkIn: string | null; checkOut: string | null; note: string | null; recordedBy: string | null; recordedAt: string }[] }>(`/staff-attendance/person/${person.id}` + qs({ from, to })),
  )
  return (
    <div className="space-y-3 p-6">
      <div className="flex items-start gap-3 pr-8">
        <UserRoundCheck size={24} className="mt-1 text-royal" />
        <div>
          <h2 className="text-[1.4rem]">{person.name}</h2>
          <p className="text-sm text-muted">{date(from)} – {date(to)}</p>
        </div>
      </div>
      {error ? (
        <ErrorBox message={error.message} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data?.days.length ? (
        <Empty title="Sin marcas en este rango" />
      ) : (
        <ul className="divide-y divide-line">
          {data.days.map((d) => (
            <li key={d.day} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-2 text-[14px]">
              <span className="w-28 font-semibold text-ink">{date(d.day)}</span>
              <span className={cn('rounded-full px-2.5 py-0.5 text-[12px] font-bold', STATES.find((s) => s.id === d.status)?.cls)}>{label(d.status)}</span>
              {(d.checkIn || d.checkOut) && <span className="tabular-nums text-muted">{d.checkIn ?? '—'} → {d.checkOut ?? '—'}</span>}
              {d.note && <span className="w-full text-[13px] text-text">{d.note}</span>}
              <span className="w-full text-[11px] text-muted">Marcado por {d.recordedBy ?? '—'} · {dateTime(d.recordedAt)}</span>
            </li>
          ))}
        </ul>
      )}
      <button type="button" onClick={onClose} className="btn btn-ghost w-full">
        <X size={16} /> Cerrar
      </button>
    </div>
  )
}
