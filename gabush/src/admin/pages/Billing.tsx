import { Check, ListChecks, Loader2, MessageCircle, Wallet } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { dayDiff, formatDay, todayYMD } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { fullName, openDayBilling, openReminder, pay, priceOf, useAdmin } from '../store'
import { duesFor, money, sortDues, type Due } from '../logic'
import { Avatar, field, labelCls } from '../ui'

/** All dues of active students, most urgent first. */
export function useDues() {
  const students = useAdmin((s) => s.students)
  const plans = useAdmin((s) => s.plans)
  const payments = useAdmin((s) => s.payments)
  const charges = useAdmin((s) => s.charges)
  const attendance = useAdmin((s) => s.attendance)
  const mode = useAdmin((s) => s.monthlyMode)
  const today = todayYMD()
  return useMemo(
    () =>
      students
        .flatMap((s) => {
          const plan = plans.find((p) => p.id === s.planId)
          return duesFor(s, plan, s.price ?? plan?.price ?? 0, payments, charges, attendance, today, s.monthlyMode ?? mode)
        })
        .sort(sortDues),
    [students, plans, payments, charges, attendance, today, mode],
  )
}

export const extraText = (d: Due) => `Extra: ${(d.charges ?? []).map((c) => `${c.concept} (${formatDay(c.date, 'es')})`).join(', ')}`

export function whenText(d: Due, today: string) {
  if (d.kind === 'extra') return extraText(d)
  if (d.kind === 'dia') return d.amount > 0 ? `${d.count} día${d.count === 1 ? '' : 's'} asistido${d.count === 1 ? '' : 's'} sin pagar` : 'Al día'
  const n = dayDiff(d.date, today)
  if (d.status === 'hoy') return `Cobra hoy · ${formatDay(d.date, 'es')}`
  if (d.status === 'vencido') return `Vencido hace ${n} día${n === 1 ? '' : 's'} · debía pagar el ${formatDay(d.date, 'es')}${d.count > 1 ? ` · ${d.count} meses` : ''}`
  return `Cobra el ${formatDay(d.date, 'es')}`
}

export function DueRow({ d, onPay }: { d: Due; onPay: (d: Due) => void }) {
  const today = todayYMD()
  const tone = d.status === 'vencido' || d.kind === 'extra' || (d.kind === 'dia' && d.amount > 0) ? 'text-berry' : d.status === 'hoy' || d.status === 'pronto' ? 'text-[#8a5716]' : 'text-leaf'
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <Avatar student={d.student} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-ink">
          {fullName(d.student)} {d.inactive && <span className="ml-1 rounded bg-[#f1f2f5] px-1.5 py-0.5 text-[11px] font-semibold text-muted uppercase">Inactivo</span>}
        </p>
        <p className={cn('text-sm font-medium', tone)}>{whenText(d, today)}</p>
      </div>
      <p className="font-serif text-lg font-semibold text-ink">{money(d.amount)}</p>
      <div className="flex w-full gap-2 sm:w-auto">
        <button type="button" onClick={() => openReminder(d)} title="Recordar por WhatsApp" aria-label={`Recordar por WhatsApp a ${fullName(d.student)}`} className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-ink hover:border-whatsapp hover:text-[#1faa53]">
          <MessageCircle size={18} />
        </button>
        {d.kind === 'dia' ? (
          <button type="button" onClick={() => openDayBilling(d.student.id)} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-semibold text-white hover:bg-royal sm:flex-none">
            <ListChecks size={16} /> Cobrar días
          </button>
        ) : (
          <button type="button" onClick={() => onPay(d)} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink px-3 text-sm font-semibold text-white hover:bg-royal sm:flex-none">
            <Wallet size={16} /> Marcar pago
          </button>
        )}
      </div>
    </li>
  )
}

export function PayModal({ due, onClose }: { due: Due | null; onClose: () => void }) {
  const today = todayYMD()
  const [amount, setAmount] = useState<number | ''>('')
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [last, setLast] = useState<Due | null>(null)
  if (due && due !== last) {
    setLast(due)
    setAmount(due.kind === 'mensual' ? priceOf(due.student) : due.amount)
    setDate(today)
    setNote('')
  }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!due || amount === '' || !date) return
    setBusy(true)
    const ok = await pay({ studentId: due.student.id, amount: Number(amount), date, kind: due.kind, note: note.trim() })
    setBusy(false)
    if (ok) onClose()
  }
  return (
    <Modal open={Boolean(due)} onClose={onClose} label="Marcar pago" closeLabel="Cerrar" className="sm:!max-w-md">
      {due && (
        <form onSubmit={submit} className="p-6 sm:p-8">
          <h2 className="pr-12 text-[1.7rem]">Marcar pago</h2>
          <div className="mt-4 flex items-center gap-3">
            <Avatar student={due.student} size={48} />
            <div>
              <p className="font-semibold text-ink">{fullName(due.student)}</p>
              <p className="text-sm text-muted">{due.kind === 'mensual' ? `Mensualidad del ${formatDay(due.date, 'es')}` : due.kind === 'extra' ? extraText(due) : 'Pago de días asistidos'}</p>
            </div>
          </div>
          <div className="mt-5 grid gap-4">
            <div>
              <label htmlFor="pay-amount" className={labelCls}>
                Valor recibido
              </label>
              <input id="pay-amount" type="number" inputMode="numeric" min={0} step={1000} required className={field} value={amount} onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))} />
            </div>
            <div>
              <label htmlFor="pay-date" className={labelCls}>
                Fecha del pago
              </label>
              <input id="pay-date" type="date" required className={field} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="pay-note" className={labelCls}>
                Nota <span className="font-normal text-muted">(opcional)</span>
              </label>
              <input id="pay-note" className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Efectivo, transferencia…" />
            </div>
          </div>
          {due.kind === 'mensual' && <p className="mt-3 text-sm text-muted">Al guardar, el próximo cobro pasa al mes siguiente.</p>}
          <button type="submit" disabled={busy} className="btn btn-primary mt-6 w-full disabled:opacity-70">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Guardar pago
          </button>
        </form>
      )}
    </Modal>
  )
}

