import { Bell, CalendarDays, ChevronRight, FileText, Mail, Wallet } from 'lucide-react'
import type { Charge, Summary } from '../../admin/features/billing/types'
import { date, money } from '@/shared/format'
import { useQuery } from '@/shared/useQuery'
import { api, useSession } from '../session'
import { Card, Chip, Loading, Problem } from '../ui'
import { PushCard } from './AccountPage'
import type { Notification } from './NotificationsPage'
import type { PublicEvent } from './CalendarPage'

interface Home {
  balance: Summary
  nextDue: Charge | null
  unreadMessages: number
  unreadNotifications: number
  notifications: Notification[]
  attendance: { presente: number; ausente: number; justificada: number; tarde: number }
  events: PublicEvent[]
  documentsPending: number
}

/** Days since this year's birthday (0 = today); 29 Feb counts on 28 Feb in other years. null = not this week. */
function birthdayDaysAgo(birthDate: string | null): { daysAgo: number; age: number } | null {
  if (!birthDate) return null
  const [by, bm, bd] = birthDate.slice(0, 10).split('-').map(Number)
  if (!by || !bm || !bd) return null
  const now = new Date()
  const y = now.getFullYear()
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  const day = bm === 2 && bd === 29 && !leap ? 28 : bd
  const today = new Date(y, now.getMonth(), now.getDate())
  const daysAgo = Math.round((today.getTime() - new Date(y, bm - 1, day).getTime()) / 86_400_000)
  // the birthday card stays the day itself and the next 2 days (for a weekend birthday)
  return daysAgo >= 0 && daysAgo <= 2 && y - by >= 1 ? { daysAgo, age: y - by } : null
}

/** Happy-birthday card with the jumping lion and confetti, on the child's birthday (and the next 2 days). */
function BirthdayCard({ firstName, birthDate }: { firstName: string; birthDate: string | null }) {
  const b = birthdayDaysAgo(birthDate)
  if (!b) return null
  const name = firstName.trim().split(/\s+/)[0]
  const colors = ['#e5197e', '#f8c21c', '#1fa3dd', '#5cb531', '#f26b1d', '#8e44c9']
  return (
    <div className="relative overflow-hidden rounded-[22px] bg-[linear-gradient(135deg,#fff0f7_0%,#fff8e1_55%,#e6f6ff_100%)] p-5 shadow-[0_14px_34px_-22px_rgba(229,25,126,0.7)] ring-2 ring-pink/30">
      {/* confetti */}
      <span aria-hidden className="pointer-events-none absolute inset-0">
        {Array.from({ length: 18 }, (_, i) => (
          <i key={i} className="absolute block animate-float rounded-sm" style={{ left: `${(i * 53) % 100}%`, top: `${(i * 37) % 90}%`, width: 6 + (i % 3) * 2, height: 10 + (i % 2) * 4, background: colors[i % colors.length], transform: `rotate(${i * 29}deg)`, opacity: 0.75, animationDelay: `${-i * 0.4}s` }} />
        ))}
      </span>
      <div className="relative flex items-center gap-4">
        <img src="/images/characters/leon-saltando-240.webp" alt="" width={240} height={240} className="h-28 w-auto shrink-0 drop-shadow-[0_10px_14px_rgba(35,32,107,0.25)]" />
        <div>
          <p className="text-[12px] font-extrabold tracking-[0.14em] text-pink uppercase">{b.daysAgo === 0 ? 'Hoy es un día especial' : 'Seguimos celebrando'}</p>
          <p className="font-serif text-[1.55rem] leading-tight font-semibold text-ink">¡Feliz cumpleaños, {name}! 🎂</p>
          <p className="mt-1 text-[15px] text-text">
            {b.daysAgo === 0 ? 'Hoy cumple' : 'Cumplió'} <b>{b.age} {b.age === 1 ? 'año' : 'años'}</b>. Toda la familia Gabush le desea un año lleno de juegos, abrazos y alegría. 🎉
          </p>
        </div>
      </div>
    </div>
  )
}

export function HomePage() {
  const { me } = useSession()
  const q = useQuery('home', () => api.get<Home>('/portal/home'))
  if (q.loading && !q.data) return <Loading />
  if (q.error) return <Problem message={q.error.message} onRetry={q.reload} />
  const h = q.data!
  const a = h.attendance
  const days = a.presente + a.ausente + a.justificada + a.tarde
  return (
    <div className="space-y-4">
      <h1 className="text-[1.7rem] leading-tight">¡Hola, familia de {me?.student.firstName}! 👋</h1>

      {me && <BirthdayCard firstName={me.student.firstName} birthDate={me.student.birthDate} />}

      <a href="#/pagos" className="card block p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-muted uppercase">
              <Wallet size={16} className="text-royal" /> Pagos
            </p>
            {h.balance.balance > 0 ? (
              <>
                <p className="mt-1 font-serif text-[2rem] leading-none font-semibold text-ink">{money(h.balance.balance)}</p>
                <p className="mt-1 text-sm text-muted">pendiente por pagar</p>
              </>
            ) : (
              <p className="mt-2 text-lg font-semibold text-leaf">¡Estás al día! 🎉</p>
            )}
          </div>
          {h.balance.overdue > 0 && <Chip tone="red">Vencido {money(h.balance.overdue)}</Chip>}
        </div>
        {h.nextDue && (
          <p className="mt-3 rounded-xl bg-paper px-3 py-2 text-sm">
            Próximo: <b>{h.nextDue.description}</b> · {money(h.nextDue.balance)} {h.nextDue.dueOn && <>· vence {date(h.nextDue.dueOn, false)}</>}
          </p>
        )}
        {h.balance.balance > 0 && me?.onlinePayments && <span className="btn btn-primary mt-4 w-full">Pagar en línea</span>}
      </a>

      <div className="grid grid-cols-2 gap-3">
        <Shortcut href="#/mensajes" icon={Mail} label="Mensajes" count={h.unreadMessages} note="sin leer" />
        <Shortcut href="#/novedades" icon={Bell} label="Novedades" count={h.unreadNotifications} note="nuevas" />
      </div>

      {h.documentsPending > 0 && (
        <a href="#/documentos" className="card flex items-center gap-3 border-l-4 border-l-[#e2a33b] p-4">
          <FileText className="shrink-0 text-[#8a5716]" />
          <span className="flex-1 text-[15px]">
            Faltan <b>{h.documentsPending}</b> {h.documentsPending === 1 ? 'documento' : 'documentos'} de matrícula. Puedes subirlos desde aquí.
          </span>
          <ChevronRight size={18} className="text-muted" />
        </a>
      )}

      <PushCard compact />

      <a href="#/asistencia" className="card block p-4">
        <p className="mb-3 text-[13px] font-bold tracking-wide text-muted uppercase">Asistencia {me?.year}</p>
        {days ? (
          <div className="grid grid-cols-3 gap-2 text-center">
            <Count n={a.presente + a.tarde} label="Asistió" tone="text-leaf" />
            <Count n={a.justificada} label="Justificadas" tone="text-[#185a8a]" />
            <Count n={a.ausente} label="Faltas" tone="text-berry" />
          </div>
        ) : (
          <p className="text-sm text-muted">Aún no hay registros de asistencia este año.</p>
        )}
      </a>

      {h.events.length > 0 && (
        <Card>
          <p className="mb-2 flex items-center gap-2 text-[13px] font-bold tracking-wide text-muted uppercase">
            <CalendarDays size={16} className="text-royal" /> Próximos eventos
          </p>
          <ul className="divide-y divide-line">
            {h.events.map((e, i) => (
              <li key={i} className="flex gap-3 py-2.5">
                <span className="w-14 shrink-0 text-center font-serif text-sm font-semibold text-royal">{date(e.start, false)}</span>
                <span className="text-[15px] text-ink">{e.title}</span>
              </li>
            ))}
          </ul>
          <a href="#/calendario" className="mt-1 block text-sm font-semibold text-royal">
            Ver calendario →
          </a>
        </Card>
      )}

      {h.notifications.length > 0 && (
        <Card>
          <p className="mb-2 text-[13px] font-bold tracking-wide text-muted uppercase">Últimas novedades</p>
          <ul className="divide-y divide-line">
            {h.notifications.slice(0, 4).map((n) => (
              <li key={n.id} className="py-2.5">
                <p className="font-semibold text-ink">
                  {!n.readAt && <span className="mr-1.5 inline-block size-2 rounded-full bg-pink align-middle" />}
                  {n.title}
                </p>
                <p className="text-sm text-muted">{n.body}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function Shortcut({ href, icon: Icon, label, count, note }: { href: string; icon: typeof Mail; label: string; count: number; note: string }) {
  return (
    <a href={href} className="card flex flex-col gap-1 p-4">
      <Icon size={22} className="text-royal" />
      <span className="font-semibold text-ink">{label}</span>
      <span className="text-sm text-muted">{count ? <b className="text-pink">{count} {note}</b> : 'Todo leído'}</span>
    </a>
  )
}

const Count = ({ n, label, tone }: { n: number; label: string; tone: string }) => (
  <div className="rounded-xl bg-paper py-2">
    <p className={`font-serif text-2xl font-semibold ${tone}`}>{n}</p>
    <p className="text-[12px] font-semibold text-muted">{label}</p>
  </div>
)
