import { ArrowRight, FileDown, Mail, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { ago, api, flag, place, setUnread, useSession, type Message, type Stats } from '../api'
import { Card, CardTitle, Empty, PageHead, Stat } from '../ui'

/** Hola + time of day in Colombia. */
const greeting = () => {
  const h = Number(new Intl.DateTimeFormat('es-CO', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Bogota' }).format(new Date()))
  return h < 12 ? 'Hola, buenos días' : h < 19 ? 'Hola, buenas tardes' : 'Hola, buenas noches'
}

export function HomePage({ tick }: { tick: number }) {
  const session = useSession()
  const firstName = session.status === 'in' ? session.name.split(' ')[0] : ''
  const [stats, setStats] = useState<Stats | null>(null)
  const [messages, setMessages] = useState<Message[]>([])

  useEffect(() => {
    api.get<Stats>('stats.php').then(({ data }) => data?.ok && setStats(data))
    api.get<{ messages: Message[]; unread: number }>('messages.php').then(({ data }) => {
      if (!data?.ok) return
      setMessages(data.messages)
      setUnread(data.unread)
    })
  }, [tick])

  const today = stats ? stats.visitLog.filter((v) => new Date(v.t * 1000).toDateString() === new Date().toDateString()).length : null
  const unread = messages.filter((m) => !m.read).length

  // top places of the last 30 days
  const since = Date.now() / 1000 - 30 * 86400
  const top = stats
    ? Object.entries(
        stats.visitLog
          .filter((v) => v.t > since)
          .reduce<Record<string, { n: number; cc: string }>>((acc, v) => {
            const k = v.country || 'Desconocido'
            acc[k] = { n: (acc[k]?.n ?? 0) + 1, cc: v.cc }
            return acc
          }, {}),
      )
        .sort((a, b) => b[1].n - a[1].n)
        .slice(0, 5)
    : []
  const topMax = top[0]?.[1].n ?? 1

  return (
    <>
      <p className="mb-1 text-[15px] text-muted">
        {greeting()}, <span className="font-medium text-fg">{firstName}</span> 👋
      </p>
      <PageHead title="Resumen" sub="Lo que está pasando en rafaelpedraza.dev" />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Visitas (contador)" value={stats?.visits.count ?? '—'} hint="Una por IP, sin contarte a ti" tone="text-cyan" />
        <Stat label="Visitas hoy" value={today ?? '—'} hint="Incluye visitantes que regresan" />
        <Stat label="Descargas del CV" value={stats?.downloads.count ?? '—'} hint="Desde que se activó el conteo" />
        <Stat label="Mensajes sin leer" value={unread} hint={`${messages.length} en total`} tone={unread ? 'text-volt' : 'text-fg'} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle icon={Mail}>Últimos mensajes</CardTitle>
          {messages.length === 0 ? (
            <Empty>Aún no hay mensajes del formulario.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {messages.slice(0, 4).map((m) => (
                <li key={m.id}>
                  <a href="#/mensajes" className="flex items-start gap-3 py-3">
                    <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', m.read ? 'bg-transparent' : 'bg-volt')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={cn('truncate', m.read ? 'text-muted' : 'font-semibold text-fg')}>{m.name}</span>
                        <span className="shrink-0 text-xs text-dim">{ago(m.t)}</span>
                      </span>
                      <span className="block truncate text-sm text-muted">{m.subject}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <a href="#/mensajes" className="mt-3 inline-flex items-center gap-1 text-sm text-cyan">
            Ver todos <ArrowRight size={14} />
          </a>
        </Card>

        <Card>
          <CardTitle icon={MapPin}>Últimas visitas</CardTitle>
          {!stats || stats.visitLog.length === 0 ? (
            <Empty>Las visitas aparecerán aquí con su ubicación.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {stats.visitLog.slice(0, 5).map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-3">
                  <span className="text-xl leading-none">{flag(v.cc)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">{place(v)}</span>
                    <span className="block truncate text-xs text-dim">{v.device}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs text-dim">
                    {ago(v.t)}
                    {v.new && <span className="mt-0.5 block text-ok">nueva</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <a href="#/visitas" className="mt-3 inline-flex items-center gap-1 text-sm text-cyan">
            Ver historial <ArrowRight size={14} />
          </a>
        </Card>

        <Card>
          <CardTitle sub="Últimos 30 días">Desde dónde te visitan</CardTitle>
          {top.length === 0 ? (
            <Empty>Sin datos todavía.</Empty>
          ) : (
            <ul className="space-y-3">
              {top.map(([country, { n, cc }]) => (
                <li key={country}>
                  <div className="flex justify-between text-sm">
                    <span>
                      {flag(cc)} {country}
                    </span>
                    <span className="tabular-nums text-muted">{n}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-steel">
                    <div className="h-full rounded-full bg-gradient-to-r from-volt to-cyan" style={{ width: `${(n / topMax) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle icon={FileDown}>Descargas recientes del CV</CardTitle>
          {!stats || stats.downloads.log.length === 0 ? (
            <Empty>Nadie ha descargado tu hoja de vida todavía.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {stats.downloads.log.slice(0, 5).map((d) => (
                <li key={d.id} className="flex items-center gap-3 py-3">
                  <span className="text-xl leading-none">{flag(d.cc)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-fg">{place(d)}</span>
                    <span className="block truncate text-xs text-dim">{d.device}</span>
                  </span>
                  <span className="shrink-0 text-xs text-dim">{ago(d.t)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  )
}
