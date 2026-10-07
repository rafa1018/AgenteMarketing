import { Check, Loader2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { todayYMD } from '@/lib/dates'
import { Modal } from '@/components/ui/Modal'
import { addCharge, closeCharge, fullName, pay, useAdmin } from '../store'
import { field, labelCls } from '../ui'

const CONCEPTS = ['Cuidado jornada mañana', 'Cuidado jornada tarde', 'Día adicional', 'Hora adicional', 'Materiales', 'Salida pedagógica']

/** One-off extra charge for any student (mounted once in the app). */
export function ChargeModal() {
  const charging = useAdmin((s) => s.charging)
  const students = useAdmin((s) => s.students)
  const [studentId, setStudentId] = useState('')
  const [concept, setConcept] = useState(CONCEPTS[0])
  const [amount, setAmount] = useState<number | ''>('')
  const [date, setDate] = useState(todayYMD())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [paidNow, setPaidNow] = useState(true)

  useEffect(() => {
    if (!charging) return
    setStudentId(charging.studentId ?? '')
    setDate(charging.date ?? todayYMD())
    setConcept(CONCEPTS[0])
    setAmount('')
    setError(false)
    setPaidNow(true)
  }, [charging])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!studentId || !amount || Number(amount) <= 0 || concept.trim().length < 2 || !date) return setError(true)
    setBusy(true)
    const charge = await addCharge({ studentId, amount: Number(amount), date, concept: concept.trim() })
    // paid on the spot → register the payment too (linked to the charge), so it never shows as pending
    if (charge && paidNow) await pay({ studentId, amount: Number(amount), date, kind: 'extra', note: concept.trim(), chargeId: charge.id })
    setBusy(false)
  }

  const active = students.filter((s) => s.active)
  const inactive = students.filter((s) => !s.active)
  return (
    <Modal open={Boolean(charging)} onClose={closeCharge} label="Cargo extra" closeLabel="Cerrar" className="sm:!max-w-md">
      <form onSubmit={submit} noValidate className="p-6 sm:p-8">
        <h2 className="pr-12 text-[1.7rem]">Cargo extra</h2>
        <p className="mt-1 text-[15px] text-muted">Un cobro puntual aparte del plan: una mañana de cuidado adicional, o el día de un estudiante inactivo que vino de visita.</p>
        <div className="mt-5 grid gap-4">
          <div>
            <label htmlFor="ch-student" className={labelCls}>
              Estudiante
            </label>
            <select id="ch-student" className={field} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
              <option value="">Elige un estudiante…</option>
              <optgroup label="Activos">
                {active.map((s) => (
                  <option key={s.id} value={s.id}>
                    {fullName(s)}
                  </option>
                ))}
              </optgroup>
              {inactive.length > 0 && (
                <optgroup label="Inactivos (visita ocasional)">
                  {inactive.map((s) => (
                    <option key={s.id} value={s.id}>
                      {fullName(s)}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>
          <div>
            <label htmlFor="ch-concept" className={labelCls}>
              Concepto
            </label>
            <input id="ch-concept" list="ch-concepts" className={field} value={concept} onChange={(e) => setConcept(e.target.value)} maxLength={100} />
            <datalist id="ch-concepts">
              {CONCEPTS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ch-amount" className={labelCls}>
                Valor
              </label>
              <input id="ch-amount" type="number" inputMode="numeric" min={0} step={1000} className={field} value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))} placeholder="15000" />
            </div>
            <div>
              <label htmlFor="ch-date" className={labelCls}>
                Fecha
              </label>
              <input id="ch-date" type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </div>
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg bg-paper p-3">
          <input type="checkbox" checked={paidNow} onChange={(e) => setPaidNow(e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[#3a36a8]" />
          <span>
            <span className="block font-semibold text-ink">Ya lo pagó</span>
            <span className="block text-sm text-muted">Se registra el pago de una vez y no queda pendiente. Desmárcalo si lo paga después.</span>
          </span>
        </label>
        {error && <p className="mt-3 text-sm font-medium text-berry">Elige el estudiante y escribe el concepto y el valor.</p>}
        <button type="submit" disabled={busy} className="btn btn-primary mt-6 w-full disabled:opacity-70">
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Agregar cargo
        </button>
      </form>
    </Modal>
  )
}
