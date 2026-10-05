import { Copy, FileSpreadsheet, MailPlus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { ago, api, flag, fmtDate, toast } from '../api'
import { Card, Confirm, Empty, PageHead, Stat, btnGhost, field } from '../ui'

export type Subscriber = { id: string; t: number; email: string; lang: string; ip: string; device: string; place?: string; cc?: string }

const PAGE = 50

export function SubscribersPage({ tick }: { tick: number }) {
  const [list, setList] = useState<Subscriber[] | null>(null)
  const [q, setQ] = useState('')
  const [shown, setShown] = useState(PAGE)
  const [toDelete, setToDelete] = useState<Subscriber | null>(null)

  useEffect(() => {
    api.get<{ subscribers: Subscriber[] }>('subscribers.php').then(({ data }) => data?.ok && setList(data.subscribers))
  }, [tick])
  useEffect(() => setShown(PAGE), [q])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (list ?? []).filter((x) => !s || [x.email, x.place].some((v) => v?.toLowerCase().includes(s)))
  }, [list, q])

  const now = Date.now() / 1000
  const last7 = (list ?? []).filter((s) => s.t > now - 7 * 86400).length
  const last30 = (list ?? []).filter((s) => s.t > now - 30 * 86400).length

  const copyAll = async () => {
    const emails = (list ?? []).map((s) => s.email).join(', ')
    try {
      await navigator.clipboard.writeText(emails)
      toast(`${list?.length ?? 0} correos copiados. Pégalos en el campo "Para" o "CCO" de tu correo.`)
    } catch {
      toast('No se pudo copiar. Usa "Exportar a Excel".')
    }
  }

  const remove = async (s: Subscriber) => {
    const { data } = await api.post('subscribers.php', { action: 'delete', id: s.id })
    if (!data?.ok) return toast('No se pudo eliminar.')
    setList((l) => (l ?? []).filter((x) => x.id !== s.id))
    toast('Suscriptor eliminado.')
  }

  return (
    <>
      <PageHead
        title="Suscriptores"
        sub="Correos que dejaron en el formulario del pie de página del sitio."
        actions={
          list && list.length > 0 && (
            <>
              <button type="button" className={btnGhost} onClick={copyAll}>
                <Copy size={16} /> Copiar correos
              </button>
              <a className={btnGhost} href="/api/subscribers.php?format=csv">
                <FileSpreadsheet size={16} /> Exportar a Excel
              </a>
            </>
          )
        }
      />
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Stat label="Total" value={list?.length ?? '—'} tone="text-cyan" />
        <Stat label="Últimos 7 días" value={list ? last7 : '—'} />
        <Stat label="Últimos 30 días" value={list ? last30 : '—'} />
      </div>

      <label className="relative mt-5 block sm:max-w-sm">
        <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-dim" />
        <input className={cn(field, '!py-2 pl-9 text-sm')} placeholder="Buscar correo o ciudad…" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>

      <Card className="mt-4 !p-0">
        {!list ? (
          <p className="p-6 text-sm text-muted">Cargando…</p>
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <Empty>{q ? 'Ningún suscriptor coincide con la búsqueda.' : 'Aún no hay suscriptores. Cuando alguien deje su correo en el pie de página aparecerá aquí.'}</Empty>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {filtered.slice(0, shown).map((s) => (
                <li key={s.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-steel/70 text-cyan">
                    <MailPlus size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <a href={`mailto:${s.email}`} className="block truncate text-[15px] text-fg hover:text-cyan">
                      {s.email}
                    </a>
                    <p className="truncate text-xs text-dim">
                      {s.place ? `${flag(s.cc)} ${s.place}` : 'Ubicación desconocida'} · {s.lang === 'en' ? 'Inglés' : 'Español'} · <span title={fmtDate(s.t)}>{ago(s.t)}</span>
                    </p>
                  </div>
                  <button type="button" onClick={() => setToDelete(s)} className="grid size-10 shrink-0 place-items-center rounded-md text-muted hover:bg-danger/10 hover:text-danger" aria-label={`Eliminar ${s.email}`}>
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
            {filtered.length > shown && (
              <button type="button" onClick={() => setShown((n) => n + PAGE)} className="w-full border-t border-line py-3 text-sm text-cyan">
                Ver más ({filtered.length - shown} restantes)
              </button>
            )}
          </>
        )}
      </Card>
      <p className="mt-4 text-xs text-dim">Un mismo correo solo se guarda una vez: si alguien intenta suscribirse de nuevo, el sitio le avisa que ya está suscrito.</p>
      <Confirm open={Boolean(toDelete)} title="¿Eliminar este suscriptor?" body={toDelete?.email} confirm="Eliminar" danger onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove(toDelete)} />
    </>
  )
}
