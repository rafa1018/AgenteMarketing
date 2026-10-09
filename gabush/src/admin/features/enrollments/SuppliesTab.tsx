import { Backpack, Copy, Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useMutation, useQuery } from '@/shared/useQuery'
import { toast } from '../../store'
import { api2, qs, useSetup } from '../../v2/api'
import { Badge, Empty, ErrorBox, Field, Spinner, inputCls } from '../../v2/kit'

type Item = { name: string; qty: string; note: string }
type SupplyList = { id: number; gradeLevelId: number | null; grade: string | null; notes: string | null; items: Item[]; published: boolean; updatedBy: string | null; updatedAt: string }
type Draft = { gradeLevelId: number | null; label: string; notes: string; items: Item[]; published: boolean; id?: number }

/**
 * Lista de útiles of the working year: one per grade (or one for every grade). Published lists are what the
 * families see in the app (Más → Útiles escolares).
 */
export function SuppliesTab() {
  const { setup, year } = useSetup()
  const { data, error, loading, reload } = useQuery(year ? `supplies:${year}` : null, () => api2.get<{ lists: SupplyList[] }>('/supplies' + qs({ year })))
  const [draft, setDraft] = useState<Draft | null>(null)
  const m = useMutation()
  if (error) return <ErrorBox message={error.message} onRetry={reload} />
  if ((loading && !data) || !setup || !year) return <Spinner />
  const lists = data?.lists ?? []
  const grades = setup.gradeLevels.filter((g) => g.active)
  const slots: { gradeLevelId: number | null; label: string }[] = [{ gradeLevelId: null, label: 'Para todos los grados' }, ...grades.map((g) => ({ gradeLevelId: g.id, label: g.name }))]
  const find = (gid: number | null) => lists.find((l) => l.gradeLevelId === gid) ?? null
  const open = (gid: number | null, label: string) => {
    const l = find(gid)
    setDraft({ gradeLevelId: gid, label, notes: l?.notes ?? '', items: l?.items.length ? l.items : [{ name: '', qty: '', note: '' }], published: l?.published ?? false, id: l?.id })
  }
  const copyPrev = async () => {
    const r = await m.run(() => api2.post<{ copied: number }>('/supplies/copy', { from: year - 1, to: year }))
    if (r) {
      toast(r.copied ? `Se copiaron ${r.copied} listas de ${year - 1} (sin publicar): revísalas y publícalas` : `${year - 1} no tiene listas para copiar`)
      reload()
    }
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-[14px] text-muted">
          La lista de lo que cada niño necesita en {year}. Puedes hacer una para todos los grados y/o una por grado: la familia ve las dos (la general primero). Solo se ve en la app cuando la <b>publicas</b>.
        </p>
        {!lists.length && (
          <button type="button" disabled={m.busy} onClick={copyPrev} className="btn btn-ghost !min-h-10 !text-sm">
            <Copy size={16} /> Copiar las de {year - 1}
          </button>
        )}
      </div>
      {m.message && <ErrorBox message={m.message} />}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {slots.map((s) => {
          const l = find(s.gradeLevelId)
          return (
            <li key={s.gradeLevelId ?? 'all'}>
              <button type="button" onClick={() => open(s.gradeLevelId, s.label)} className="card block h-full w-full p-4 text-left transition-shadow hover:ring-2 hover:ring-royal/40">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-center gap-2 font-serif text-lg font-semibold text-ink">
                    <Backpack size={18} className="text-pink" /> {s.label}
                  </p>
                  {l ? l.published ? <Badge tone="green">Publicada</Badge> : <Badge tone="yellow">Borrador</Badge> : null}
                </div>
                <p className="mt-1 text-[13px] text-muted">
                  {l ? `${l.items.length} artículos` : 'Sin lista'}
                  <span className="float-right inline-flex items-center gap-1 font-semibold text-royal">
                    {l ? <Pencil size={13} /> : <Plus size={13} />} {l ? 'Editar' : 'Crear'}
                  </span>
                </p>
              </button>
            </li>
          )
        })}
      </ul>
      {!grades.length && <Empty icon={<Backpack />} title="No hay grados activos" />}
      <SupplyEditor year={year} draft={draft} onClose={() => setDraft(null)} onSaved={reload} />
    </div>
  )
}

function SupplyEditor({ year, draft, onClose, onSaved }: { year: number; draft: Draft | null; onClose: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft | null>(draft)
  const [last, setLast] = useState<Draft | null>(draft)
  const m = useMutation()
  if (draft !== last) {
    setLast(draft)
    setD(draft)
  }
  if (!d) return <Modal open={false} onClose={onClose} label="Lista de útiles" closeLabel="Cerrar">{null}</Modal>
  const setItem = (i: number, p: Partial<Item>) => setD({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const save = async (published: boolean) => {
    const body = { year, gradeLevelId: d.gradeLevelId, notes: d.notes, items: d.items.filter((x) => x.name.trim()), published }
    if (await m.run(() => api2.put('/supplies', body))) {
      toast(published ? `Lista publicada: las familias de ${d.label === 'Para todos los grados' ? 'todos los grados' : d.label} ya la ven en la app` : 'Lista guardada como borrador')
      onSaved()
      onClose()
    }
  }
  return (
    <Modal open={Boolean(draft)} onClose={onClose} label="Lista de útiles" closeLabel="Cerrar" className="sm:!max-w-2xl">
      <div className="space-y-4 p-6">
        <div>
          <h2 className="text-[1.5rem]">Útiles {year} · {d.label}</h2>
          <p className="text-[13px] text-muted">{d.published ? 'Publicada: las familias la ven en la app.' : 'Borrador: las familias aún no la ven.'}</p>
        </div>
        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_90px_1fr_36px] gap-2 px-1 text-[12px] font-bold tracking-wide text-muted uppercase sm:grid">
            <span>Artículo</span>
            <span>Cantidad</span>
            <span>Nota (marca, color…)</span>
            <span />
          </div>
          {d.items.map((it, i) => (
            <div key={i} className="grid grid-cols-[1fr_80px_36px] gap-2 sm:grid-cols-[1fr_90px_1fr_36px]">
              <input value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="Ej. Cuaderno cuadriculado" aria-label="Artículo" className="min-w-0 rounded-lg border border-line px-3 py-2" />
              <input value={it.qty} onChange={(e) => setItem(i, { qty: e.target.value })} placeholder="2" aria-label="Cantidad" className="min-w-0 rounded-lg border border-line px-3 py-2" />
              <input value={it.note} onChange={(e) => setItem(i, { note: e.target.value })} placeholder="Opcional" aria-label="Nota" className="col-span-2 min-w-0 rounded-lg border border-line px-3 py-2 sm:col-span-1" />
              <button type="button" aria-label={`Quitar ${it.name || 'artículo'}`} onClick={() => setD({ ...d, items: d.items.filter((_, j) => j !== i) })} className="row-start-1 grid size-9 place-items-center self-center rounded-lg text-muted hover:bg-[#fdf0ef] hover:text-berry sm:col-start-4 sm:row-start-auto">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => setD({ ...d, items: [...d.items, { name: '', qty: '', note: '' }] })} className="btn btn-ghost !min-h-9 !px-3 !text-[13px]">
            <Plus size={15} /> Artículo
          </button>
        </div>
        <Field label="Indicaciones para las familias (opcional)" hint="Ej.: marcar todo con el nombre del niño; entregar la primera semana de clases; incluidos en el pago de útiles…">
          <textarea value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} rows={3} maxLength={2000} className={inputCls() + ' resize-y py-2.5'} />
        </Field>
        {m.message && <ErrorBox message={m.message} />}
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={m.busy} onClick={() => save(true)} className="btn btn-primary flex-1">
            <Eye size={17} /> Guardar y publicar
          </button>
          <button type="button" disabled={m.busy} onClick={() => save(false)} className="btn btn-ghost flex-1">
            <EyeOff size={17} /> Guardar sin publicar
          </button>
        </div>
        {d.id && (
          <button
            type="button"
            disabled={m.busy}
            onClick={async () => {
              if (await m.run(() => api2.del(`/supplies/${d.id}`))) {
                toast('Lista eliminada')
                onSaved()
                onClose()
              }
            }}
            className="btn btn-ghost w-full text-berry"
          >
            <Trash2 size={16} /> Eliminar esta lista
          </button>
        )}
      </div>
    </Modal>
  )
}
