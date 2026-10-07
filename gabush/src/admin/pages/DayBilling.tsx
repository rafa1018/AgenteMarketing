import { Check, ChevronDown, Loader2, MessageCircle, Printer, Receipt, RotateCcw, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { addDays, formatDay, todayYMD } from '@/lib/dates'
import { dayStatus } from '@/lib/schedule'
import { useCalendar } from '@/lib/calendar'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { closeDayBilling, fullName, mark, openReminder, pay, priceOf, useAdmin, type Payment, type Student } from '../store'
import { dayLedger, guardianWhatsapp, money, type LedgerDay } from '../logic'
import { Avatar, field, labelCls } from '../ui'

const short = (d: string) => new Intl.DateTimeFormat('es-CO', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`)).replace(/\./g, '')
/** "4 oct" — compact, fits next to a row on a phone */
const dayMonth = (d: string) => new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`)).replace(/\./g, '')
const monthTitle = (d: string) => new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${d}T00:00:00Z`))
const receiptNo = (p: Payment) => p.id.slice(0, 6).toUpperCase()

/** A row of the list: a marked day (asistió / no asistió) or an open day nobody marked yet ("u"). */
type Row = Omit<LedgerDay, 's'> & { s: LedgerDay['s'] | 'u' }

/** Receipt as plain text (WhatsApp). */
function receiptText(st: Student, p: Payment, days: LedgerDay[], pendingAfter: { count: number; owed: number }) {
  const lines = days.map((d) => `• ${short(d.date)} · ${money(d.paidAmount ?? d.price)}${d.paidNote ? ` (${d.paidNote})` : ''}`)
  return [
    `🧾 *Recibo de pago N.º ${receiptNo(p)}* · Gabush Kids`,
    ``,
    `Estudiante: ${fullName(st)}`,
    `Fecha de pago: ${formatDay(p.date, 'es')}`,
    `Días pagados (${days.length}):`,
    ...lines,
    ``,
    `*Total pagado: ${money(p.amount)}*`,
    pendingAfter.count ? `Saldo pendiente: ${money(pendingAfter.owed)} (${pendingAfter.count} día${pendingAfter.count === 1 ? '' : 's'})` : 'Quedas al día. ¡Gracias!',
  ].join('\n')
}

/** Printable receipt (opens the browser print dialog → print or "Save as PDF"). */
function printReceipt(st: Student, p: Payment, days: LedgerDay[]) {
  const rows = days.map((d) => `<tr><td>${short(d.date)}${d.paidNote ? `<br><small>${d.paidNote.replace(/</g, '&lt;')}</small>` : ''}</td><td style="text-align:right">${money(d.paidAmount ?? d.price)}</td></tr>`).join('')
  const w = window.open('', '_blank', 'width=520,height=720')
  if (!w) return
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Recibo ${receiptNo(p)}</title>
<style>body{font-family:Arial,sans-serif;color:#23206b;padding:32px;max-width:440px;margin:auto}h1{font-size:22px;margin:0}small{color:#615f86}
table{width:100%;border-collapse:collapse;margin-top:16px;font-family:Arial,sans-serif;font-size:14px}td{padding:6px 0;border-bottom:1px solid #e3e5f3}
.total td{font-weight:bold;font-size:16px;border-bottom:none;padding-top:12px}.box{border:1px solid #e3e5f3;border-radius:12px;padding:20px}</style></head>
<body><div class="box"><h1>Gabush Kids</h1><small>Jardín infantil · Valledupar, Cesar</small>
<p style="margin-top:18px;font-family:Arial,sans-serif;font-size:14px"><b>Recibo de pago N.º ${receiptNo(p)}</b><br>Estudiante: ${fullName(st)}<br>Fecha de pago: ${formatDay(p.date, 'es')}${p.note ? `<br>Forma de pago: ${p.note}` : ''}</p>
<table>${rows}<tr class="total"><td>Total (${days.length} día${days.length === 1 ? '' : 's'})</td><td style="text-align:right">${money(p.amount)}</td></tr></table></div>
<script>window.onload=()=>{window.print()}</script></body></html>`)
  w.document.close()
}

/** Days & payments of a "por día" student: mark which days are paid and get a receipt. */
export function DayBillingModal() {
  const id = useAdmin((s) => s.dayBilling)
  const students = useAdmin((s) => s.students)
  const payments = useAdmin((s) => s.payments)
  const attendance = useAdmin((s) => s.attendance)
  const st = students.find((s) => s.id === id)
  const today = todayYMD()
  const ledger = useMemo(() => (st ? dayLedger(st, priceOf(st), payments, attendance, today) : null), [st, payments, attendance, today])
  const schedule = useCalendar((s) => s.schedule)
  const events = useCalendar((s) => s.events)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [amounts, setAmounts] = useState<Record<string, number | ''>>({})
  const [date, setDate] = useState(today)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [receipt, setReceipt] = useState<Payment | null>(null)
  const [showPaid, setShowPaid] = useState(false)
  const [tab, setTab] = useState<'asistio' | 'sinmarcar'>('asistio')

  useEffect(() => {
    setSelected(new Set())
    setAmounts({})
    setDate(todayYMD())
    setNote('')
    setReceipt(null)
    setShowPaid(false)
    setTab('asistio')
  }, [id])

  if (!st || !ledger) return null
  // from the latest entry date: every open day — marked or not — plus any older day still unpaid
  const lastStart = st.periods?.[st.periods.length - 1]?.start ?? st.startDate
  const markedDates = new Set(ledger.days.map((d) => d.date))
  const unmarked: Row[] = []
  for (let d = lastStart, i = 0; d <= today && i < 800; d = addDays(d, 1), i++) {
    if (!markedDates.has(d) && dayStatus(schedule, events, d).open) unmarked.push({ date: d, s: 'u', price: priceOf(st) })
  }
  const rows: Row[] = [...ledger.days.filter((d) => d.date >= lastStart || (d.s === 'a' && !d.paidBy)), ...unmarked].sort((a, b) => a.date.localeCompare(b.date))
  // days that can be charged: attended & unpaid (days not marked yet are only marked in their own tab)
  const pendingSet = new Set(ledger.pending.map((d) => d.date))
  const amountOf = (d: { date: string; price: number }) => (amounts[d.date] === undefined || amounts[d.date] === '' ? d.price : Number(amounts[d.date]))
  const total = rows.filter((d) => pendingSet.has(d.date) && selected.has(d.date)).reduce((n, d) => n + amountOf(d), 0)
  const allSelected = ledger.pending.length > 0 && ledger.pending.every((d) => selected.has(d.date))
  const toggle = (d: string) =>
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(d)) n.delete(d)
      else n.add(d)
      return n
    })

  const submit = async () => {
    const chosen = rows.filter((d) => pendingSet.has(d.date) && selected.has(d.date))
    if (!chosen.length || !date) return
    const items = chosen.map((d) => ({ date: d.date, amount: amountOf(d), note: '' }))
    setBusy(true)
    const saved = await pay({ studentId: st.id, amount: total, date, kind: 'dia', note: note.trim(), days: items.map((i) => i.date), items })
    setBusy(false)
    if (saved) {
      setSelected(new Set())
      setAmounts({})
      setReceipt(saved)
    }
  }

  // receipt view (right after paying, or from the history)
  if (receipt) {
    const days = ledger.days.filter((d) => receipt.days?.includes(d.date))
    const after = { count: ledger.pending.length, owed: ledger.owed }
    const wa = st.guardianPhone ? guardianWhatsapp(st.guardianPhone, receiptText(st, receipt, days, after)) : null
    return (
      <Modal open onClose={closeDayBilling} label="Recibo de pago" closeLabel="Cerrar" className="sm:!max-w-md">
        <div className="p-6 sm:p-8">
          <span className="grid size-12 place-items-center rounded-full bg-[#e9f4ee] text-leaf">
            <Receipt size={24} />
          </span>
          <h2 className="mt-3 text-[1.6rem]">Recibo N.º {receiptNo(receipt)}</h2>
          <p className="text-[15px] text-muted">
            {fullName(st)} · pagado el {formatDay(receipt.date, 'es')}
            {receipt.note && ` · ${receipt.note}`}
          </p>
          <ul className="mt-4 divide-y divide-line rounded-xl border border-line px-4">
            {days.map((d) => (
              <li key={d.date} className="flex justify-between gap-3 py-2 text-[15px]">
                <span>
                  <span className="block first-letter:uppercase">{short(d.date)}</span>
                  {d.paidNote && <span className="block text-xs text-muted">{d.paidNote}</span>}
                </span>
                <span className="font-medium text-ink">{money(d.paidAmount ?? d.price)}</span>
              </li>
            ))}
            <li className="flex justify-between py-3 font-semibold text-ink">
              <span>
                Total ({days.length} día{days.length === 1 ? '' : 's'})
              </span>
              <span className="font-serif text-lg">{money(receipt.amount)}</span>
            </li>
          </ul>
          <p className={cn('mt-3 rounded-lg px-3 py-2 text-sm font-medium', after.count ? 'bg-[#fff4e0] text-[#8a5716]' : 'bg-[#e9f4ee] text-leaf')}>
            {after.count ? `Sigue pendiente: ${money(after.owed)} (${after.count} día${after.count === 1 ? '' : 's'})` : 'Quedó al día ✓'}
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {wa ? (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp !min-h-11 !text-[15px]">
                <MessageCircle size={17} /> Enviar al acudiente
              </a>
            ) : (
              <span className="rounded-lg bg-paper px-3 py-2 text-center text-sm text-muted">Registra el WhatsApp del acudiente en su ficha para enviarlo.</span>
            )}
            <button type="button" onClick={() => printReceipt(st, receipt, days)} className="btn btn-ghost !min-h-11 !text-[15px]">
              <Printer size={17} /> Imprimir / PDF
            </button>
          </div>
          <button type="button" onClick={() => setReceipt(null)} className="mt-3 w-full text-sm font-semibold text-royal hover:underline">
            ← Volver a los días
          </button>
        </div>
      </Modal>
    )
  }

  // days grouped by month, newest month first
  const months = new Map<string, Row[]>()
  for (const d of [...rows].reverse()) {
    // "Asistió": attended days · "Sin marcar": unmarked days plus the "No vino" ones (so they can be undone)
    if (tab === 'asistio' ? d.s !== 'a' : d.s === 'a') continue
    if (!showPaid && d.s === 'a' && d.paidBy) continue
    const k = d.date.slice(0, 7)
    months.set(k, [...(months.get(k) ?? []), d])
  }
  const paidCount = ledger.days.filter((d) => d.s === 'a' && d.paidBy).length

  return (
    <Modal open onClose={closeDayBilling} label="Días y pagos" closeLabel="Cerrar">
      <div className="flex max-h-[92svh] flex-col">
        <div className="border-b border-line p-5 sm:p-6">
          <div className="flex items-center gap-3 pr-12">
            <Avatar student={st} size={48} />
            <div className="min-w-0">
              <h2 className="truncate text-[1.4rem]">{fullName(st)}</h2>
              <p className="text-sm text-muted">Plan por día · {money(priceOf(st))} por día asistido</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-paper p-2">
              <p className="font-serif text-xl font-semibold text-ink">{ledger.attended}</p>
              <p className="text-xs text-muted">días asistidos</p>
            </div>
            <div className="rounded-lg bg-[#e9f4ee] p-2">
              <p className="font-serif text-xl font-semibold text-leaf">{paidCount}</p>
              <p className="text-xs text-muted">pagados</p>
            </div>
            <div className="rounded-lg bg-[#fdf0ef] p-2">
              <p className="font-serif text-xl font-semibold text-berry">{money(ledger.owed)}</p>
              <p className="text-xs text-muted">{ledger.pending.length} pendientes</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 sm:px-6">
          <div role="tablist" className="sticky top-0 z-10 -mx-1 grid grid-cols-2 gap-1 rounded-xl bg-paper p-1">
            {(
              [
                ['asistio', `Asistió (${ledger.attended})`],
                ['sinmarcar', `Sin marcar (${unmarked.length})`],
              ] as const
            ).map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('rounded-lg px-3 py-2 text-sm font-semibold transition-colors', tab === id ? 'bg-white text-ink shadow-sm' : 'text-muted hover:text-ink')}>
                {label}
              </button>
            ))}
          </div>
          <div className={cn('flex flex-wrap items-center justify-between gap-2 py-2', tab !== 'asistio' && 'hidden')}>
            {ledger.pending.length > 0 ? (
              <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
                <input type="checkbox" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(ledger.pending.map((d) => d.date)))} className="size-5 accent-[#3a36a8]" />
                Seleccionar todos los pendientes
              </label>
            ) : (
              <p className="text-sm font-semibold text-leaf">✓ No tiene días pendientes</p>
            )}
            {paidCount > 0 && (
              <button type="button" onClick={() => setShowPaid((v) => !v)} className="text-sm font-semibold text-royal hover:underline">
                {showPaid ? 'Ocultar pagados' : `Ver también pagados (${paidCount})`}
              </button>
            )}
          </div>

          {tab === 'asistio' && ledger.pending.length > 0 && (
            <p className="-mt-1 mb-1 text-[13px] leading-snug text-muted">
              Al seleccionar un día puedes cambiar su valor ahí mismo. <RotateCcw size={13} className="inline align-[-2px]" /> lo devuelve a “Sin marcar”.
            </p>
          )}
          {tab === 'sinmarcar' && unmarked.length > 0 && (
            <p className="mt-2 mb-1 rounded-lg bg-[#fff4e0] px-3 py-2 text-sm text-[#8a5716]">
              Días hábiles desde su ingreso que no se marcaron en Asistencia. Marca si vino o no: los que vinieron pasan a la pestaña “Asistió” para cobrarlos. ¿Te equivocaste? Toca ↺ Deshacer.
            </p>
          )}
          {months.size === 0 && (
            <p className="py-6 text-center text-muted">{tab === 'asistio' ? (showPaid || !ledger.attended ? 'Aún no tiene días asistidos.' : 'No tiene días pendientes. Toca “Ver también pagados” para verlos.') : '✓ Todos los días desde su ingreso están marcados.'}</p>
          )}
          {[...months.entries()].map(([k, list]) => (
            <section key={k} className="mt-3">
              <h3 className="font-serif text-base first-letter:uppercase">{monthTitle(`${k}-01`)}</h3>
              <ul className="mt-1 divide-y divide-line rounded-xl border border-line">
                {list.map((d) => {
                  const pending = pendingSet.has(d.date)
                  // "No vino": stays in the "Sin marcar" tab so a mistake can be undone
                  if (d.s === 'f')
                    return (
                      <li key={d.date} className="flex items-center gap-2 bg-paper/60 px-3 py-2.5">
                        <span className="min-w-0 flex-1 text-[15px] whitespace-nowrap text-muted first-letter:uppercase">{short(d.date)}</span>
                        <span className="rounded-full bg-[#f1f2f5] px-2 py-0.5 text-xs font-semibold text-muted">No vino</span>
                        <button type="button" onClick={() => mark(d.date, st, null)} aria-label={`Deshacer ${short(d.date)}`} className="inline-flex h-10 items-center gap-1 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink hover:border-ink">
                          <RotateCcw size={15} /> Deshacer
                        </button>
                      </li>
                    )
                  // not marked yet: only "vino / no vino" here (charging happens in the "Asistió" tab)
                  if (d.s === 'u')
                    return (
                      <li key={d.date} className="flex items-center gap-2 px-3 py-2.5">
                        <span className="min-w-0 flex-1 text-[15px] whitespace-nowrap text-ink first-letter:uppercase">{short(d.date)}</span>
                        <button type="button" onClick={() => mark(d.date, st, 'a')} aria-label={`${short(d.date)}: vino`} className="inline-flex h-10 items-center gap-1 rounded-lg border border-leaf/40 px-3 text-sm font-semibold text-leaf hover:bg-leaf hover:text-white">
                          <Check size={16} strokeWidth={2.6} /> Vino
                        </button>
                        <button type="button" onClick={() => mark(d.date, st, 'f')} aria-label={`${short(d.date)}: no vino`} className="inline-flex h-10 items-center gap-1 rounded-lg border border-line px-3 text-sm font-semibold text-muted hover:border-berry hover:text-berry">
                          <X size={16} strokeWidth={2.6} /> No vino
                        </button>
                      </li>
                    )
                  return (
                    <li key={d.date} className={cn(selected.has(d.date) && 'bg-[#f3f6fc]')}>
                      <div className="flex min-h-[52px] items-center gap-2 py-1.5 pr-2 pl-3">
                        {/* checkbox + date select the day; the price sits outside the label so typing in it never toggles */}
                        <label className={cn('flex min-w-0 flex-1 items-center gap-3 self-stretch', pending && 'cursor-pointer')}>
                          {pending ? (
                            <input type="checkbox" checked={selected.has(d.date)} onChange={() => toggle(d.date)} className="size-5 shrink-0 accent-[#3a36a8]" />
                          ) : (
                            <span className="grid size-5 shrink-0 place-items-center">{d.paidBy ? <Check size={16} className="text-leaf" /> : '·'}</span>
                          )}
                          <span className="min-w-0 truncate text-[15px] text-ink first-letter:uppercase">{short(d.date)}</span>
                        </label>
                        {d.paidBy ? (
                          <button type="button" onClick={() => setReceipt(d.paidBy!)} className="shrink-0 text-right text-xs font-semibold text-leaf hover:underline" title="Ver recibo">
                            Pagado {dayMonth(d.paidBy.date)}
                            {d.paidAmount !== undefined && d.paidAmount !== d.price && <span className="block text-ink">{money(d.paidAmount)}</span>}
                          </button>
                        ) : selected.has(d.date) ? (
                          // selected: the price itself becomes editable, right here
                          <span className="flex h-10 w-[7.5rem] shrink-0 items-center rounded-lg border border-royal bg-white pl-2 focus-within:ring-2 focus-within:ring-royal/25">
                            <span className="text-[15px] text-muted">$</span>
                            <input
                              type="number"
                              inputMode="numeric"
                              min={0}
                              step={1000}
                              value={amounts[d.date] ?? d.price}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => setAmounts((a) => ({ ...a, [d.date]: e.target.value === '' ? '' : Number(e.target.value) }))}
                              aria-label={`Valor a cobrar el ${short(d.date)}`}
                              className="h-full w-full min-w-0 bg-transparent pr-2 pl-1 text-right text-[15px] font-semibold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                            />
                          </span>
                        ) : (
                          <b className="shrink-0 text-[15px] text-ink">{money(d.price)}</b>
                        )}
                        {/* attended but not paid: undo → back to "Sin marcar" */}
                        {pending && !selected.has(d.date) && (
                          <button type="button" onClick={() => mark(d.date, st, null)} title="Deshacer: vuelve a “Sin marcar”" aria-label={`Deshacer ${short(d.date)}: vuelve a Sin marcar`} className="grid size-10 shrink-0 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink">
                            <RotateCcw size={17} />
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}

          {ledger.payments.length > 0 && (
            <details className="mt-5 mb-2">
              <summary className="flex cursor-pointer items-center gap-1 text-sm font-semibold text-ink">
                <ChevronDown size={16} /> Pagos registrados ({ledger.payments.length})
              </summary>
              <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
                {[...ledger.payments].reverse().map((p) => (
                  <li key={p.id}>
                    <button type="button" onClick={() => setReceipt(p)} disabled={!p.days?.length} className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-[15px] hover:bg-paper disabled:cursor-default disabled:hover:bg-transparent">
                      <span>
                        {formatDay(p.date, 'es')} · {p.days?.length ? `${p.days.length} día${p.days.length === 1 ? '' : 's'}` : 'pago anterior'}
                        {p.note && <span className="text-muted"> · {p.note}</span>}
                      </span>
                      <b>{money(p.amount)}</b>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        {/* pay the selected days */}
        <div className="border-t border-line bg-white p-4 sm:p-5">
          {selected.size > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="db-date" className={labelCls}>
                    Fecha del pago
                  </label>
                  <input id="db-date" type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <label htmlFor="db-note" className={labelCls}>
                    Forma de pago
                  </label>
                  <input id="db-note" className={field} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Efectivo, Nequi…" />
                </div>
              </div>
              <button type="button" disabled={busy} onClick={submit} className="btn btn-primary mt-3 w-full disabled:opacity-70">
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Receipt size={18} />}
                Registrar pago de {selected.size} día{selected.size === 1 ? '' : 's'} · {money(total)}
              </button>
            </>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted">{ledger.pending.length ? 'Marca los días que va a pagar.' : 'Todo pagado.'}</p>
              {ledger.owed > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    closeDayBilling()
                    openReminder({ student: st, kind: 'dia', amount: ledger.owed, date: ledger.pending[0]?.date ?? today, status: 'hoy', count: ledger.pending.length })
                  }}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:border-ink"
                >
                  <MessageCircle size={16} /> Recordar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}
