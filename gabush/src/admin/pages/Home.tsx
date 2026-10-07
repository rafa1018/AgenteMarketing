import { ArrowRight, Bell, CalendarDays, ClipboardCheck, Users, Wallet } from 'lucide-react'
import { useMemo, useState } from 'react'
import { addDays, formatDay, formatRange, todayYMD } from '@/lib/dates'
import { dayStatus } from '@/lib/schedule'
import { useCalendar } from '@/lib/calendar'
import { cn } from '@/lib/utils'
import { fullName, useAdmin } from '../store'
import { daysSinceEntry, expectedOn, money, tracksAttendance, upcomingBirthdays } from '../logic'
import { Avatar, Card } from '../ui'
import { DueRow, PayModal, useDues } from './Billing'
import type { Due } from '../logic'

function Tile({ href, icon: Icon, label, value, note, tone = 'text-ink', highlight = false }: { href: string; icon: typeof Users; label: string; value: string | number; note?: string; tone?: string; highlight?: boolean }) {
  return (
    <a href={href} className={cn('card group flex min-w-0 flex-col p-4 transition-shadow sm:p-5 hover:shadow-[0_16px_36px_-24px_rgba(35,32,107,0.5)]', highlight && 'ring-2 ring-gold')}>
      <span className="flex items-center justify-between gap-1 text-[13px] font-semibold text-muted sm:text-sm">
        <span className="flex items-center gap-2">
          <Icon size={17} className="text-royal" /> {label}
        </span>
        <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" />
      </span>
      <span className={cn('mt-2 font-serif text-[1.6rem] leading-none font-semibold sm:text-[2.2rem]', tone)}>{value}</span>
      {note && <span className="mt-1.5 text-[13px] leading-snug text-muted sm:text-sm">{note}</span>}
    </a>
  )
}

export function Home() {
  const students = useAdmin((s) => s.students)
  const attendance = useAdmin((s) => s.attendance)
  const plans = useAdmin((s) => s.plans)
  const inscriptions = useAdmin((s) => s.inscriptions)
  const events = useCalendar((s) => s.events)
  const schedule = useCalendar((s) => s.schedule)
  const name = useCalendar((s) => s.name)
  const dues = useDues()
  const [paying, setPaying] = useState<Due | null>(null)
  const today = todayYMD()

  const tracked = students.filter((s) => tracksAttendance(s, plans))
  const expected = expectedOn(tracked, today)
  const pendingToday = expected.filter((s) => !attendance[today]?.[s.id]).length
  const open = dayStatus(schedule, events, today)
  const birthdays = upcomingBirthdays(students, today, 7)
  // every open day since the students' entry date that still has unmarked students
  const late = useMemo(() => daysSinceEntry(tracked, attendance, (d) => dayStatus(schedule, events, d).open, today).filter((d) => d.pending > 0), [tracked, attendance, schedule, events, today])
  const newIns = inscriptions.filter((i) => i.status === 'pendiente')
  const owing = dues.filter((d) => d.status === 'vencido' || d.status === 'hoy' || (d.kind === 'dia' && d.amount > 0))
  // most urgent first; "por día" students only when they owe something
  const nextDues = dues.filter((d) => d.amount > 0).slice(0, 5)
  const monthEnd = `${today.slice(0, 7)}-31`
  const nextEvents = events.filter((e) => e.end >= today && e.start <= monthEnd).slice(0, 4)
  const hour = new Date().getHours()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[1.9rem] sm:text-[2.3rem]">
          {hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'}
          {name ? `, ${name.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-1 text-[15px] text-muted first-letter:uppercase">
          {formatDay(today, 'es', true)} · {open.open ? 'el jardín abre hoy' : open.reason === 'festivo' ? 'festivo, el jardín no abre' : 'hoy el jardín no abre'}
        </p>
      </div>

      {newIns.length > 0 && (
        <a href="#/inscripciones" className="flex items-center gap-3 rounded-xl border border-gold/50 bg-[#fff8ea] p-4 text-ink">
          <span className="relative grid size-10 shrink-0 place-items-center rounded-full bg-gold text-white">
            <Bell size={19} />
            <span className="absolute -top-1 -right-1 grid size-5 place-items-center rounded-full bg-berry text-[11px] font-bold text-white">{newIns.length}</span>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {newIns.length === 1 ? '1 inscripción nueva' : `${newIns.length} inscripciones nuevas`} por atender
            </span>
            <span className="block truncate text-sm text-muted">{newIns.slice(0, 3).map((i) => i.child).join(', ')}</span>
          </span>
          <ArrowRight size={18} />
        </a>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {open.open ? (
          <Tile href="#/asistencia" icon={ClipboardCheck} label="Asistencia de hoy" value={expected.length ? `${expected.length - pendingToday}/${expected.length}` : '—'} note={pendingToday ? `${pendingToday} pendientes por marcar` : expected.length ? 'Completa' : 'Sin estudiantes activos'} tone={pendingToday ? 'text-[#8a5716]' : 'text-leaf'} highlight={pendingToday > 0} />
        ) : (
          <Tile href="#/asistencia" icon={ClipboardCheck} label="Asistencia de hoy" value="—" note={open.reason === 'festivo' ? 'Festivo: hoy no abre' : 'Hoy no abre'} tone="text-muted" />
        )}
        <Tile href="#/estudiantes" icon={Users} label="Estudiantes activos" value={students.filter((s) => s.active).length} note={`${students.length} registrados`} />
        <Tile href="#/pagos" icon={Wallet} label="Pagos pendientes" value={money(owing.reduce((n, d) => n + d.amount, 0))} note={`${owing.length} estudiantes`} tone={owing.length ? 'text-berry' : 'text-leaf'} />
        <Tile href="#/inscripciones" icon={Bell} label="Inscripciones" value={newIns.length} note={`${inscriptions.length} en el histórico`} tone={newIns.length ? 'text-[#8a5716]' : 'text-ink'} />
      </div>

      {birthdays.length > 0 && (
        <Card>
          <h2 className="text-lg">🎂 Cumpleaños</h2>
          <ul className="mt-2 divide-y divide-line">
            {birthdays.map((b) => (
              <li key={b.student.id} className="flex items-center gap-3 py-2.5">
                <Avatar student={b.student} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">{fullName(b.student)}</span>
                  <span className="block text-sm text-muted">Cumple {b.turns} años</span>
                </span>
                <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap', b.date === today ? 'bg-gold text-white' : 'bg-paper text-ink')}>
                  {b.date === today ? '¡Hoy!' : b.date === addDays(today, 1) ? 'Mañana' : formatDay(b.date, 'es', true)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {late.length > 0 && (
        <Card>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg">
              Días con asistencia pendiente <span className="text-muted">({late.length})</span>
            </h2>
            <a href="#/asistencia" className="text-sm font-semibold text-royal">
              Ver todos
            </a>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {late.slice(0, 8).map((d) => (
              <a key={d.date} href={`#/asistencia?fecha=${d.date}`} className="rounded-lg border border-line px-3 py-2 text-sm hover:border-ink">
                <span className="block font-semibold first-letter:uppercase">{formatDay(d.date, 'es', true)}</span>
                <span className="text-[#8a5716]">{d.pending} pendientes</span>
              </a>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-lg">
              Próximos cobros <span className="text-sm font-normal text-muted">(privado)</span>
            </h2>
            <a href="#/pagos" className="text-sm font-semibold text-royal">
              Ver todos
            </a>
          </div>
          {nextDues.length ? (
            <ul className="divide-y divide-line">
              {nextDues.map((d) => (
                <DueRow key={`${d.student.id}-${d.kind}`} d={d} onPay={setPaying} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[15px] text-muted">No hay cobros pendientes.</p>
          )}
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-lg">Eventos de este mes</h2>
            <a href="#/calendario" className="text-sm font-semibold text-royal">
              Calendario
            </a>
          </div>
          {nextEvents.length ? (
            <ul className="mt-2 space-y-3">
              {nextEvents.map((e) => (
                <li key={e.id} className="flex items-start gap-3">
                  <span className="mt-1.5 size-3 shrink-0 rounded-full" style={{ background: e.color }} />
                  <span>
                    <span className="block font-medium text-ink">
                      {e.title}{' '}
                      <span className={cn('ml-1 rounded px-1.5 py-0.5 align-middle text-[11px] font-semibold uppercase', e.visibility === 'privado' ? 'bg-ink text-white' : 'bg-[#eeedfb] text-royal')}>
                        {e.visibility === 'privado' ? '🔒 Privado' : 'Público'}
                      </span>
                    </span>
                    <span className="block text-sm text-muted first-letter:uppercase">{formatRange(e.start, e.end, 'es')}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 flex items-center gap-2 text-[15px] text-muted">
              <CalendarDays size={16} /> No hay más eventos este mes.
            </p>
          )}
        </Card>
      </div>
      <PayModal due={paying} onClose={() => setPaying(null)} />
    </div>
  )
}
