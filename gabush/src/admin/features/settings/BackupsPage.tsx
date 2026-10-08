import { Archive, CalendarClock, Download, History, Loader2, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { can } from '@/lib/calendar'
import { dateTime } from '@/shared/format'
import { useMutation, useQuery } from '@/shared/useQuery'
import { toast } from '../../store'
import { PageHead } from '../../ui'
import { api2 } from '../../v2/api'
import { Badge, ErrorBox, Field, Spinner, inputCls } from '../../v2/kit'

type Backup = { name: string; kind: 'diaria' | 'semanal' | 'manual' | 'antes-de-restaurar'; size: number; createdAt: string }
type Data = { backups: Backup[]; lastRun: string | null; retention: Record<string, number> }

const KIND: Record<Backup['kind'], { label: string; tone: 'blue' | 'violet' | 'green' | 'yellow' }> = {
  diaria: { label: 'Diaria', tone: 'blue' },
  semanal: { label: 'Semanal', tone: 'violet' },
  manual: { label: 'Manual', tone: 'green' },
  'antes-de-restaurar': { label: 'Antes de restaurar', tone: 'yellow' },
}
const mb = (n: number) => `${(n / 1e6).toFixed(1)} MB`

/**
 * Backups of the whole school (database + photos, documents, signature): automatic every day, weekly on
 * Sundays; manual ones before a big change; download to keep a copy elsewhere; restore to any point.
 */
export function BackupsPage() {
  const { data, error, loading, reload, setData } = useQuery('backups', () => api2.get<Data>('/backups'))
  const [restoring, setRestoring] = useState<Backup | null>(null)
  const m = useMutation()
  if (error) return <ErrorBox message={error.message} onRetry={reload} />
  if (loading && !data) return <Spinner />
  const d = data!
  const last = d.backups.find((b) => b.kind === 'diaria' || b.kind === 'semanal')
  const createNow = async () => {
    const r = await m.run(() => api2.post<{ backup: Backup; backups: Backup[] }>('/backups', {}))
    if (r) {
      setData({ ...d, backups: r.backups })
      toast(`Copia creada (${mb(r.backup.size)})`)
    }
  }
  return (
    <div className="space-y-5">
      <PageHead
        title="Copias de seguridad"
        sub="Todo el jardín en un archivo: estudiantes, familias, notas, cartera, pagos, fotos, documentos y la firma."
        actions={
          <button type="button" disabled={m.busy} onClick={createNow} className="btn btn-primary !min-h-11">
            {m.busy ? <Loader2 size={18} className="animate-spin" /> : <Archive size={18} />} Crear copia ahora
          </button>
        }
      />
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <p className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-muted uppercase">
            <CalendarClock size={16} className="text-royal" /> Automáticas
          </p>
          <p className="mt-1 text-[14px] text-text">
            Cada día de madrugada (se guardan {d.retention.diaria}) y cada domingo una semanal (se guardan {d.retention.semanal} semanas).
          </p>
        </div>
        <div className="card p-4">
          <p className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-muted uppercase">
            <ShieldCheck size={16} className="text-leaf" /> Última copia automática
          </p>
          <p className="mt-1 text-[15px] font-semibold text-ink">{last ? dateTime(last.createdAt) : 'Aún no hay'}</p>
          {!d.lastRun && <p className="text-[12px] text-berry">La tarea automática del servidor aún no ha corrido.</p>}
        </div>
        <div className="card p-4">
          <p className="flex items-center gap-2 text-[13px] font-bold tracking-wide text-muted uppercase">
            <History size={16} className="text-pink" /> Restaurar
          </p>
          <p className="mt-1 text-[14px] text-text">Vuelve todo al momento de una copia. Antes se guarda una copia de cómo está ahora, por si quieres deshacerlo.</p>
        </div>
      </section>
      {m.message && <ErrorBox message={m.message} />}
      <section className="card overflow-hidden p-0">
        <h3 className="border-b border-line px-4 py-3 text-lg">Copias guardadas</h3>
        {!d.backups.length ? (
          <p className="px-4 py-6 text-sm text-muted">Todavía no hay copias. Crea una ahora con el botón de arriba.</p>
        ) : (
          <ul className="divide-y divide-line">
            {d.backups.map((b) => (
              <li key={b.name} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{dateTime(b.createdAt)}</span>
                  <span className="block text-[12px] text-muted">{mb(b.size)}</span>
                </span>
                <Badge tone={KIND[b.kind]?.tone ?? 'blue'}>{KIND[b.kind]?.label ?? b.kind}</Badge>
                <div className="flex gap-1">
                  <a href={`/api/v2/backups/${b.name}/download`} title="Descargar a este computador" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink">
                    <Download size={18} />
                  </a>
                  {can('usuarios') && (
                    <>
                      <button type="button" title="Restaurar esta copia" onClick={() => setRestoring(b)} className="grid size-10 place-items-center rounded-lg text-royal hover:bg-[#eeedfb]">
                        <RotateCcw size={18} />
                      </button>
                      <button
                        type="button"
                        title="Borrar copia"
                        onClick={async () => {
                          if (!window.confirm('¿Borrar esta copia de seguridad?')) return
                          const r = await m.run(() => api2.del<{ backups: Backup[] }>(`/backups/${b.name}`))
                          if (r) setData({ ...d, backups: r.backups })
                        }}
                        className="grid size-10 place-items-center rounded-lg text-muted hover:bg-[#fdf0ef] hover:text-berry"
                      >
                        <Trash2 size={17} />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-[13px] text-muted">Consejo: una vez al mes descarga la copia semanal más reciente y guárdala en tu computador o en Drive. Así tienes una copia fuera del servidor.</p>
      <RestoreModal backup={restoring} onClose={() => setRestoring(null)} onDone={(list) => setData({ ...d, backups: list })} />
    </div>
  )
}

function RestoreModal({ backup, onClose, onDone }: { backup: Backup | null; onClose: () => void; onDone: (b: Backup[]) => void }) {
  const [confirm, setConfirm] = useState('')
  const [files, setFiles] = useState(true)
  const m = useMutation()
  const close = () => {
    setConfirm('')
    m.setMessage(null)
    onClose()
  }
  return (
    <Modal open={Boolean(backup)} onClose={close} label="Restaurar copia" closeLabel="Cerrar" className="sm:!max-w-lg">
      {backup && (
        <div className="space-y-4 p-6">
          <h2 className="text-[1.5rem]">Restaurar la copia del {dateTime(backup.createdAt)}</h2>
          <p className="rounded-xl bg-butter px-4 py-3 text-[14px] text-[#8a5716]">
            Todo vuelve a como estaba en ese momento: estudiantes, notas, cobros y pagos. <b>Lo que se registró después se pierde.</b> Antes de empezar se guarda una copia de cómo está ahora, así puedes deshacerlo restaurando esa copia («Antes de restaurar»).
          </p>
          <label className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <input type="checkbox" checked={files} onChange={(e) => setFiles(e.target.checked)} className="size-5 accent-[#3a36a8]" /> También fotos, documentos y firma
          </label>
          <Field label="Escribe RESTAURAR para confirmar">
            <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls()} autoComplete="off" />
          </Field>
          {m.message && <ErrorBox message={m.message} />}
          <button
            type="button"
            disabled={m.busy || confirm.trim().toUpperCase() !== 'RESTAURAR'}
            onClick={async () => {
              const r = await m.run(() => api2.post<{ undo: string; backups: Backup[] }>(`/backups/${backup.name}/restore`, { confirm, files }))
              if (r) {
                onDone(r.backups)
                toast('Copia restaurada. Recarga la página para ver los datos.')
                close()
              }
            }}
            className="btn w-full bg-berry text-white disabled:opacity-50"
          >
            {m.busy ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />} Restaurar
          </button>
        </div>
      )}
    </Modal>
  )
}
