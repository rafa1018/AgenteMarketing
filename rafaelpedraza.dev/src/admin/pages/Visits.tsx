import { FileDown, Laptop, Search, Smartphone, Tablet, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { api, flag, fmtDate, place, type Download, type Stats, type Visit } from '../api'
import { Card, Empty, PageHead, Stat, field } from '../ui'

const PAGE = 40
const KindIcon = ({ kind }: { kind?: string }) => {
  const I = kind === 'mobile' ? Smartphone : kind === 'tablet' ? Tablet : Laptop
  return <I size={15} className="shrink-0 text-dim" />
}
const refHost = (ref: string) => {
  try {
    return new URL(ref).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

export function VisitsPage({ tick }: { tick: number }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [tab, setTab] = useState<'visits' | 'downloads'>(() => (location.hash.includes('cv') ? 'downloads' : 'visits'))
  const [q, setQ] = useState('')
  const [onlyNew, setOnlyNew] = useState(false)
  const [shown, setShown] = useState(PAGE)

  useEffect(() => {
    api.get<Stats>('stats.php').then(({ data }) => data?.ok && setStats(data))
  }, [tick])
  useEffect(() => setShown(PAGE), [tab, q, onlyNew])

  const match = (v: Partial<Visit>) => {
    const s = q.trim().toLowerCase()
    return !s || [v.ip, v.city, v.region, v.country, v.device, v.isp, v.ref].some((x) => x?.toLowerCase().includes(s))
  }
  const visits = useMemo(() => (stats?.visitLog ?? []).filter((v) => (!onlyNew || v.new) && match(v)), [stats, q, onlyNew]) // eslint-disable-line react-hooks/exhaustive-deps
  const downloads = useMemo(() => (stats?.downloads.log ?? []).filter(match), [stats, q]) // eslint-disable-line react-hooks/exhaustive-deps
  const uniqueIps = new Set((stats?.visitLog ?? []).map((v) => v.ip)).size
  const mobile = (stats?.visitLog ?? []).filter((v) => v.kind !== 'desktop').length

  return (
    <>
      <PageHead title="Visitas" sub="Historial de quién entra al sitio y desde dónde (ubicación aproximada según la IP)." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Stat label="Contador público" value={stats?.visits.count ?? '—'} hint="Lo que ven los visitantes" tone="text-cyan" />
        <Stat label="IPs en el historial" value={stats ? uniqueIps : '—'} hint={`${stats?.visitLog.length ?? 0} visitas registradas`} />
        <Stat label="Desde el celular" value={stats && stats.visitLog.length ? `${Math.round((mobile / stats.visitLog.length) * 100)}%` : '—'} />
        <Stat label="Descargas del CV" value={stats?.downloads.count ?? '—'} tone="text-volt" />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {(
          [
            ['visits', 'Visitas', Users],
            ['downloads', 'Descargas del CV', FileDown],
          ] as const
        ).map(([id, text, Icon]) => (
          <button key={id} type="button" onClick={() => setTab(id)} className={cn('inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm', tab === id ? 'border-cyan/60 bg-cyan/10 text-fg' : 'border-line text-muted')}>
            <Icon size={15} /> {text}
          </button>
        ))}
        <label className="relative ml-auto w-full sm:w-72">
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim" />
          <input className={cn(field, '!py-2 pl-9 text-sm')} placeholder="Buscar ciudad, país, IP…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      {tab === 'visits' && (
        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} className="size-4 accent-[#2f8cff]" /> Solo visitantes nuevos (los que suman al contador)
        </label>
      )}

      <Card className="mt-4 !p-0">
        {!stats ? (
          <p className="p-6 text-sm text-muted">Cargando…</p>
        ) : (tab === 'visits' ? visits : downloads).length === 0 ? (
          <div className="p-4">
            <Empty>{q ? 'Nada coincide con la búsqueda.' : tab === 'visits' ? 'Todavía no hay visitas registradas.' : 'Nadie ha descargado tu hoja de vida todavía.'}</Empty>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {(tab === 'visits' ? visits : downloads).slice(0, shown).map((v) => (
                <Row key={v.id} v={v} isNew={tab === 'visits' ? (v as Visit).new : undefined} />
              ))}
            </ul>
            {(tab === 'visits' ? visits : downloads).length > shown && (
              <button type="button" onClick={() => setShown((n) => n + PAGE)} className="w-full border-t border-line py-3 text-sm text-cyan">
                Ver más ({(tab === 'visits' ? visits : downloads).length - shown} restantes)
              </button>
            )}
          </>
        )}
      </Card>
      <p className="mt-4 text-xs leading-relaxed text-dim">
        El contador público suma una sola vez por IP (en IPv6, por red de la casa/celular) y nunca cuenta tus visitas mientras tengas la sesión del panel abierta. El historial guarda las últimas 5.000 visitas.
      </p>
    </>
  )
}

function Row({ v, isNew }: { v: Visit | Download; isNew?: boolean }) {
  const host = v.ref ? refHost(v.ref) : ''
  return (
    <li className="flex items-start gap-3 px-4 py-3.5 sm:px-5">
      <span className="mt-0.5 text-2xl leading-none">{flag(v.cc)}</span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[15px] text-fg">{place(v)}</span>
          {isNew && <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[11px] text-ok">nueva</span>}
          {isNew === false && <span className="rounded-full bg-steel px-2 py-0.5 text-[11px] text-muted">regresó</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-dim">
          <span className="inline-flex items-center gap-1.5">
            <KindIcon kind={v.kind} /> {v.device}
          </span>
          <span className="font-mono">{v.ip}</span>
          {v.isp && <span className="truncate">{v.isp}</span>}
          {host && <span className="text-cyan/80">vía {host}</span>}
        </div>
      </div>
      <span className="shrink-0 text-right text-xs text-dim">{fmtDate(v.t)}</span>
    </li>
  )
}
