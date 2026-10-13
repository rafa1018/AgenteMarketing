import { Eye, EyeOff, Lightbulb, NotebookPen, Trash2, TrendingUp } from 'lucide-react'
import { useState } from 'react'
import { can } from '@/lib/calendar'
import { useMutation, useQuery } from '@/shared/useQuery'
import { date, todayISO } from '@/shared/format'
import { toast } from '../../store'
import { api2, useSetup } from '../../v2/api'
import { Badge, Empty, ErrorBox, Field, Spinner, inputCls } from '../../v2/kit'

type Obs = { id: number; year: number | null; periodId: number | null; period: string | null; date: string; category: string; body: string; actions: string | null; recommendations: string | null; visible: number; createdBy: string | null; createdAt: string }
const CATS: [string, string][] = [
  ['general', 'General'],
  ['salud', 'Salud'],
  ['convivencia', 'Convivencia'],
  ['aprendizaje', 'Aprendizaje'],
  ['logro', 'Logro'],
  ['familia', 'Familia'],
]

/**
 * Observador: dated notes about the child, each tied to a period, with the improvement actions and the
 * recommendations; the ones marked visible appear in the family portal.
 */
export function ObservationsTab({ studentId }: { studentId: number }) {
  const { setup } = useSetup()
  const periods = setup?.periods ?? []
  // the period the date falls in, else the one open for grading, else the first
  const periodFor = (d: string) => periods.find((p) => p.startsOn && p.endsOn && p.startsOn <= d && d <= p.endsOn)?.id ?? periods.find((p) => p.gradingOpen)?.id ?? periods[0]?.id ?? ''
  const { data, error, loading, reload } = useQuery(`obs:${studentId}`, () => api2.get<{ observations: Obs[] }>(`/students/${studentId}/observations`))
  const blank = () => ({ date: todayISO(), category: 'general', periodId: periodFor(todayISO()) as number | '', body: '', actions: '', recommendations: '', visible: false })
  const [form, setForm] = useState(blank)
  const m = useMutation()
  // the setup (periods) may arrive after the form was created
  if (form.periodId === '' && periods.length) setForm({ ...form, periodId: periodFor(form.date) })
  const save = async () => {
    if (await m.run(() => api2.post(`/students/${studentId}/observations`, { ...form, periodId: form.periodId || null }))) {
      toast(form.visible ? 'Anotación guardada (la familia la ve en el portal)' : 'Anotación guardada')
      setForm({ ...blank(), date: form.date, category: form.category, periodId: form.periodId, visible: form.visible })
      reload()
    }
  }
  return (
    <div className="space-y-4">
      {can('observador') && (
        <section className="card space-y-3 p-4 sm:p-5">
          <h3 className="flex items-center gap-2 text-lg">
            <NotebookPen size={19} className="text-pink" /> Nueva anotación
          </h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Fecha">
              <input type="date" value={form.date} max={todayISO()} onChange={(e) => setForm({ ...form, date: e.target.value, periodId: periodFor(e.target.value) })} className={inputCls()} />
            </Field>
            <Field label="Periodo">
              <select value={form.periodId} onChange={(e) => setForm({ ...form, periodId: e.target.value ? Number(e.target.value) : '' })} className={inputCls()}>
                <option value="">Sin periodo</option>
                {periods.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tipo">
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls()}>
                {CATS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Anotación" error={m.fields.body}>
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={3} placeholder="Qué se observó" className={inputCls(m.fields.body)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Acciones de mejora (opcional)">
              <textarea value={form.actions} onChange={(e) => setForm({ ...form, actions: e.target.value })} rows={3} placeholder="Qué vamos a hacer en el jardín para ayudarle" className={inputCls()} />
            </Field>
            <Field label="Recomendaciones (opcional)">
              <textarea value={form.recommendations} onChange={(e) => setForm({ ...form, recommendations: e.target.value })} rows={3} placeholder="Qué puede hacer la familia en casa" className={inputCls()} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <input type="checkbox" checked={form.visible} onChange={(e) => setForm({ ...form, visible: e.target.checked })} className="size-5 accent-[#3a36a8]" /> Que la familia la vea en el portal (y reciba el aviso)
          </label>
          {m.message && <ErrorBox message={m.message} />}
          <button type="button" disabled={m.busy || !form.body.trim()} onClick={save} className="btn btn-primary !text-sm">
            Guardar anotación
          </button>
        </section>
      )}
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data?.observations.length ? (
        <Empty icon={<NotebookPen />} title="Sin anotaciones">Aquí quedan las observaciones de salud, convivencia y avances del niño.</Empty>
      ) : (
        <ul className="space-y-2.5">
          {data.observations.map((o) => (
            <li key={o.id} className="card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{date(o.date)}</span>
                {o.period && <Badge tone="blue">{o.period}{o.year ? ` · ${o.year}` : ''}</Badge>}
                <Badge tone="violet">{CATS.find(([k]) => k === o.category)?.[1] ?? o.category}</Badge>
                {o.visible ? (
                  <Badge tone="green">
                    <Eye size={12} /> La ve la familia
                  </Badge>
                ) : (
                  <Badge>
                    <EyeOff size={12} /> Interna
                  </Badge>
                )}
                <span className="ml-auto text-[12px] text-muted">{o.createdBy}</span>
                {can('observador') && (
                  <button type="button" aria-label="Eliminar" onClick={async () => { await api2.del(`/observations/${o.id}`).catch(() => null); reload() }} className="text-muted hover:text-berry">
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              <p className="mt-2 text-[15px] whitespace-pre-line text-text">{o.body}</p>
              {(o.actions || o.recommendations) && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {o.actions && (
                    <div className="rounded-xl bg-[#eaf3fa] px-3 py-2.5 text-[14px] text-[#185a8a]">
                      <p className="flex items-center gap-1.5 text-[12px] font-bold tracking-wide uppercase">
                        <TrendingUp size={14} /> Acciones de mejora
                      </p>
                      <p className="mt-1 whitespace-pre-line">{o.actions}</p>
                    </div>
                  )}
                  {o.recommendations && (
                    <div className="rounded-xl bg-[#fff8e6] px-3 py-2.5 text-[14px] text-[#8a5716]">
                      <p className="flex items-center gap-1.5 text-[12px] font-bold tracking-wide uppercase">
                        <Lightbulb size={14} /> Recomendaciones
                      </p>
                      <p className="mt-1 whitespace-pre-line">{o.recommendations}</p>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
