import { Eye, EyeOff, NotebookPen, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { can } from '@/lib/calendar'
import { useMutation, useQuery } from '@/shared/useQuery'
import { date, todayISO } from '@/shared/format'
import { toast } from '../../store'
import { api2 } from '../../v2/api'
import { Badge, Empty, ErrorBox, Field, Spinner, inputCls } from '../../v2/kit'

type Obs = { id: number; year: number | null; date: string; category: string; body: string; visible: number; createdBy: string | null; createdAt: string }
const CATS: [string, string][] = [
  ['general', 'General'],
  ['salud', 'Salud'],
  ['convivencia', 'Convivencia'],
  ['aprendizaje', 'Aprendizaje'],
  ['logro', 'Logro'],
  ['familia', 'Familia'],
]

/** Observador: dated notes about the child; the ones marked visible appear in the family portal. */
export function ObservationsTab({ studentId }: { studentId: number }) {
  const { data, error, loading, reload } = useQuery(`obs:${studentId}`, () => api2.get<{ observations: Obs[] }>(`/students/${studentId}/observations`))
  const [form, setForm] = useState({ date: todayISO(), category: 'general', body: '', visible: false })
  const m = useMutation()
  const save = async () => {
    if (await m.run(() => api2.post(`/students/${studentId}/observations`, form))) {
      toast(form.visible ? 'Anotación guardada (la familia la ve en el portal)' : 'Anotación guardada')
      setForm({ ...form, body: '' })
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
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Fecha">
              <input type="date" value={form.date} max={todayISO()} onChange={(e) => setForm({ ...form, date: e.target.value })} className={inputCls()} />
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
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={3} className={inputCls(m.fields.body)} />
          </Field>
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
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
