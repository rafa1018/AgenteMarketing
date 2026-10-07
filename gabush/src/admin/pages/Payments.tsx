import { Check, ListChecks, MessageCircle, Plus, Trash2, Wallet } from 'lucide-react'
import { useState } from 'react'
import { addDays, dayDiff, formatDay, parseYMD, todayYMD } from '@/lib/dates'
import { fullName, openCharge, openDayBilling, openReminder, priceOf, removeCharge, unpay, useAdmin, type Payment, type Student } from '../store'
import { money, type Due } from '../logic'
import { Avatar, Card, ConfirmModal, PageHead } from '../ui'
import { DueRow, PayModal, extraText, useDues } from './Billing'

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** Card for a pending payment: photo, delay and accumulated amount. */
function DueCard({ d, onPay }: { d: Due; onPay: (d: Due) => void }) {
  const today = todayYMD()
  const late = d.kind === 'mensual' ? Math.max(0, dayDiff(d.date, today)) : 0
  const detail = d.kind === 'extra' ? extraText(d) : d.kind === 'dia' ? `${plural(d.count, 'día asistido', 'días asistidos')} sin pagar` : late > 0 ? `${plural(late, 'día', 'días')} de retraso${d.count > 1 ? ` · ${d.count} meses` : ''}` : 'Vence hoy'

  return (
    <li className="card flex flex-col p-4">
      <div className="flex items-center gap-3">
        <Avatar student={d.student} size={52} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-ink">{fullName(d.student)}</p>
          <p className="truncate text-sm text-muted">
            {d.inactive ? 'Inactivo · ' : ''}
            {d.kind === 'extra' ? 'Cargo extra' : (d.plan?.name ?? 'Sin plan')}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-[#fdf0ef] px-2.5 py-1 text-xs font-semibold text-berry">Pendiente</span>
      </div>
      <p className="mt-4 font-serif text-[1.7rem] leading-none font-semibold text-ink">{money(d.amount)}</p>
      <p className="mt-1 text-sm font-medium text-berry">{detail}</p>
      {d.kind === 'mensual' && <p className="text-xs text-muted">Debía pagar el {formatDay(d.date, 'es')}</p>}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => openReminder(d)} title="Recordar por WhatsApp" aria-label={`Recordar por WhatsApp a ${fullName(d.student)}`} className="grid size-10 shrink-0 place-items-center rounded-lg border border-line text-ink hover:border-whatsapp hover:text-[#1faa53]">
          <MessageCircle size={18} />
        </button>
        {d.kind === 'dia' ? (
          <button type="button" onClick={() => openDayBilling(d.student.id)} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink text-sm font-semibold text-white hover:bg-royal">
            <ListChecks size={16} /> Cobrar días
          </button>
        ) : (
          <button type="button" onClick={() => onPay(d)} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink text-sm font-semibold text-white hover:bg-royal">
            <Wallet size={16} /> Marcar pago
          </button>
        )}
      </div>
    </li>
  )
}

export function Payments() {
  const dues = useDues()
  const students = useAdmin((s) => s.students)
  const payments = useAdmin((s) => s.payments)
  const [paying, setPaying] = useState<Due | null>(null)
  const [ask, setAsk] = useState<{ title: string; text: string; run: () => unknown } | null>(null)
  const today = todayYMD()
  const { y, m } = parseYMD(today)
  const monthKey = today.slice(0, 7)
  const monthLabel = new Intl.DateTimeFormat('es-CO', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m, 1)))
  const byId = (id: string): Student | undefined => students.find((s) => s.id === id)

  const owing = dues.filter((d) => d.status === 'vencido' || d.status === 'hoy' || (d.kind === 'dia' && d.amount > 0))
  const soon = dues.filter((d) => d.status === 'pronto')
  const thisMonth = payments.filter((p) => p.date.startsWith(monthKey))
  const charges = useAdmin((s) => s.charges)
  const owingIds = new Set(owing.map((d) => d.student.id))
  const recentCharges = [...charges].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30)
  const unpriced = dues.filter((d) => d.kind === 'mensual' && priceOf(d.student) <= 0).length

  // "Pagados": each student's latest payment in the last 31 days, if they no longer owe anything
  const since = addDays(today, -31)
  const latest = new Map<string, Payment>()
  for (const p of [...payments].sort((a, b) => a.date.localeCompare(b.date))) if (p.date >= since) latest.set(p.studentId, p)
  const paid = [...latest.values()].filter((p) => !owingIds.has(p.studentId) && byId(p.studentId)).sort((a, b) => b.date.localeCompare(a.date))
  const history = [...payments].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 40)

  return (
    <div className="space-y-6">
      <PageHead
        title="Pagos"
        sub="Pendientes, próximos y pagados. Solo tú ves esta información."
        actions={
          <button type="button" onClick={() => openCharge()} className="btn btn-gold !min-h-11">
            <Plus size={18} /> Cargo extra
          </button>
        }
      />

      {unpriced > 0 && (
        <a href="#/ajustes" className="block rounded-lg bg-[#fff4e0] px-4 py-3 text-sm font-medium text-[#8a5716]">
          {unpriced === 1 ? '1 estudiante tiene' : `${unpriced} estudiantes tienen`} un plan sin precio ($0) y no aparece en cobros. Pon los precios en Ajustes → Planes y precios.
        </a>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="!p-5">
          <p className="text-sm font-semibold text-muted">Pendiente por cobrar</p>
          <p className="mt-1 font-serif text-3xl font-semibold text-berry">{money(owing.reduce((n, d) => n + d.amount, 0))}</p>
          <p className="text-sm text-muted">{plural(owing.length, 'estudiante', 'estudiantes')}</p>
        </Card>
        <Card className="!p-5">
          <p className="text-sm font-semibold text-muted">Próximos 7 días</p>
          <p className="mt-1 font-serif text-3xl font-semibold text-[#8a5716]">{money(soon.reduce((n, d) => n + d.amount, 0))}</p>
          <p className="text-sm text-muted">{plural(soon.length, 'estudiante', 'estudiantes')}</p>
        </Card>
        <Card className="!p-5">
          <p className="text-sm font-semibold text-muted">Recibido en {monthLabel}</p>
          <p className="mt-1 font-serif text-3xl font-semibold text-leaf">{money(thisMonth.reduce((n, p) => n + p.amount, 0))}</p>
          <p className="text-sm text-muted">{plural(thisMonth.length, 'pago', 'pagos')}</p>
        </Card>
      </div>

      <section>
        <h2 className="text-xl">
          Pendientes <span className="text-muted">({owing.length})</span>
        </h2>
        {owing.length ? (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {owing.map((d) => (
              <DueCard key={`${d.student.id}-${d.kind}`} d={d} onPay={setPaying} />
            ))}
          </ul>
        ) : (
          <p className="card mt-3 p-5 text-muted">Nadie tiene pagos pendientes. 🎉</p>
        )}
      </section>

      <Card>
        <h2 className="text-lg">
          Próximos 7 días <span className="text-muted">({soon.length})</span>
        </h2>
        {soon.length ? (
          <ul className="divide-y divide-line">
            {soon.map((d) => (
              <DueRow key={`${d.student.id}-${d.kind}`} d={d} onPay={setPaying} />
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[15px] text-muted">No hay cobros en los próximos 7 días.</p>
        )}
      </Card>

      <Card>
        <h2 className="text-lg">
          Pagados <span className="text-sm font-normal text-muted">(últimos 30 días)</span>
        </h2>
        {paid.length ? (
          <ul className="mt-1 divide-y divide-line">
            {paid.map((p) => {
              const st = byId(p.studentId)!
              return (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <Avatar student={st} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{fullName(st)}</p>
                    <p className="text-sm text-muted">
                      {money(p.amount)} · {formatDay(p.date, 'es')}
                      {p.note && ` · ${p.note}`}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#e9f4ee] px-2.5 py-1 text-xs font-semibold text-leaf">
                    <Check size={13} strokeWidth={3} /> Pagado
                  </span>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-2 text-[15px] text-muted">Aún no hay pagos en los últimos 30 días.</p>
        )}
      </Card>

      <details className="card p-5 sm:p-6">
        <summary className="cursor-pointer font-serif text-lg font-semibold text-ink">Historial de pagos ({payments.length})</summary>
        {history.length ? (
          <ul className="mt-2 divide-y divide-line">
            {history.map((p) => {
              const st = byId(p.studentId)
              return (
                <li key={p.id} className="flex items-center gap-3 py-2.5 text-[15px]">
                  {st && <Avatar student={st} size={32} />}
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-ink">{st ? fullName(st) : 'Estudiante eliminado'}</span>
                    <span className="text-muted">
                      {' '}
                      · {formatDay(p.date, 'es')} · {p.kind === 'mensual' ? 'Mensualidad' : p.kind === 'extra' ? 'Extra' : p.days?.length ? `${p.days.length} día${p.days.length === 1 ? '' : 's'}` : 'Días'}
                      {p.note && ` · ${p.note}`}
                    </span>
                  </span>
                  <span className="font-semibold text-ink">{money(p.amount)}</span>
                  <button
                    type="button"
                    onClick={() => setAsk({ title: '¿Borrar este pago?', text: `${st ? fullName(st) : 'Estudiante'} · ${money(p.amount)} · ${formatDay(p.date, 'es')}. Úsalo solo si lo registraste por error: volverá a quedar pendiente.`, run: () => unpay(p.id) })}
                    aria-label="Borrar pago"
                    title="Borrar pago"
                    className="grid size-8 place-items-center rounded-md text-muted hover:bg-paper hover:text-berry"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-2 text-[15px] text-muted">Aún no has registrado pagos.</p>
        )}
      </details>

      <details className="card p-5 sm:p-6">
        <summary className="cursor-pointer font-serif text-lg font-semibold text-ink">Cargos extra ({charges.length})</summary>
        {recentCharges.length ? (
          <ul className="mt-2 divide-y divide-line">
            {recentCharges.map((c) => {
              const st = byId(c.studentId)
              return (
                <li key={c.id} className="flex items-center gap-3 py-2.5 text-[15px]">
                  {st && <Avatar student={st} size={32} />}
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium text-ink">{st ? fullName(st) : 'Estudiante eliminado'}</span>
                    <span className="text-muted">
                      {' '}
                      · {c.concept} · {formatDay(c.date, 'es')}
                    </span>
                  </span>
                  <span className="font-semibold text-ink">{money(c.amount)}</span>
                  <button
                    type="button"
                    onClick={() => setAsk({ title: '¿Borrar este cargo extra?', text: `${st ? fullName(st) : 'Estudiante'} · ${c.concept} · ${money(c.amount)}`, run: () => removeCharge(c.id) })}
                    aria-label="Borrar cargo"
                    title="Borrar cargo"
                    className="grid size-8 place-items-center rounded-md text-muted hover:bg-paper hover:text-berry"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-2 text-[15px] text-muted">Aún no hay cargos extra. Usa “Cargo extra” para cobrar algo puntual, como una mañana de cuidado.</p>
        )}
      </details>

      <PayModal due={paying} onClose={() => setPaying(null)} />
      <ConfirmModal open={Boolean(ask)} tone="danger" icon={<Trash2 size={26} />} title={ask?.title ?? ''} confirmLabel="Sí, borrar" onClose={() => setAsk(null)} onConfirm={async () => {
          await ask?.run()
        }}>
        {ask?.text}
      </ConfirmModal>
    </div>
  )
}
