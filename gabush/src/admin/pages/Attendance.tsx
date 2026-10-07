import { AnimatePresence, motion } from 'motion/react'
import { CalendarClock, CalendarX2, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, PartyPopper, RotateCcw, Trash2, UserPlus, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { addDays, formatDay, todayYMD } from '@/lib/dates'
import { dayStatus } from '@/lib/schedule'
import { useCalendar } from '@/lib/calendar'
import { cn } from '@/lib/utils'
import { useCan } from '@/lib/calendar'
import { ensureAttendance, fullName, mark, openCharge, planOf, priceOf, removeCharge, toast, useAdmin, type Charge, type Shift } from '../store'
import { daysSinceEntry, expectedOn, money, nextBirthday, tracksAttendance } from '../logic'
import { Avatar, ConfirmModal, PageHead, field } from '../ui'

const SHIFTS: { id: 'todas' | Shift; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'manana', label: 'Mañana' },
  { id: 'tarde', label: 'Tarde' },
]

export function Attendance() {
  const students = useAdmin((s) => s.students)
  const attendance = useAdmin((s) => s.attendance)
  const plans = useAdmin((s) => s.plans)
  const events = useCalendar((s) => s.events)
  const schedule = useCalendar((s) => s.schedule)
  const today = todayYMD()
  const [date, setDate] = useState(() => new URLSearchParams(location.hash.split('?')[1]).get('fecha') ?? today)
  const [shift, setShift] = useState<'todas' | Shift>('todas')
  const [bulkOpen, setBulkOpen] = useState(false)
  const [openLate, setOpenLate] = useState<string | null>(null)
  const [delExtra, setDelExtra] = useState<Charge | null>(null)
  const charges = useAdmin((s) => s.charges)
  const canPay = useCan('pagos')

  useEffect(() => {
    ensureAttendance(date)
  }, [date])

  const status = dayStatus(schedule, events, date)
  /** previous / next day the club opens (skips weekends and holidays) */
  const openDay = (from: string, dir: 1 | -1) => {
    let d = addDays(from, dir)
    for (let i = 0; i < 30 && !dayStatus(schedule, events, d).open; i++) d = addDays(d, dir)
    return d
  }
  const day = attendance[date] ?? {}
  // only students whose attendance is taken (switch in their profile; default: plan por día)
  const tracked = useMemo(() => students.filter((s) => tracksAttendance(s, plans)), [students, plans])
  const expected = useMemo(
    () => expectedOn(tracked, date).filter((s) => shift === 'todas' || plans.find((p) => p.id === s.planId)?.shift === shift),
    [tracked, date, shift, plans],
  )
  const pending = expected.filter((s) => !day[s.id])
  const monthlyPending = pending.filter((s) => plans.find((p) => p.id === s.planId)?.type === 'mensual')
  // every mark of the day is listed (and can be undone), also for students not expected that day
  const done = students.filter((s) => day[s.id])
  const came = done.filter((s) => day[s.id].s === 'a').length
  const missed = done.length - came

  // last open days — completed ones too, so a day can be reviewed and corrected
  const recent = useMemo(() => daysSinceEntry(tracked, attendance, (d) => dayStatus(schedule, events, d).open, today), [tracked, attendance, schedule, events, today])
  // grouped by month (newest first); the current month and months with pending days start open
  const months = useMemo(() => {
    const m = new Map<string, typeof recent>()
    for (const d of recent) m.set(d.date.slice(0, 7), [...(m.get(d.date.slice(0, 7)) ?? []), d])
    return [...m.entries()]
  }, [recent])
  const [monthsOpen, setMonthsOpen] = useState<Record<string, boolean>>({})
  const monthIsOpen = (k: string, days: typeof recent) => monthsOpen[k] ?? (k === today.slice(0, 7) || days.some((d) => d.pending > 0))
  const lateCount = recent.filter((d) => d.pending > 0).length

  return (
    <div className="space-y-6">
      <PageHead title="Asistencia" sub="Solo estudiantes con “Registrar asistencia” activado (por defecto, los de plan por día)." />

      {/* date bar */}
      <div className="card flex flex-wrap items-center gap-3 p-3 sm:p-4">
        <button type="button" onClick={() => setDate(openDay(date, -1))} aria-label="Día hábil anterior" className="grid size-11 place-items-center rounded-lg border border-line hover:border-ink">
          <ChevronLeft size={20} />
        </button>
        <div className="min-w-0 flex-1 text-center sm:text-left">
          <p className="font-serif text-xl font-semibold text-ink first-letter:uppercase sm:text-2xl">{date === today ? 'Hoy' : formatDay(date, 'es', true)}</p>
          {date === today && <p className="text-sm text-muted first-letter:uppercase">{formatDay(date, 'es', true)}</p>}
        </div>
        <button type="button" onClick={() => setDate(openDay(date, 1))} aria-label="Día hábil siguiente" className="grid size-11 place-items-center rounded-lg border border-line hover:border-ink">
          <ChevronRight size={20} />
        </button>
        <div className="flex w-full gap-2 sm:w-auto">
          <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Ir a una fecha" className={cn(field, '!min-h-11 flex-1 sm:w-44')} />
          {date !== today && (
            <button type="button" onClick={() => setDate(today)} className="h-11 rounded-lg bg-ink px-4 text-sm font-semibold text-white">
              Hoy
            </button>
          )}
        </div>
      </div>

      {!status.open && (
        <div className={cn('card flex items-start gap-4 p-5', status.reason === 'festivo' && 'border-red-200 bg-red-50')}>
          <CalendarX2 size={28} className={cn('mt-0.5 shrink-0', status.reason === 'festivo' ? 'text-red-600' : 'text-muted')} />
          <div>
            <p className="font-semibold text-ink first-letter:uppercase">
              {formatDay(date, 'es', true)}: {status.reason === 'festivo' ? `festivo${status.festivo ? ` (${status.festivo.title})` : ''}` : 'el jardín no abre'}.
            </p>
            <p className="mt-0.5 text-[15px] text-muted">No se toma asistencia este día.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => setDate(openDay(date, -1))} className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink hover:border-ink">
                ← Día hábil anterior
              </button>
              <button type="button" onClick={() => setDate(openDay(date, 1))} className="h-10 rounded-lg border border-line bg-white px-3 text-sm font-semibold text-ink hover:border-ink">
                Día hábil siguiente →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* one tap for every pending student on a monthly plan (per-day plans are marked one by one: each day costs money) */}
      {status.open && monthlyPending.length > 0 && (
        <button
          type="button"
          onClick={() => setBulkOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-leaf/50 bg-[#e9f4ee] px-4 py-3 text-[15px] font-semibold text-leaf"
        >
          <CheckCheck size={19} /> Todos los mensuales asistieron ({monthlyPending.length})
        </button>
      )}

      <ConfirmModal
        open={bulkOpen}
        tone="success"
        icon={<CheckCheck size={28} />}
        title={`¿Todos los mensuales asistieron?`}
        confirmLabel={`Sí, marcar ${monthlyPending.length}`}
        onClose={() => setBulkOpen(false)}
        onConfirm={async () => {
          const list = monthlyPending
          await Promise.all(list.map((s) => mark(date, s, 'a')))
          toast(`✓ ${list.length} estudiante${list.length === 1 ? '' : 's'} marcado${list.length === 1 ? '' : 's'} como "Asistió"`)
        }}
      >
        <p className="first-letter:uppercase">{formatDay(date, 'es', true)}</p>
        <ul className="mt-4 flex flex-wrap justify-center gap-3">
          {monthlyPending.slice(0, 12).map((s) => (
            <li key={s.id} className="flex w-16 flex-col items-center gap-1">
              <Avatar student={s} size={48} className="ring-2 ring-[#e9f4ee]" />
              <span className="w-full truncate text-xs font-medium text-ink">{s.firstName}</span>
            </li>
          ))}
          {monthlyPending.length > 12 && <li className="grid size-12 place-items-center rounded-full bg-paper text-sm font-semibold text-ink">+{monthlyPending.length - 12}</li>}
        </ul>
        <p className="mt-4 text-sm">Los de plan por día se marcan uno por uno.</p>
      </ConfirmModal>

      {/* counters + shift filter */}
      <div className={cn('flex flex-wrap items-center justify-between gap-3', !status.open && 'hidden')}>
        <div className="flex flex-wrap gap-2 text-sm font-semibold">
          <span className="rounded-full bg-paper px-3 py-1.5 text-ink">{expected.length} activos</span>
          <span className={cn('rounded-full px-3 py-1.5', pending.length ? 'bg-[#fff4e0] text-[#8a5716]' : 'bg-paper text-muted')}>{pending.length} pendientes</span>
          <span className="rounded-full bg-[#e9f4ee] px-3 py-1.5 text-leaf">{came} asistieron</span>
          <span className="rounded-full bg-[#fdf0ef] px-3 py-1.5 text-berry">{missed} faltaron</span>
        </div>
        <div role="group" aria-label="Jornada" className="flex rounded-lg border border-line p-1">
          {SHIFTS.map((s) => (
            <button key={s.id} type="button" aria-pressed={shift === s.id} onClick={() => setShift(s.id)} className={cn('rounded-md px-3 py-1.5 text-sm font-semibold', shift === s.id ? 'bg-ink text-white' : 'text-muted hover:text-ink')}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* pending cards (only on days the club opens) */}
      {!status.open ? null : !students.length ? (
        <div className="card flex flex-col items-center p-8 text-center">
          <UserPlus size={32} className="text-royal" />
          <p className="mt-3 font-semibold text-ink">Aún no tienes estudiantes.</p>
          <a href="#/estudiantes" className="btn btn-primary mt-4">
            Agregar estudiante
          </a>
        </div>
      ) : pending.length ? (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {pending.map((s) => (
              <motion.li
                key={s.id}
                layout
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, x: 80, transition: { duration: 0.22 } }}
                className="card flex items-center gap-4 p-4"
              >
                <Avatar student={s} size={64} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[17px] font-semibold text-ink">{fullName(s)}</p>
                  {s.birthDate && nextBirthday(s.birthDate, date).date === date && <p className="text-sm font-semibold text-[#8a5716]">🎂 ¡Cumple {nextBirthday(s.birthDate, date).turns} años hoy!</p>}
                  <p className="truncate text-sm text-muted">{planOf(s)?.name ?? 'Sin plan'}</p>
                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => mark(date, s, 'a')} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg bg-leaf text-[15px] font-semibold text-white active:scale-[0.97]">
                      <Check size={18} strokeWidth={2.6} /> Asistió
                    </button>
                    <button type="button" onClick={() => mark(date, s, 'f')} className="inline-flex h-11 items-center justify-center gap-1.5 rounded-lg border border-[#d6d8ec] text-[15px] font-semibold text-ink active:scale-[0.97]">
                      <X size={18} strokeWidth={2.6} /> No asistió
                    </button>
                  </div>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="card flex items-center gap-4 p-6">
          <PartyPopper size={30} className="shrink-0 text-gold" />
          <div>
            <p className="font-semibold text-ink">{expected.length ? '¡Asistencia completa!' : 'No hay estudiantes activos para esta fecha.'}</p>
            {expected.length > 0 && <p className="text-sm text-muted">Todos los estudiantes de este día quedaron marcados.</p>}
          </div>
        </div>
      )}

      {/* marked */}
      {done.length > 0 && (
        <section>
          <h2 className="text-lg">Marcados ({done.length})</h2>
          <ul className="mt-2 divide-y divide-line rounded-xl border border-line bg-white">
            {done.map((s) => {
              const ok = day[s.id].s === 'a'
              return (
                <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                  <Avatar student={s} size={36} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-ink">{fullName(s)}</span>
                    {charges
                      .filter((c) => c.studentId === s.id && c.date === date)
                      .map((c) => (
                        <span key={c.id} className="mt-1 mr-1 inline-flex items-center gap-1 rounded-full bg-[#f8f1e4] py-0.5 pr-1 pl-2 text-xs font-semibold text-[#8a5716]">
                          Extra: {c.concept} · {money(c.amount)}
                          <button type="button" onClick={() => setDelExtra(c)} aria-label={`Eliminar extra ${c.concept}`} title="Eliminar extra" className="grid size-5 place-items-center rounded-full hover:bg-[#8a5716] hover:text-white">
                            <X size={12} strokeWidth={3} />
                          </button>
                        </span>
                      ))}
                  </span>
                  <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', ok ? 'bg-[#e9f4ee] text-leaf' : 'bg-[#fdf0ef] text-berry')}>{ok ? 'Asistió' : 'No asistió'}</span>
                  {canPay && <button type="button" onClick={() => openCharge({ studentId: s.id, date })} title="Agregar un cobro extra de este día" className="rounded-md border border-line px-2 py-1 text-xs font-semibold text-ink hover:border-ink">
                    + Extra
                  </button>}
                  <button type="button" onClick={() => mark(date, s, ok ? 'f' : 'a')} className="hidden rounded-md border border-line px-2 py-1 text-xs font-medium text-ink hover:border-ink sm:inline-block">
                    Cambiar
                  </button>
                  <button type="button" onClick={() => mark(date, s, null)} aria-label={`Deshacer ${fullName(s)}`} title="Deshacer" className="grid size-9 place-items-center rounded-md text-muted hover:bg-paper hover:text-ink">
                    <RotateCcw size={16} />
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <ConfirmModal
        open={Boolean(delExtra)}
        tone="danger"
        icon={<Trash2 size={26} />}
        title="¿Eliminar este extra?"
        confirmLabel="Sí, eliminar"
        onClose={() => setDelExtra(null)}
        onConfirm={async () => {
          if (delExtra) await removeCharge(delExtra.id)
        }}
      >
        {delExtra && `${delExtra.concept} · ${money(delExtra.amount)}. Si se había registrado como pagado, ese pago también se elimina.`}
      </ConfirmModal>

      {/* forgotten days */}
      {recent.length > 0 && (
        <section className="card p-5">
          <h2 className="flex items-center gap-2 text-lg">
            <CalendarClock size={19} className="text-gold" /> Días desde el ingreso
            {lateCount > 0 && <span className="rounded-full bg-[#fff4e0] px-2 py-0.5 text-xs font-semibold text-[#8a5716]">{lateCount} con pendientes</span>}
          </h2>
          <p className="mt-1 text-sm text-muted">Todos los días hábiles desde la fecha de ingreso de cada estudiante. Toca un día para revisar o corregir; tocar de nuevo el botón activo lo desmarca.</p>
          {months.map(([k, days]) => {
            const open = monthIsOpen(k, days)
            const pend = days.filter((d) => d.pending > 0).length
            return (
          <div key={k} className="mt-4">
            <button type="button" onClick={() => setMonthsOpen((m) => ({ ...m, [k]: !open }))} aria-expanded={open} className="flex w-full items-center justify-between gap-2 border-b border-line pb-1.5 text-left">
              <span className="font-serif text-base font-semibold text-ink first-letter:uppercase">{new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${k}-01T00:00:00Z`))}</span>
              <span className="flex items-center gap-2 text-xs font-semibold">
                {pend > 0 ? <span className="text-[#8a5716]">{pend} día{pend === 1 ? '' : 's'} con pendientes</span> : <span className="text-leaf">✓ {days.length} días completos</span>}
                <ChevronDown size={16} className={cn('text-muted transition-transform', open && 'rotate-180')} />
              </span>
            </button>
          {open && (
          <div className="mt-2 space-y-2">
            {days.map((d) => {
              const isOpen = openLate === d.date
              const list = expectedOn(tracked, d.date).filter((s) => (s.periods?.[s.periods.length - 1]?.start ?? s.startDate) <= d.date)
              const marks = attendance[d.date] ?? {}
              return (
                <div key={d.date} className={cn('overflow-hidden rounded-xl border', isOpen ? 'border-ink' : 'border-line')}>
                  <button type="button" onClick={() => setOpenLate(isOpen ? null : d.date)} aria-expanded={isOpen} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-paper">
                    <span>
                      <span className="block font-semibold text-ink first-letter:uppercase">{formatDay(d.date, 'es', true)}</span>
                      {d.pending > 0 ? (
                        <span className="text-sm text-[#8a5716]">
                          {d.pending} pendiente{d.pending === 1 ? '' : 's'} de {d.total}
                        </span>
                      ) : (
                        <span className="text-sm font-medium text-leaf">✓ Completa · {d.total} marcados</span>
                      )}
                    </span>
                    <ChevronDown size={18} className={cn('shrink-0 text-muted transition-transform', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <ul className="divide-y divide-line border-t border-line">
                      {list.map((s) => {
                        const m = marks[s.id]?.s
                        const isDay = planOf(s)?.type === 'dia'
                        return (
                          <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                            <Avatar student={s} size={36} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium text-ink">{fullName(s)}</span>
                              <span className="block text-xs text-muted">{isDay ? `Por día · ${money(priceOf(s))}` : 'Mensual'}</span>
                            </span>
                            <div className="flex shrink-0 gap-1.5">
                              <button
                                type="button"
                                aria-pressed={m === 'a'}
                                aria-label={`${fullName(s)}: asistió`}
                                onClick={() => mark(d.date, s, m === 'a' ? null : 'a')}
                                className={cn('grid size-10 place-items-center rounded-lg border text-sm font-semibold', m === 'a' ? 'border-leaf bg-leaf text-white' : 'border-line text-muted hover:border-leaf hover:text-leaf')}
                              >
                                <Check size={18} strokeWidth={2.6} />
                              </button>
                              <button
                                type="button"
                                aria-pressed={m === 'f'}
                                aria-label={`${fullName(s)}: no asistió`}
                                onClick={() => mark(d.date, s, m === 'f' ? null : 'f')}
                                className={cn('grid size-10 place-items-center rounded-lg border text-sm font-semibold', m === 'f' ? 'border-berry bg-berry text-white' : 'border-line text-muted hover:border-berry hover:text-berry')}
                              >
                                <X size={18} strokeWidth={2.6} />
                              </button>
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </div>
          )}
          </div>
            )
          })}
        </section>
      )}
    </div>
  )
}
