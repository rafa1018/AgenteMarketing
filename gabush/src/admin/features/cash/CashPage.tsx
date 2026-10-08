import { ArrowDownCircle, ArrowUpCircle, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useMutation, useQuery } from '@/shared/useQuery'
import { date, money, monthLabel, parseMoney, todayISO } from '@/shared/format'
import { toast } from '../../store'
import { PageHead } from '../../ui'
import { api2, qs } from '../../v2/api'
import { Badge, Empty, ErrorBox, Field, Spinner, Stat, inputCls } from '../../v2/kit'

type CashData = {
  income: number
  expense: number
  net: number
  movements: { id: number; kind: 'ingreso' | 'egreso'; amount: number; date: string; description: string | null; paymentId: number | null; createdBy: string | null; conceptId: number | null; concept: string | null; box: string }[]
  byConcept: { kind: string; concept: string; amount: number }[]
  monthly: { month: string; income: number; expense: number }[]
  boxes: { id: number; name: string; balance: number }[]
  concepts: { id: number; kind: 'ingreso' | 'egreso'; name: string; description: string | null; active: number }[]
}

/** Cash flow: student payments come in automatically; expenses (rent, utilities, materials) are recorded here. */
export function CashPage() {
  const [from, setFrom] = useState(todayISO().slice(0, 8) + '01')
  const [to, setTo] = useState(todayISO())
  const { data, error, loading, reload } = useQuery(`cash:${from}:${to}`, () => api2.get<CashData>('/cash' + qs({ from, to })))
  const [adding, setAdding] = useState<'ingreso' | 'egreso' | null>(null)
  return (
    <div className="space-y-5">
      <PageHead
        title="Caja"
        sub="Ingresos y egresos del jardín. Los pagos de los estudiantes entran solos."
        actions={
          <>
            <button type="button" onClick={() => setAdding('egreso')} className="btn btn-primary">
              <ArrowUpCircle size={18} /> Registrar egreso
            </button>
            <button type="button" onClick={() => setAdding('ingreso')} className="btn btn-ghost">
              <ArrowDownCircle size={18} /> Otro ingreso
            </button>
          </>
        }
      />
      <div className="flex flex-wrap gap-3">
        <Field label="Desde">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls()} />
        </Field>
        <Field label="Hasta">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls()} />
        </Field>
      </div>
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !data ? null : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Ingresos" value={money(data.income)} tone="green" />
            <Stat label="Egresos" value={money(data.expense)} tone="red" />
            <Stat label="Resultado" value={money(data.net)} tone={data.net >= 0 ? 'green' : 'red'} />
            <Stat label="Saldo en caja" value={money(data.boxes.reduce((a, b) => a + b.balance, 0))} hint={data.boxes.map((b) => b.name).join(', ')} />
          </div>
          <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <section className="card overflow-hidden p-0">
              <h3 className="border-b border-line px-4 py-3 text-lg">Movimientos</h3>
              {!data.movements.length ? (
                <p className="px-4 py-6 text-sm text-muted">Sin movimientos en esas fechas.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {data.movements.map((mv) => (
                    <li key={mv.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${mv.kind === 'ingreso' ? 'bg-[#e9f4ee] text-leaf' : 'bg-[#fdf0ef] text-berry'}`}>{mv.kind === 'ingreso' ? <ArrowDownCircle size={17} /> : <ArrowUpCircle size={17} />}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold text-ink">{mv.concept ?? 'Sin concepto'}</span>
                        <span className="block truncate text-[13px] text-muted">
                          {date(mv.date)} · {mv.description ?? ''} {mv.createdBy && `· ${mv.createdBy}`}
                        </span>
                      </span>
                      <span className={`font-semibold tabular-nums ${mv.kind === 'ingreso' ? 'text-leaf' : 'text-berry'}`}>
                        {mv.kind === 'ingreso' ? '+' : '−'} {money(mv.amount)}
                      </span>
                      {!mv.paymentId && (
                        <button type="button" aria-label="Eliminar" onClick={async () => { await api2.del(`/cash/movements/${mv.id}`).catch((e) => toast(e.message)); reload() }} className="text-muted hover:text-berry">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="space-y-5">
              <div className="card p-4">
                <h3 className="text-lg">Por concepto</h3>
                <ul className="mt-2 space-y-1">
                  {data.byConcept.map((c) => (
                    <li key={c.kind + c.concept} className="flex justify-between gap-2 text-[14px]">
                      <span>
                        <Badge tone={c.kind === 'ingreso' ? 'green' : 'red'}>{c.kind}</Badge> {c.concept}
                      </span>
                      <b className="tabular-nums">{money(c.amount)}</b>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card p-4">
                <h3 className="text-lg">Mes a mes</h3>
                <ul className="mt-2 space-y-1 text-[14px]">
                  {data.monthly.map((x) => (
                    <li key={x.month} className="flex justify-between gap-2">
                      <span className="capitalize">{monthLabel(x.month)}</span>
                      <span className="tabular-nums">
                        <span className="text-leaf">+{money(x.income)}</span> · <span className="text-berry">−{money(x.expense)}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>
          {!data.concepts.length && <Empty title="Sin conceptos" />}
        </>
      )}
      <MovementModal kind={adding} concepts={data?.concepts ?? []} onClose={() => setAdding(null)} onDone={reload} />
    </div>
  )
}

function MovementModal({ kind, concepts, onClose, onDone }: { kind: 'ingreso' | 'egreso' | null; concepts: CashData['concepts']; onClose: () => void; onDone: () => void }) {
  const [v, setV] = useState({ conceptId: '' as number | '', amount: '', date: todayISO(), description: '' })
  const [newConcept, setNewConcept] = useState('')
  const m = useMutation()
  const list = concepts.filter((c) => c.kind === kind && c.active)
  const save = async () => {
    let conceptId = v.conceptId
    if (!conceptId && newConcept.trim()) {
      const r = await m.run(() => api2.post<{ id: number }>('/cash/concepts', { kind, name: newConcept.trim() }))
      if (!r) return
      conceptId = r.id
    }
    if (await m.run(() => api2.post('/cash/movements', { kind, conceptId: conceptId || null, amount: parseMoney(v.amount), date: v.date, description: v.description }))) {
      toast(kind === 'egreso' ? 'Egreso registrado' : 'Ingreso registrado')
      setV({ conceptId: '', amount: '', date: todayISO(), description: '' })
      setNewConcept('')
      onDone()
      onClose()
    }
  }
  return (
    <Modal open={Boolean(kind)} onClose={onClose} label="Movimiento de caja" closeLabel="Cerrar" className="sm:!max-w-md">
      <div className="space-y-4 p-6">
        <h2 className="text-[1.4rem]">{kind === 'egreso' ? 'Registrar egreso' : 'Registrar ingreso'}</h2>
        <Field label="Concepto">
          <select value={v.conceptId} onChange={(e) => setV({ ...v, conceptId: e.target.value ? Number(e.target.value) : '' })} className={inputCls()}>
            <option value="">{list.length ? 'Elige…' : '—'}</option>
            {list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        {!v.conceptId && (
          <Field label="…o crea un concepto nuevo">
            <input value={newConcept} onChange={(e) => setNewConcept(e.target.value)} placeholder="Papelería, transporte…" className={inputCls()} />
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor" error={m.fields.amount}>
            <input value={v.amount ? Number(parseMoney(v.amount)).toLocaleString('es-CO') : ''} onChange={(e) => setV({ ...v, amount: e.target.value })} inputMode="numeric" className={inputCls(m.fields.amount)} />
          </Field>
          <Field label="Fecha">
            <input type="date" value={v.date} onChange={(e) => setV({ ...v, date: e.target.value })} className={inputCls()} />
          </Field>
        </div>
        <Field label="Detalle">
          <input value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} className={inputCls()} />
        </Field>
        {m.message && <ErrorBox message={m.message} />}
        <button type="button" disabled={m.busy} onClick={save} className="btn btn-primary w-full">
          <Plus size={17} /> Guardar
        </button>
      </div>
    </Modal>
  )
}
