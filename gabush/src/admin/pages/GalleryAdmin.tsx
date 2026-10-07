import { Check, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import type { GalleryItem } from '@/lib/content'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { toast } from '../store'
import { ConfirmModal, PageHead } from '../ui'
import { deleteContent, listContent, orderContent, saveContent, uploadContentImage } from '../content'
import { EnToggle, ItemActions, LField, PhotoPicker, StatusBadge, moved } from '../contentUi'

/* "Así se vive Gabush": the photos of the kindergarten on the public page. */

type Draft = Pick<GalleryItem, 'caption' | 'alt' | 'active'> & { id?: string; img?: string }
const EMPTY: Draft = { caption: { es: '', en: '' }, alt: { es: '', en: '' }, active: true }

function Editor({ draft, onClose, onSaved }: { draft: Draft | null; onClose: () => void; onSaved: (it: GalleryItem, isNew: boolean) => void }) {
  const [d, setD] = useState<Draft>(EMPTY)
  const [file, setFile] = useState<File | null>(null)
  const [showEn, setShowEn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  useEffect(() => {
    if (!draft) return
    setD(draft)
    setFile(null)
    setErrors([])
    setShowEn(Boolean(draft.caption.en))
  }, [draft])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!d.id && !file) return setErrors(['photo'])
    setBusy(true)
    const res = await saveContent('gallery', { id: d.id, caption: d.caption, alt: d.alt, active: d.active })
    if (!res.item) {
      setBusy(false)
      return res.fields && setErrors(res.fields)
    }
    let item = res.item
    if (file) item = (await uploadContentImage('gallery', item.id, file)) ?? item
    setBusy(false)
    onSaved(item, !d.id)
    toast(d.id ? 'Foto actualizada' : '¡Foto agregada a la galería!')
  }

  return (
    <Modal open={Boolean(draft)} onClose={onClose} label={d.id ? 'Editar foto' : 'Nueva foto'} closeLabel="Cerrar" className="w-full sm:!max-w-3xl">
      <form onSubmit={submit} noValidate className="grid gap-6 p-5 sm:p-7 md:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 className="pr-10 text-2xl md:hidden">{d.id ? 'Editar foto' : 'Nueva foto'}</h2>
          <PhotoPicker current={d.img} file={file} onFile={setFile} />
          {errors.includes('photo') && <p className="mt-1 text-sm font-medium text-berry">Elige una foto.</p>}
        </div>
        <div className="flex flex-col gap-4">
          <div className="hidden items-center justify-between gap-2 pr-10 md:flex">
            <h2 className="text-2xl">{d.id ? 'Editar foto' : 'Nueva foto'}</h2>
          </div>
          <EnToggle on={showEn} onChange={setShowEn} />
          <LField id="g-cap" label="Título (se ve sobre la foto)" value={d.caption} onChange={(caption) => setD({ ...d, caption })} showEn={showEn} max={60} required placeholder="Ej.: Nuestros salones" error={errors.includes('caption') ? 'Escribe un título corto.' : undefined} />
          <LField id="g-alt" label="Descripción de la foto" value={d.alt} onChange={(alt) => setD({ ...d, alt })} showEn={showEn} max={200} rows={2} placeholder="Ej.: Niños pintando en el salón de arte" hint="La leen los lectores de pantalla y Google. Opcional." />
          <label className="flex items-center gap-3 font-semibold text-ink">
            <input type="checkbox" checked={d.active} onChange={(e) => setD({ ...d, active: e.target.checked })} className="size-5 accent-[#3a36a8]" />
            Activa (se ve en la página)
          </label>
          <div className="mt-auto flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary flex-1 disabled:opacity-70">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Guardar
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

export function GalleryAdminPage() {
  const [items, setItems] = useState<GalleryItem[] | null>(null)
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<GalleryItem | null>(null)

  useEffect(() => {
    listContent('gallery').then((x) => setItems(x ?? []))
  }, [])

  const move = async (i: number, d: number) => {
    if (!items) return
    const next = moved(items, i, d)
    setItems(next)
    await orderContent('gallery', next.map((x) => x.id))
  }
  const toggle = async (it: GalleryItem) => {
    const res = await saveContent('gallery', { ...it, active: !it.active })
    if (res.item) {
      setItems((xs) => xs?.map((x) => (x.id === it.id ? res.item! : x)) ?? null)
      toast(res.item.active ? 'Visible en la página' : 'Inactiva: ya no se ve en la página')
    }
  }
  const remove = async (it: GalleryItem) => {
    if (await deleteContent('gallery', it.id)) {
      setItems((xs) => xs?.filter((x) => x.id !== it.id) ?? null)
      toast('Foto eliminada')
    }
  }
  const active = items?.filter((x) => x.active).length ?? 0

  return (
    <div>
      <PageHead
        title="Galería"
        sub={
          <>
            Las fotos de la sección <b>Así se vive Gabush</b> de la página. La primera se muestra grande.
            {items && <span className="mt-1 block">{active} activas · {items.length - active} inactivas</span>}
          </>
        }
        actions={
          <button type="button" onClick={() => setEditing({ ...EMPTY })} className="btn btn-primary flex-1 sm:flex-none">
            <ImagePlus size={18} /> Nueva foto
          </button>
        }
      />

      {items === null ? (
        <p className="mt-8 flex items-center gap-2 text-muted">
          <Loader2 size={18} className="animate-spin" /> Cargando…
        </p>
      ) : !items.length ? (
        <button type="button" onClick={() => setEditing({ ...EMPTY })} className="mt-8 grid w-full place-items-center gap-2 rounded-3xl border-2 border-dashed border-line bg-white p-12 text-muted hover:border-royal hover:text-royal">
          <ImagePlus size={36} />
          <span className="font-semibold">Agrega la primera foto</span>
        </button>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it, i) => (
            <li key={it.id} className={cn('card overflow-hidden !p-0', !it.active && 'opacity-60')}>
              <button type="button" onClick={() => setEditing({ ...it })} className="relative block w-full" title="Editar">
                <img src={it.thumb || it.img} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                <span className="absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-white/90 text-xs font-bold text-ink">{i + 1}</span>
                {i === 0 && <span className="absolute top-2 right-2 rounded-full bg-pink px-2 py-0.5 text-xs font-bold text-white">Grande</span>}
              </button>
              <div className="p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-semibold text-ink">{it.caption.es}</p>
                  <StatusBadge active={it.active} />
                </div>
                <div className="mt-2 flex justify-end border-t border-line pt-2">
                <ItemActions
                  first={i === 0}
                  last={i === items.length - 1}
                  active={it.active}
                  onUp={() => move(i, -1)}
                  onDown={() => move(i, 1)}
                  onToggle={() => toggle(it)}
                  onEdit={() => setEditing({ ...it })}
                  onDelete={() => setDeleting(it)}
                />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Editor
        draft={editing}
        onClose={() => setEditing(null)}
        onSaved={(it, isNew) => {
          setItems((xs) => (isNew ? [...(xs ?? []), it] : (xs ?? []).map((x) => (x.id === it.id ? it : x))))
          setEditing(null)
        }}
      />
      <ConfirmModal
        open={Boolean(deleting)}
        title="¿Eliminar esta foto?"
        confirmLabel="Sí, eliminar"
        tone="danger"
        icon={<Trash2 size={24} />}
        onConfirm={async () => {
          if (deleting) await remove(deleting)
        }}
        onClose={() => setDeleting(null)}
      >
        Desaparece de la página. Si solo quieres ocultarla un tiempo, usa <b>Inactivar</b> (el ojo).
      </ConfirmModal>
    </div>
  )
}
