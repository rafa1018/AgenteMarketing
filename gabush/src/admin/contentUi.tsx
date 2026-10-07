import { ArrowDown, ArrowUp, Camera, Eye, EyeOff, Images, Languages, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { L } from '@/i18n'
import { cn } from '@/lib/utils'
import { field, labelCls } from './ui'

/* Pieces shared by the content editors (Galería, Niveles). */

/** Spanish field + optional English one (empty English = the page shows the Spanish text). */
export function LField({
  id,
  label,
  value,
  onChange,
  showEn,
  max,
  rows,
  required,
  placeholder,
  error,
  hint,
}: {
  id: string
  label: string
  value: L
  onChange: (v: L) => void
  showEn: boolean
  max: number
  rows?: number
  required?: boolean
  placeholder?: string
  error?: string
  hint?: string
}) {
  const Tag = rows ? 'textarea' : 'input'
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label} {required && <span className="text-berry">*</span>}
      </label>
      <Tag id={id} className={cn(field, Boolean(rows) && 'resize-y')} rows={rows} maxLength={max} value={value.es} placeholder={placeholder} onChange={(e) => onChange({ ...value, es: e.target.value })} />
      {showEn && (
        <div className="mt-1.5 flex items-start gap-2">
          <span className="mt-3 rounded bg-[#eeedfb] px-1.5 py-0.5 text-[11px] font-bold text-royal">EN</span>
          <Tag aria-label={`${label} (inglés)`} className={cn(field, '!min-h-[42px] !py-2 text-[15px]', Boolean(rows) && 'resize-y')} rows={rows ? Math.max(2, rows - 1) : undefined} maxLength={max} value={value.en} placeholder="(opcional: si lo dejas vacío se muestra en español)" onChange={(e) => onChange({ ...value, en: e.target.value })} />
        </div>
      )}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-sm font-medium text-berry">{error}</p>}
    </div>
  )
}

export function EnToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!on)} aria-pressed={on} className={cn('inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-sm font-semibold', on ? 'border-royal bg-[#eeedfb] text-royal' : 'border-line text-muted')}>
      <Languages size={15} /> {on ? 'Ocultar inglés' : 'Traducir al inglés'}
    </button>
  )
}

/** Photo with "Tomar foto" / "Galería" buttons; the chosen file is kept until the item is saved. */
export function PhotoPicker({ current, file, onFile, aspect = 'aspect-[4/3]' }: { current?: string; file: File | null; onFile: (f: File | null) => void; aspect?: string }) {
  const gallery = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  const src = preview ?? current
  return (
    <div>
      <div className={cn('relative overflow-hidden rounded-2xl border-2 border-dashed border-line bg-paper', aspect)}>
        {src ? <img src={src} alt="" className="size-full object-cover" /> : <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-muted">Sin foto todavía</p>}
        {preview && <span className="absolute top-2 left-2 rounded-full bg-pink px-2 py-0.5 text-xs font-bold text-white">Nueva — se sube al guardar</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <button type="button" onClick={() => camera.current?.click()} className="btn btn-ghost !min-h-10 flex-1 !px-3 !text-sm lg:hidden">
          <Camera size={16} /> Tomar foto
        </button>
        <button type="button" onClick={() => gallery.current?.click()} className="btn btn-ghost !min-h-10 flex-1 !px-3 !text-sm">
          <Images size={16} /> {src ? 'Cambiar foto' : 'Elegir foto'}
        </button>
      </div>
      {[gallery, camera].map((ref, k) => (
        <input
          key={k}
          ref={ref}
          type="file"
          accept="image/*"
          {...(ref === camera ? { capture: 'environment' as const } : {})}
          className="hidden"
          onChange={(e) => {
            onFile(e.target.files?.[0] ?? null)
            e.target.value = ''
          }}
        />
      ))}
    </div>
  )
}

/** Row of actions for a list item: move up/down, show/hide, edit, delete. */
export function ItemActions({ first, last, active, onUp, onDown, onToggle, onEdit, onDelete }: { first: boolean; last: boolean; active: boolean; onUp: () => void; onDown: () => void; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const btn = 'grid size-9 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink disabled:opacity-30'
  return (
    <span className="flex items-center gap-0.5">
      <button type="button" onClick={onUp} disabled={first} title="Subir" className={btn}>
        <ArrowUp size={16} />
      </button>
      <button type="button" onClick={onDown} disabled={last} title="Bajar" className={btn}>
        <ArrowDown size={16} />
      </button>
      <button type="button" onClick={onToggle} title={active ? 'Inactivar (ocultar de la página)' : 'Activar (mostrar en la página)'} className={btn}>
        {active ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
      <button type="button" onClick={onEdit} title="Editar" className={btn}>
        <Pencil size={16} />
      </button>
      <button type="button" onClick={onDelete} title="Eliminar" className={cn(btn, 'hover:bg-[#fdf0ef] hover:text-berry')}>
        <Trash2 size={16} />
      </button>
    </span>
  )
}

export function StatusBadge({ active }: { active: boolean }) {
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', active ? 'bg-[#ebf7e4] text-leaf' : 'bg-paper text-muted')}>{active ? 'Activo' : 'Inactivo'}</span>
}

export function Section({ title, sub, children, actions }: { title: string; sub?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl">{title}</h2>
          {sub && <p className="text-sm text-muted">{sub}</p>}
        </div>
        {actions}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

/** Moves item i by d positions; returns the new list. */
export const moved = <T,>(list: T[], i: number, d: number) => {
  const j = i + d
  if (j < 0 || j >= list.length) return list
  const next = [...list]
  ;[next[i], next[j]] = [next[j], next[i]]
  return next
}
