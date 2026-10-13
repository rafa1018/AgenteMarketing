import { Ban, FilePlus2, HandCoins, Loader2, Percent, Printer } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useMutation } from '@/shared/useQuery'
import { date, money, parseMoney, todayISO } from '@/shared/format'
import { toast } from '../../store'
import { api2, useSetup } from '../../v2/api'
import { ErrorBox, Field, inputCls } from '../../v2/kit'
import { METHODS, type Charge } from './types'

/** Register a payment: amount, date, method, reference and which charges it covers. */
export function PaymentModal({ studentId, preselect, charges, onClose, onDone }: { studentId: number; preselect: number[] | null; charges: Charge[]; onClose: () => void; onDone: () => void }) {
  const [chosen, setChosen] = useState<number[]>([])
  const [amount, setAmount] = useState('')
  const [paidOn, setPaidOn] = useState(todayISO())
  const [method, setMethod] = useState('efectivo')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [receiptId, setReceiptId] = useState<number | null>(null)
  const m = useMutation()
  const due = useMemo(() => charges.filter((c) => chosen.includes(c.id)).reduce((a, c) => a + c.balance, 0), [charges, chosen])
  useEffect(() => {
    if (!preselect) return
    setChosen(preselect)
    setAmount(String(charges.filter((c) => preselect.includes(c.id)).reduce((a, c) => a + c.balance, 0) || ''))
    setReceiptId(null)
    setReference('')
    setNotes('')
    setPaidOn(todayISO())
    m.setMessage(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselect])
  const toggle = (id: number) => {
    const next = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id]
    setChosen(next)
    setAmount(String(charges.filter((c) => next.includes(c.id)).reduce((a, c) => a + c.balance, 0) || ''))
  }
  const save = async () => {
    const r = await m.run(() => api2.post<{ id: number }>('/billing/payments', { studentId, amount: parseMoney(amount), paidOn, method, reference, notes, chargeIds: chosen }))
    if (r) {
      toast('Pago registrado')
      setReceiptId(r.id)
      onDone()
    }
  }
  return (
    <Modal open={preselect !== null} onClose={onClose} label="Registrar pago" closeLabel="Cerrar">
      <div className="space-y-4 p-5 sm:p-7">
        <h2 className="flex items-center gap-2 text-[1.5rem]">
          <HandCoins className="text-leaf" /> Registrar pago
        </h2>
        {receiptId ? (
          <div className="space-y-4 text-center">
            <p className="text-[15px] text-muted">El pago quedó registrado y la familia recibe el aviso.</p>
            <a href={`/api/v2/billing/payments/${receiptId}/receipt`} target="_blank" rel="noopener noreferrer" className="btn btn-primary w-full">
              <Printer size={18} /> Ver / imprimir comprobante
            </a>
            <button type="button" onClick={onClose} className="btn btn-ghost w-full">
              Listo
            </button>
          </div>
        ) : (
          <>
            {charges.length > 0 && (
              <div>
                <p className="mb-1.5 text-[14px] font-semibold text-ink">¿Qué paga?</p>
                <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl bg-paper p-2">
                  {charges.map((c) => (
                    <li key={c.id}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-white px-3 py-2">
                        <input type="checkbox" checked={chosen.includes(c.id)} onChange={() => toggle(c.id)} className="size-5 accent-[#3a36a8]" />
                        <span className="flex-1 text-[14px]">{c.description}</span>
                        <span className="font-semibold tabular-nums">{money(c.balance)}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[13px] text-muted">Si no eliges ninguno, se paga lo más antiguo primero. Lo que sobre queda como saldo a favor.</p>
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Valor recibido" error={m.fields.amount} hint={due ? `Seleccionado: ${money(due)}` : undefined}>
                <input value={amount ? Number(parseMoney(amount)).toLocaleString('es-CO') : ''} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" className={inputCls(m.fields.amount)} />
              </Field>
              <Field label="Fecha del pago" error={m.fields.paidOn}>
                <input type="date" value={paidOn} max={todayISO()} onChange={(e) => setPaidOn(e.target.value)} className={inputCls(m.fields.paidOn)} />
              </Field>
              <Field label="Medio de pago">
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputCls()}>
                  {METHODS.map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Referencia / No. de comprobante">
                <input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Comprobante Nequi No. 2451" className={inputCls()} />
              </Field>
              <Field label="Observaciones" className="sm:col-span-2">
                <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls()} />
              </Field>
            </div>
            {m.message && <ErrorBox message={m.message} />}
            <button type="button" disabled={m.busy} onClick={save} className="btn btn-primary w-full">
              {m.busy && <Loader2 size={18} className="animate-spin" />} Registrar {amount ? money(parseMoney(amount)) : 'pago'}
            </button>
          </>
        )}
      </div>
    </Modal>
  )
}

/** A one-off charge: clausura, uniforme, salida pedagógica… */
export function ChargeFormModal({ studentId, open, onClose, onDone }: { studentId: number; open: boolean; onClose: () => void; onDone: () => void }) {
  const { setup, year } = useSetup()
  const concepts = setup?.concepts.filter((c) => c.active) ?? []
  const [concept, setConcept] = useState<number | ''>('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [dueOn, setDueOn] = useState('')
  const m = useMutation()
  useEffect(() => {
    if (open) {
      const c = concepts.find((x) => x.code === 'CLAUSURA') ?? concepts[0]
      setConcept(c?.id ?? '')
      setDescription(c ? `${c.name} ${year}` : '')
      setAmount('')
      setDueOn('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const save = async () => {
    const r = await m.run(() => api2.post('/billing/charges', { studentId, conceptId: concept, description, amount: parseMoney(amount), dueOn: dueOn || null, year }))
    if (r) {
      toast('Cobro creado (la familia recibe el aviso)')
      onDone()
      onClose()
    }
  }
  return (
    <Modal open={open} onClose={onClose} label="Nuevo cobro" closeLabel="Cerrar" className="sm:!max-w-lg">
      <div className="space-y-4 p-5 sm:p-7">
        <h2 className="flex items-center gap-2 text-[1.5rem]">
          <FilePlus2 className="text-royal" /> Nuevo cobro
        </h2>
        <Field label="Concepto">
          <select value={concept} onChange={(e) => { const id = Number(e.target.value); setConcept(id); const c = concepts.find((x) => x.id === id); if (c) setDescription(`${c.name} ${year}`) }} className={inputCls()}>
            {concepts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Descripción (la ve la familia)" error={m.fields.description}>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls(m.fields.description)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Valor" error={m.fields.amount}>
            <input value={amount ? Number(parseMoney(amount)).toLocaleString('es-CO') : ''} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" className={inputCls(m.fields.amount)} />
          </Field>
          <Field label="Vence (opcional)">
            <input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} className={inputCls()} />
          </Field>
        </div>
        {m.message && <ErrorBox message={m.message} />}
        <button type="button" disabled={m.busy} onClick={save} className="btn btn-primary w-full">
          Crear cobro
        </button>
      </div>
    </Modal>
  )
}

export function AdjustModal({ charge, onClose, onDone, defaultReason = '' }: { charge: Charge | null; onClose: () => void; onDone: () => void; defaultReason?: string }) {
  const [kind, setKind] = useState<'descuento' | 'recargo'>('descuento')
  const [mode, setMode] = useState<'valor' | 'porcentaje'>('valor')
  const [amount, setAmount] = useState('')
  const [pct, setPct] = useState('')
  const [until, setUntil] = useState('')
  const [reason, setReason] = useState('')
  const m = useMutation()
  useEffect(() => {
    setAmount('')
    setPct('')
    setUntil('')
    setMode('valor')
    setReason(defaultReason) // discounts start with "Estudiante antiguo (ingresó en …)", editable
    setKind('descuento')
  }, [charge, defaultReason])
  // the default reason is for discounts: switching to a surcharge clears it (unless it was edited)
  useEffect(() => {
    setReason((r) => (kind === 'recargo' && r === defaultReason ? '' : kind === 'descuento' && r === '' ? defaultReason : r))
  }, [kind, defaultReason])
  // % of the charge's value (before other discounts / surcharges)
  const base = charge?.amount ?? 0
  const pctNum = Math.max(0, Math.min(100, Number(pct.replace(',', '.')) || 0))
  const value = mode === 'porcentaje' ? Math.round((base * pctNum) / 100) : parseMoney(amount)
  const save = async () => {
    const r = await m.run(() => api2.post(`/billing/charges/${charge!.id}/adjustments`, { kind, amount: value, reason, validUntil: kind === 'descuento' && until ? until : null }))
    if (r) {
      toast(kind === 'descuento' ? 'Descuento aplicado' : 'Recargo aplicado')
      onDone()
      onClose()
    }
  }
  return (
    <Modal open={Boolean(charge)} onClose={onClose} label="Descuento o recargo" closeLabel="Cerrar" className="sm:!max-w-md">
      <div className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-[1.4rem]">
          <Percent className="text-pink" /> {charge?.description}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {(['descuento', 'recargo'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} className={`btn ${kind === k ? 'btn-primary' : 'btn-ghost'}`}>
              {k === 'descuento' ? 'Descuento' : 'Recargo'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 rounded-xl bg-paper p-1">
          {([['valor', 'Valor en $'], ['porcentaje', 'Porcentaje %']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => setMode(k)} className={`flex-1 rounded-lg py-1.5 text-[13px] font-semibold ${mode === k ? 'bg-white text-ink shadow-sm' : 'text-muted'}`}>
              {l}
            </button>
          ))}
        </div>
        {mode === 'valor' ? (
          <Field label="Valor" error={m.fields.amount}>
            <input value={amount ? Number(parseMoney(amount)).toLocaleString('es-CO') : ''} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" className={inputCls(m.fields.amount)} />
          </Field>
        ) : (
          <Field label="Porcentaje" error={m.fields.amount} hint={`Del valor del cobro (${money(base)}): ${kind === 'descuento' ? '−' : '+'} ${money(value)}`}>
            <div className="relative">
              <input value={pct} onChange={(e) => setPct(e.target.value)} inputMode="decimal" placeholder="10" className={inputCls(m.fields.amount) + ' pr-9'} />
              <span className="absolute inset-y-0 right-3 grid place-items-center font-semibold text-muted">%</span>
            </div>
          </Field>
        )}
        {kind === 'descuento' && (
          <Field label="Solo si paga hasta (opcional)" hint={until ? `Pronto pago: vale si el cobro queda pagado a más tardar el ${date(until)}. Después de esa fecha, si sigue pendiente, el descuento se quita solo.` : 'Vacío = el descuento vale siempre.'}>
            <input type="date" value={until} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setUntil(e.target.value)} className={inputCls()} />
          </Field>
        )}
        {value > 0 && (
          <p className="rounded-xl bg-paper px-4 py-2.5 text-[14px] text-ink">
            {kind === 'descuento' ? 'Descuento' : 'Recargo'}: <b>{money(value)}</b> · el cobro queda en <b>{money(Math.max(0, (charge?.net ?? base) + (kind === 'descuento' ? -value : value)))}</b>
          </p>
        )}
        <Field label="Motivo" error={m.fields.reason}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={kind === 'descuento' ? 'Hermanos, pronto pago…' : 'Cheque devuelto…'} className={inputCls(m.fields.reason)} />
        </Field>
        {m.message && <ErrorBox message={m.message} />}
        <button type="button" disabled={m.busy} onClick={save} className="btn btn-primary w-full">
          Aplicar
        </button>
      </div>
    </Modal>
  )
}

export function VoidModal({ target, onClose, onDone }: { target: { kind: 'charge' | 'payment'; id: number; label: string } | null; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState('')
  const m = useMutation()
  useEffect(() => setReason(''), [target])
  const save = async () => {
    const path = target!.kind === 'charge' ? `/billing/charges/${target!.id}/void` : `/billing/payments/${target!.id}/void`
    const r = await m.run(() => api2.post(path, { reason }))
    if (r) {
      toast('Anulado')
      onDone()
      onClose()
    }
  }
  return (
    <Modal open={Boolean(target)} onClose={onClose} label="Anular" closeLabel="Cerrar" className="sm:!max-w-md">
      <div className="space-y-4 p-6">
        <h2 className="flex items-center gap-2 text-[1.4rem]">
          <Ban className="text-berry" /> Anular {target?.label}
        </h2>
        <p className="text-sm text-muted">{target?.kind === 'payment' ? 'Los cobros que cubría vuelven a quedar pendientes y se quita el ingreso de caja.' : 'El cobro deja de aparecer como deuda.'} Queda registrado quién lo anuló.</p>
        <Field label="Motivo" error={m.fields.reason}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} className={inputCls(m.fields.reason)} />
        </Field>
        {m.message && <ErrorBox message={m.message} />}
        <button type="button" disabled={m.busy} onClick={save} className="btn w-full bg-berry text-white">
          Anular
        </button>
      </div>
    </Modal>
  )
}
