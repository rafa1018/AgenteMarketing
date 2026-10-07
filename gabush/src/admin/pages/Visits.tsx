import { Globe2, Laptop, Loader2, MapPin, Search, Smartphone, Tablet } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { api } from '../store'
import { Card, PageHead, field } from '../ui'

/* Who visits the public site and from where (approximate location from the IP). */

interface Visit {
  id: string
  t: number
  ip: string
  new: boolean
  country: string
  cc: string
  region: string
  city: string
  isp: string
  device: string
  kind: 'mobile' | 'tablet' | 'desktop'
  ref: string
  lang: string
  tz: string
  screen: string
}
type Range = 'hoy' | '7' | '30' | 'todo'

const PAGE = 40
const DAY = 86400

/** 🇨🇴-style flag from an ISO country code. */
const flag = (cc?: string) => (cc && /^[A-Z]{2}$/i.test(cc) ? String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌐')
const place = (v: Pick<Visit, 'city' | 'region' | 'country'>) => [v.city, v.region, v.country].filter(Boolean).join(', ') || 'Ubicación desconocida'
const refName = (ref: string) => {
  try {
    const h = new URL(ref).hostname.replace(/^(www|m|l|lm)\./, '')
    if (/facebook|fb\./.test(h)) return 'Facebook'
    if (/instagram/.test(h)) return 'Instagram'
    if (/google/.test(h)) return 'Google'
    if (/whatsapp|wa\.me/.test(h)) return 'WhatsApp'
    if (/tiktok/.test(h)) return 'TikTok'
    return h
  } catch {
    return ''
  }
}
const when = (t: number) => new Date(t * 1000).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const KindIcon = ({ kind }: { kind: string }) => {
  const I = kind === 'mobile' ? Smartphone : kind === 'tablet' ? Tablet : Laptop
  return <I size={14} className="shrink-0" />
}

function Stat({ label, value, hint, color }: { label: string; value: string | number; hint?: string; color: string }) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-xs font-bold tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-1 font-serif text-3xl font-semibold tabular-nums" style={{ color }}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  )
}

/** Top N values with a bar. */
function Top({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]))
  return (
    <Card>
      <h2 className="text-lg">{title}</h2>
      {!rows.length ? (
        <p className="mt-2 text-sm text-muted">Sin datos todavía.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {rows.map(([name, n]) => (
            <li key={name}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-semibold text-ink">{name}</span>
                <span className="shrink-0 font-bold text-muted tabular-nums">{n}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-paper">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,#1fa3dd,#5cb531)]" style={{ width: `${(n / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function top(list: Visit[], key: (v: Visit) => string, n = 6): [string, number][] {
  const m = new Map<string, number>()
  for (const v of list) {
    const k = key(v)
    if (k) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)
}

export function VisitsPage() {
  const [data, setData] = useState<{ count: number; log: Visit[] } | null>(null)
  const [range, setRange] = useState<Range>('30')
  const [q, setQ] = useState('')
  const [shown, setShown] = useState(PAGE)

  useEffect(() => {
    api.get('stats.php').then(({ data }) => setData(data?.ok ? { count: data.count, log: data.log } : { count: 0, log: [] }))
  }, [])
  useEffect(() => setShown(PAGE), [range, q])

  const inRange = useMemo(() => {
    if (!data) return []
    const now = Date.now() / 1000
    const start = range === 'hoy' ? new Date().setHours(0, 0, 0, 0) / 1000 : range === 'todo' ? 0 : now - Number(range) * DAY
    return data.log.filter((v) => v.t >= start)
  }, [data, range])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return !s ? inRange : inRange.filter((v) => [v.ip, v.city, v.region, v.country, v.device, v.isp, v.ref].some((x) => x?.toLowerCase().includes(s)))
  }, [inRange, q])

  const people = new Set(inRange.map((v) => v.ip)).size
  const mobile = inRange.filter((v) => v.kind !== 'desktop').length
  const local = inRange.filter((v) => /valledupar/i.test(v.city)).length

  return (
    <div>
      <PageHead title="Visitas" sub="Quién entra a la página y desde dónde. La ubicación es aproximada (según la IP: ciudad o región del proveedor de internet)." />

      <div className="mt-5 flex flex-wrap gap-2">
        {(
          [
            ['hoy', 'Hoy'],
            ['7', '7 días'],
            ['30', '30 días'],
            ['todo', 'Todo'],
          ] as const
        ).map(([id, text]) => (
          <button key={id} type="button" onClick={() => setRange(id)} className={cn('rounded-full border-2 px-4 py-1.5 text-sm font-semibold', range === id ? 'border-ink bg-ink text-white' : 'border-line bg-white text-muted')}>
            {text}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Contador público" value={data?.count ?? '—'} hint="Lo que ve la gente en el pie de página" color="#e5197e" />
        <Stat label="Visitas" value={data ? inRange.length : '—'} hint={`${people} personas (IP distintas)`} color="#23206b" />
        <Stat label="Desde Valledupar" value={data && inRange.length ? `${Math.round((local / inRange.length) * 100)}%` : '—'} hint={`${local} visitas`} color="#1588c2" />
        <Stat label="Desde el celular" value={data && inRange.length ? `${Math.round((mobile / inRange.length) * 100)}%` : '—'} color="#2f7d14" />
      </div>

      {data && (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Top title="Ciudades" rows={top(inRange, (v) => (v.city ? `${flag(v.cc)} ${v.city}` : ''))} />
          <Top title="Países" rows={top(inRange, (v) => (v.country ? `${flag(v.cc)} ${v.country}` : ''))} />
          <Top title="Llegan desde" rows={top(inRange, (v) => (v.ref ? refName(v.ref) : 'Directo / WhatsApp'))} />
        </div>
      )}

      <label className="relative mt-6 block sm:w-80">
        <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
        <input className={cn(field, 'pl-9')} placeholder="Buscar ciudad, país, IP, proveedor…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      <Card className="mt-3 !p-0">
        {!data ? (
          <p className="flex items-center gap-2 p-6 text-muted">
            <Loader2 size={18} className="animate-spin" /> Cargando…
          </p>
        ) : !list.length ? (
          <p className="p-6 text-muted">{q ? 'Nada coincide con la búsqueda.' : 'Todavía no hay visitas en este periodo.'}</p>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {list.slice(0, shown).map((v) => (
                <li key={v.id} className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
                  <span className="mt-0.5 text-2xl leading-none">{flag(v.cc)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-baseline gap-x-2 font-semibold text-ink">
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={14} className="text-pink" /> {place(v)}
                      </span>
                      {v.new ? <span className="rounded-full bg-[#ebf7e4] px-2 py-0.5 text-[11px] font-bold text-leaf">nueva</span> : <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-bold text-muted">regresó</span>}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                      <span className="inline-flex items-center gap-1.5">
                        <KindIcon kind={v.kind} /> {v.device}
                      </span>
                      <span className="font-mono">{v.ip}</span>
                      {v.isp && <span className="truncate">{v.isp}</span>}
                      {v.ref && (
                        <span className="inline-flex items-center gap-1 font-semibold text-royal">
                          <Globe2 size={12} /> vía {refName(v.ref)}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className="shrink-0 text-right text-xs text-muted first-letter:uppercase">{when(v.t)}</span>
                </li>
              ))}
            </ul>
            {list.length > shown && (
              <button type="button" onClick={() => setShown((n) => n + PAGE)} className="w-full border-t border-line py-3 text-sm font-semibold text-royal">
                Ver más ({list.length - shown} restantes)
              </button>
            )}
          </>
        )}
      </Card>
      <p className="mt-4 text-xs leading-relaxed text-muted">
        El contador público suma una vez por persona cada 12 horas y no cuenta al equipo mientras tenga el panel abierto. El historial guarda las últimas 5.000 visitas, solo lo ven quienes tienen el permiso Ajustes, y la ubicación se consulta una sola vez por IP.
      </p>
    </div>
  )
}
