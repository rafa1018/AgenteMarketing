import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Camera, Eye, EyeOff, ImagePlus, Images, Loader2, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { expireSession, getCsrf } from '@/lib/calendar'
import { formatDay, todayYMD } from '@/lib/dates'
import type { FeedPost } from '@/lib/feed'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { api, toast } from '../store'
import { ConfirmModal, PageHead, field, labelCls, preparePhoto } from '../ui'

/* "Momentos" — the Instagram-style feed on the public site. Not connected to Instagram: what you publish here is what the site shows. */

async function upload(file: File, caption: string, date: string): Promise<FeedPost | null> {
  let big: Blob, small: Blob
  try {
    ;[big, small] = await Promise.all([preparePhoto(file, 1080), preparePhoto(file, 480)])
  } catch {
    toast('No se pudo leer esa foto. Prueba con otra o tómala de nuevo con la cámara.')
    return null
  }
  const fd = new FormData()
  fd.append('photo', big, 'post.jpg')
  fd.append('thumb', small, 'thumb.jpg')
  fd.append('caption', caption)
  fd.append('date', date)
  try {
    const res = await fetch('/api/feed.php', { method: 'POST', credentials: 'same-origin', headers: { 'X-CSRF-Token': getCsrf() }, body: fd })
    const data = await res.json().catch(() => null)
    if (res.status === 401) expireSession()
    if (data?.error === 'full') toast('Llegaste al máximo de publicaciones. Elimina algunas antiguas.')
    if (!data?.ok && data?.error !== 'full') toast('No se pudo publicar. Revisa tu conexión e intenta de nuevo.')
    return data?.ok ? (data.item as FeedPost) : null
  } catch {
    toast('No se pudo publicar. Revisa tu conexión e intenta de nuevo.')
    return null
  }
}

/** New post: pick a photo, see it cropped square like on the site, write the text. */
function Composer({ file, onClose, onDone }: { file: File | null; onClose: () => void; onDone: (p: FeedPost) => void }) {
  const [caption, setCaption] = useState('')
  const [date, setDate] = useState(todayYMD())
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    setCaption('')
    setDate(todayYMD())
    return () => URL.revokeObjectURL(url)
  }, [file])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!file) return
    setBusy(true)
    const p = await upload(file, caption.trim(), date)
    setBusy(false)
    if (p) {
      onDone(p)
      toast('¡Publicado! Ya se ve en la página.')
    }
  }

  return (
    <Modal open={Boolean(file)} onClose={onClose} label="Nueva publicación" closeLabel="Cerrar" className="w-full max-w-3xl">
      <form onSubmit={submit} className="grid md:grid-cols-2">
        <div className="bg-ink">{preview && <img src={preview} alt="" className="aspect-square w-full object-cover" />}</div>
        <div className="flex flex-col p-5 sm:p-6">
          <h2 className="pr-10 text-2xl">Nueva publicación</h2>
          <p className="mt-1 text-sm text-muted">La foto se recorta cuadrada, como en Instagram.</p>
          <label htmlFor="fd-cap" className={cn(labelCls, 'mt-5')}>
            Texto
          </label>
          <textarea id="fd-cap" rows={5} maxLength={600} className={cn(field, 'resize-y')} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="¡Hoy celebramos…! 🎉" />
          <p className="mt-1 text-right text-xs text-muted">{caption.length}/600</p>
          <label htmlFor="fd-date" className={cn(labelCls, 'mt-2')}>
            Fecha
          </label>
          <input id="fd-date" type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
          <div className="mt-auto flex gap-3 pt-6">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary flex-1 disabled:opacity-70">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <ImagePlus size={18} />} Publicar
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

function Editor({ post, onClose, onSaved }: { post: FeedPost | null; onClose: () => void; onSaved: (p: FeedPost) => void }) {
  const [caption, setCaption] = useState('')
  const [date, setDate] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (post) {
      setCaption(post.caption)
      setDate(post.date)
    }
  }, [post])
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!post) return
    setBusy(true)
    const { data } = await api.post('feed.php', { action: 'update', id: post.id, caption: caption.trim(), date, hidden: post.hidden })
    setBusy(false)
    if (data?.ok) {
      onSaved(data.item)
      toast('Publicación actualizada')
    } else toast('No se pudo guardar.')
  }
  return (
    <Modal open={Boolean(post)} onClose={onClose} label="Editar publicación" closeLabel="Cerrar" className="w-full max-w-3xl">
      {post && (
        <form onSubmit={submit} className="grid md:grid-cols-2">
          <img src={post.img} alt="" className="aspect-square w-full bg-ink object-cover" />
          <div className="flex flex-col p-5 sm:p-6">
            <h2 className="pr-10 text-2xl">Editar publicación</h2>
            <label htmlFor="fe-cap" className={cn(labelCls, 'mt-5')}>
              Texto
            </label>
            <textarea id="fe-cap" rows={6} maxLength={600} className={cn(field, 'resize-y')} value={caption} onChange={(e) => setCaption(e.target.value)} />
            <label htmlFor="fe-date" className={cn(labelCls, 'mt-4')}>
              Fecha <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input id="fe-date" type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
            <div className="mt-auto flex gap-3 pt-6">
              <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
                <X size={18} /> Cancelar
              </button>
              <button type="submit" disabled={busy} className="btn btn-primary flex-1 disabled:opacity-70">
                {busy && <Loader2 size={18} className="animate-spin" />} Guardar
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  )
}

export function FeedPage() {
  const [items, setItems] = useState<FeedPost[] | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [editing, setEditing] = useState<FeedPost | null>(null)
  const [deleting, setDeleting] = useState<FeedPost | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('feed.php?all=1').then(({ data }) => setItems(data?.ok ? data.items : []))
  }, [])

  const replace = (p: FeedPost) => setItems((xs) => xs?.map((x) => (x.id === p.id ? p : x)) ?? null)

  const move = async (i: number, d: number) => {
    if (!items) return
    const j = i + d
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[i], next[j]] = [next[j], next[i]]
    setItems(next)
    const { data } = await api.post('feed.php', { action: 'order', ids: next.map((x) => x.id) })
    if (!data?.ok) toast('No se pudo cambiar el orden.')
  }

  const toggle = async (p: FeedPost) => {
    const { data } = await api.post('feed.php', { action: 'update', id: p.id, caption: p.caption, date: p.date, hidden: !p.hidden })
    if (data?.ok) {
      replace(data.item)
      toast(data.item.hidden ? 'Oculta: ya no se ve en la página' : 'Visible en la página')
    } else toast('No se pudo guardar.')
  }

  const remove = async (p: FeedPost) => {
    const { data } = await api.post('feed.php', { action: 'delete', id: p.id })
    if (data?.ok) {
      setItems((xs) => xs?.filter((x) => x.id !== p.id) ?? null)
      toast('Publicación eliminada')
    } else toast('No se pudo eliminar.')
  }

  const visible = items?.filter((p) => !p.hidden).length ?? 0

  return (
    <div>
      <PageHead
        title="Momentos (feed)"
        sub={
          <>
            Las fotos que publiques aquí aparecen en la sección <b>Momentos Gabush</b> de la página, como un perfil de Instagram. No se conecta a Instagram.
            {items && (
              <span className="mt-1 block">
                {visible} visibles · {items.length - visible} ocultas
              </span>
            )}
          </>
        }
        actions={
          <>
            {/* on the phone: straight to the camera, or pick from the gallery */}
            <button type="button" onClick={() => camera.current?.click()} className="btn btn-pink flex-1 sm:flex-none lg:hidden">
              <Camera size={18} /> Tomar foto
            </button>
            <button type="button" onClick={() => input.current?.click()} className="btn btn-primary flex-1 sm:flex-none">
              <Images size={18} /> <span className="lg:hidden">Galería</span>
              <span className="hidden lg:inline">Subir foto</span>
            </button>
          </>
        }
      />
      {[input, camera].map((ref, k) => (
        <input
          key={k}
          ref={ref}
          type="file"
          accept="image/*"
          {...(ref === camera ? { capture: 'environment' as const } : {})}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) setFile(f)
            e.target.value = ''
          }}
        />
      ))}

      {items === null ? (
        <p className="mt-8 flex items-center gap-2 text-muted">
          <Loader2 size={18} className="animate-spin" /> Cargando…
        </p>
      ) : !items.length ? (
        <button type="button" onClick={() => input.current?.click()} className="mt-8 grid w-full place-items-center gap-2 rounded-3xl border-2 border-dashed border-line bg-white p-12 text-muted hover:border-royal hover:text-royal">
          <ImagePlus size={36} />
          <span className="font-semibold">Sube la primera foto</span>
        </button>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p, i) => (
            <li key={p.id} className={cn('card overflow-hidden p-0', p.hidden && 'opacity-60')}>
              <button type="button" onClick={() => setEditing(p)} className="relative block w-full" title="Editar">
                <img src={p.thumb} alt="" loading="lazy" className="aspect-square w-full object-cover" />
                <span className="absolute top-2 left-2 grid size-7 place-items-center rounded-full bg-white/90 text-xs font-bold text-ink">{i + 1}</span>
                {p.hidden && <span className="absolute top-2 right-2 rounded-full bg-ink px-2 py-0.5 text-xs font-bold text-white">Oculta</span>}
              </button>
              <div className="p-3">
                <p className="line-clamp-2 min-h-[2.6em] text-sm leading-snug text-text">{p.caption || <span className="text-muted">Sin texto</span>}</p>
                {p.date && <p className="mt-1 text-xs text-muted first-letter:uppercase">{formatDay(p.date, 'es')}</p>}
                <div className="mt-2 flex items-center justify-between gap-1 border-t border-line pt-2">
                  <span className="flex gap-1">
                    <button type="button" onClick={() => move(i, -1)} disabled={i === 0} title="Mover antes" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink disabled:opacity-30">
                      <ArrowLeft size={16} className="hidden sm:block" />
                      <ArrowUp size={16} className="sm:hidden" />
                    </button>
                    <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} title="Mover después" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink disabled:opacity-30">
                      <ArrowRight size={16} className="hidden sm:block" />
                      <ArrowDown size={16} className="sm:hidden" />
                    </button>
                  </span>
                  <span className="flex gap-1">
                    <button type="button" onClick={() => setEditing(p)} title="Editar" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink">
                      <Pencil size={16} />
                    </button>
                    <button type="button" onClick={() => toggle(p)} title={p.hidden ? 'Mostrar en la página' : 'Ocultar de la página'} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink">
                      {p.hidden ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button type="button" onClick={() => setDeleting(p)} title="Eliminar" className="grid size-8 place-items-center rounded-lg text-muted hover:bg-[#fdf0ef] hover:text-berry">
                      <Trash2 size={16} />
                    </button>
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Composer
        file={file}
        onClose={() => setFile(null)}
        onDone={(p) => {
          setItems((xs) => [p, ...(xs ?? [])])
          setFile(null)
        }}
      />
      <Editor
        post={editing}
        onClose={() => setEditing(null)}
        onSaved={(p) => {
          replace(p)
          setEditing(null)
        }}
      />
      <ConfirmModal open={Boolean(deleting)} title="¿Eliminar esta publicación?" confirmLabel="Sí, eliminar" tone="danger" icon={<Trash2 size={24} />} onConfirm={async () => {
          if (deleting) await remove(deleting)
        }} onClose={() => setDeleting(null)}>
        Desaparece de la página. Si solo quieres quitarla por un tiempo, usa <b>Ocultar</b>.
      </ConfirmModal>
    </div>
  )
}
