import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { closePhoto, fullName, openPhoto, photoUrl, useAdmin, type Student } from './store'

/* Small shared pieces of the admin panel. */

export const field =
  'block w-full min-w-0 min-h-[46px] rounded-lg border border-[#d6d8ec] bg-white px-3.5 py-2.5 text-[16px] text-text outline-none transition-[border-color,box-shadow] focus:border-royal focus:shadow-[0_0_0_4px_rgb(58_54_168/0.12)]'
export const labelCls = 'mb-1.5 block text-[14px] font-semibold text-ink'

/** Student photo, or initials on a coloured circle. */
export function Avatar({ student, size = 48, className }: { student: Student; size?: number; className?: string }) {
  const url = photoUrl(student)
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [url])
  const initials = `${student.firstName[0] ?? ''}${student.lastName[0] ?? ''}`.toUpperCase()
  const hue = [...student.id].reduce((n, c) => n + c.charCodeAt(0), 0) % 4
  return url && !broken ? (
    // tap the photo to see it big (never also opens what the photo sits on, e.g. the student card)
    <img
      src={url}
      alt={fullName(student)}
      title="Ver foto"
      width={size}
      height={size}
      onError={() => setBroken(true)}
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        openPhoto(student.id)
      }}
      className={cn('shrink-0 cursor-zoom-in rounded-full object-cover transition-transform hover:scale-105', className)}
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center rounded-full font-semibold', ['bg-[#eeedfb] text-royal', 'bg-[#f8f1e4] text-[#8a5716]', 'bg-[#eaf3fa] text-[#185a8a]', 'bg-[#e9f4ee] text-leaf'][hue], className)}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials}
    </span>
  )
}

export function PageHead({ title, sub, actions }: { title: string; sub?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[1.9rem] sm:text-[2.3rem]">{title}</h1>
        {sub && <div className="mt-1 text-[15px] text-muted">{sub}</div>}
      </div>
      {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto">{actions}</div>}
    </div>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('card p-5 sm:p-6', className)}>{children}</div>
}

/** Enlarged student photo (mounted once in the app). */
export function PhotoViewer() {
  const id = useAdmin((s) => s.viewingPhoto)
  const st = useAdmin((s) => s.students.find((x) => x.id === s.viewingPhoto))
  const url = st && photoUrl(st)
  return (
    <Modal open={Boolean(id && url)} onClose={closePhoto} label={st ? fullName(st) : 'Foto'} closeLabel="Cerrar" variant="bare" className="w-full max-w-md">
      {st && url && (
        <figure className="text-center">
          <img src={url} alt={fullName(st)} className="mx-auto aspect-square w-full max-w-md rounded-3xl object-cover shadow-2xl" />
          <figcaption className="mt-3 font-serif text-xl font-semibold text-white">{fullName(st)}</figcaption>
        </figure>
      )}
    </Modal>
  )
}

/** Branded confirmation dialog (replaces the browser's grey confirm box). */
export function ConfirmModal({
  open,
  title,
  children,
  confirmLabel,
  tone = 'primary',
  icon,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  children?: ReactNode
  confirmLabel: string
  tone?: 'primary' | 'success' | 'danger'
  icon?: ReactNode
  onConfirm: () => void | Promise<void>
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)
  const btn = { primary: 'bg-ink hover:bg-royal', success: 'bg-leaf hover:brightness-110', danger: 'bg-berry hover:brightness-110' }[tone]
  const badge = { primary: 'bg-[#eeedfb] text-royal', success: 'bg-[#e9f4ee] text-leaf', danger: 'bg-[#fdf0ef] text-berry' }[tone]
  return (
    <Modal open={open} onClose={onClose} label={title} closeLabel="Cerrar" className="sm:!max-w-md">
      <div className="p-6 text-center sm:p-8">
        {icon && <span className={cn('mx-auto grid size-14 place-items-center rounded-full', badge)}>{icon}</span>}
        <h2 className="mt-4 text-[1.5rem] leading-tight">{title}</h2>
        {children && <div className="mt-2 text-[15px] text-muted">{children}</div>}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await onConfirm()
              setBusy(false)
              onClose()
            }}
            className={cn('btn text-white disabled:opacity-70', btn)}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Crops the centre square and shrinks a camera/gallery photo to 640 px JPEG before upload. */
export async function preparePhoto(file: File, size = 640): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(async () => {
    const img = new Image()
    img.src = URL.createObjectURL(file)
    await img.decode()
    return img
  })
  const w = 'width' in bitmap ? bitmap.width : 0
  const h = 'height' in bitmap ? bitmap.height : 0
  const side = Math.min(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = Math.min(size, side)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap as CanvasImageSource, (w - side) / 2, (h - side) / 2, side, side, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('photo'))), 'image/jpeg', 0.85))
}

/** Shrinks a photo to at most `maxW` px wide (keeps its shape, no crop) as JPEG before upload. */
export async function resizePhoto(file: File, maxW = 1280): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(async () => {
    const img = new Image()
    img.src = URL.createObjectURL(file)
    await img.decode()
    return img
  })
  const w = 'width' in bitmap ? bitmap.width : 0
  const h = 'height' in bitmap ? bitmap.height : 0
  const scale = Math.min(1, maxW / w)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  canvas.getContext('2d')!.drawImage(bitmap as CanvasImageSource, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('photo'))), 'image/jpeg', 0.85))
}

/** Tiny hash router: #/asistencia → 'asistencia'. */
export function useRoute(fallback: string): [string, (r: string) => void] {
  const read = () => location.hash.replace(/^#\/?/, '').split('?')[0] || fallback
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => {
      setRoute(read())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return [route, (r: string) => (location.hash = `/${r}`)]
}
