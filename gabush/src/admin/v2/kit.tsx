import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, Loader2, Search, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { initials } from '@/shared/format'
import { field, labelCls } from '../ui'
import { setWorkingYear, studentPhoto, useSetup, type Id } from './api'

/* Building blocks of the v2 modules (consistent look with the rest of the panel). */

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <p className="flex items-center gap-2 py-6 text-muted">
      <Loader2 size={18} className="animate-spin" /> {label}
    </p>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl bg-[#fdf0ef] px-4 py-3 text-sm font-medium text-berry">
      {message}{' '}
      {onRetry && (
        <button type="button" onClick={onRetry} className="ml-1 underline">
          Reintentar
        </button>
      )}
    </div>
  )
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-line bg-white px-6 py-10 text-center">
      {icon && <div className="mx-auto mb-3 grid size-14 place-items-center rounded-full bg-paper text-royal">{icon}</div>}
      <p className="font-serif text-xl font-semibold text-ink">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-[15px] text-muted">{children}</div>}
    </div>
  )
}

/** Tabs that remember the active one in the hash (#/modulo?tab=x). */
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; badge?: number | string | null }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          onClick={() => onChange(t.id)}
          className={cn('flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold transition-colors', t.id === value ? 'bg-ink text-white' : 'bg-white text-muted ring-1 ring-line hover:text-ink')}
        >
          {t.label}
          {t.badge !== undefined && t.badge !== null && t.badge !== 0 && <span className={cn('rounded-full px-1.5 text-[11px]', t.id === value ? 'bg-white/20' : 'bg-paper text-ink')}>{t.badge}</span>}
        </button>
      ))}
    </div>
  )
}

export function useTab<T extends string>(fallback: T): [T, (t: T) => void] {
  const read = () => (new URLSearchParams(location.hash.split('?')[1] ?? '').get('tab') as T) || fallback
  const [tab, setTab] = useState<T>(read)
  useEffect(() => {
    const on = () => setTab(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return [
    tab,
    (t: T) => {
      const [path, q] = location.hash.replace(/^#/, '').split('?')
      const p = new URLSearchParams(q ?? '')
      p.set('tab', t)
      history.replaceState(null, '', `#${path}?${p.toString()}`)
      setTab(t)
    },
  ]
}

const TONES = {
  green: 'bg-[#e9f4ee] text-leaf',
  red: 'bg-[#fdf0ef] text-berry',
  yellow: 'bg-butter text-[#8a5716]',
  blue: 'bg-[#eaf3fa] text-[#185a8a]',
  violet: 'bg-[#eeedfb] text-royal',
  gray: 'bg-paper text-muted',
}
export type Tone = keyof typeof TONES
export function Badge({ tone = 'gray', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold whitespace-nowrap', TONES[tone], className)}>{children}</span>
}

export const STATUS_TONE: Record<string, Tone> = {
  activo: 'green', prematricula: 'yellow', retirado: 'gray', abierto: 'yellow', pagado: 'green', anulado: 'gray', aprobado: 'green', rechazado: 'red', pendiente: 'yellow',
  recibido: 'blue', presente: 'green', ausente: 'red', justificada: 'blue', tarde: 'yellow',
}
export const STATUS_LABEL: Record<string, string> = {
  activo: 'Activo', prematricula: 'Prematrícula', retirado: 'Retirado', abierto: 'Pendiente', pagado: 'Pagado', anulado: 'Anulado', aprobado: 'Aprobado', rechazado: 'Rechazado',
  pendiente: 'Pendiente', recibido: 'Recibido', presente: 'Presente', ausente: 'Ausente', justificada: 'Justificada', tarde: 'Tarde',
}
export const StatusBadge = ({ status }: { status: string }) => <Badge tone={STATUS_TONE[status] ?? 'gray'}>{STATUS_LABEL[status] ?? status}</Badge>

export function Stat({ label, value, hint, tone = 'ink', icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'ink' | 'green' | 'red' | 'pink' | 'blue'; icon?: ReactNode }) {
  const color = { ink: 'text-ink', green: 'text-leaf', red: 'text-berry', pink: 'text-pink', blue: 'text-ocean' }[tone]
  return (
    <div className="card flex items-start gap-3 p-4 sm:p-5">
      {icon && <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-paper text-royal">{icon}</span>}
      <div className="min-w-0">
        <p className="text-[12px] font-bold tracking-wide text-muted uppercase">{label}</p>
        <p className={cn('mt-0.5 truncate font-serif text-[1.6rem] leading-tight font-semibold tabular-nums', color)}>{value}</p>
        {hint && <p className="mt-0.5 text-[13px] text-muted">{hint}</p>}
      </div>
    </div>
  )
}

/** Labelled input wrapper with an inline error. */
export function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block min-w-0', className)}>
      <span className={labelCls}>{label}</span>
      {children}
      {error ? <span className="mt-1 block text-[13px] font-semibold text-berry">{error}</span> : hint ? <span className="mt-1 block text-[13px] text-muted">{hint}</span> : null}
    </label>
  )
}
export const inputCls = (error?: string) => cn(field, error && 'border-berry focus:border-berry')

export function SearchBox({ value, onChange, placeholder = 'Buscar…', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <label className={cn('relative block min-w-0', className)}>
      <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
      <span className="sr-only">{placeholder}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(field, 'pl-10')} />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="Limpiar" className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-muted hover:text-ink">
          <X size={16} />
        </button>
      )}
    </label>
  )
}

/** Academic year picker: changes the year every module works on. */
export function YearPicker({ className }: { className?: string }) {
  const { setup, year } = useSetup()
  if (!setup) return null
  return (
    <label className={cn('flex items-center gap-2', className)}>
      <span className="text-[13px] font-bold text-muted uppercase">Año</span>
      <select value={year ?? setup.activeYear} onChange={(e) => setWorkingYear(Number(e.target.value))} className={cn(field, 'min-h-10 w-auto py-1.5 pr-8 font-semibold')}>
        {setup.years.map((y) => (
          <option key={y.id} value={y.id}>
            {y.id}
            {y.status === 'active' ? ' (actual)' : y.status === 'planned' ? ' (próximo)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}

export function CourseSelect({ value, onChange, allowAll = true, className }: { value: Id | null; onChange: (id: Id | null) => void; allowAll?: boolean; className?: string }) {
  const { setup } = useSetup()
  return (
    <select value={value ?? ''} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)} className={cn(field, className)} aria-label="Curso">
      {allowAll ? <option value="">Todos los cursos</option> : <option value="">Elige el curso…</option>}
      {setup?.courses.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name} ({c.enrolled}/{c.capacity})
        </option>
      ))}
    </select>
  )
}

/** Student photo (v2) or initials. */
export function StudentAvatar({ s, size = 44, className }: { s: { id: Id; firstName: string; lastName: string; hasPhoto?: number | boolean; photoVersion?: string }; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false)
  const hue = s.id % 4
  if (s.hasPhoto && !broken) {
    return <img src={studentPhoto(s.id, s.photoVersion)} alt="" loading="lazy" onError={() => setBroken(true)} className={cn('shrink-0 rounded-full object-cover', className)} style={{ width: size, height: size }} />
  }
  return (
    <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-full font-semibold', ['bg-[#eeedfb] text-royal', 'bg-[#f8f1e4] text-[#8a5716]', 'bg-[#eaf3fa] text-[#185a8a]', 'bg-[#e9f4ee] text-leaf'][hue], className)} style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {initials(s)}
    </span>
  )
}

/** Full-height side panel (desktop) / full screen (phones) for details like a student's file. */
export function Drawer({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [open, onClose])
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 34 }}
            className={cn('relative flex h-full w-full flex-col bg-paper shadow-2xl', wide ? 'max-w-4xl' : 'max-w-2xl')}
          >
            <div className="flex items-center gap-2 border-b border-line bg-white px-3 py-2.5">
              <button type="button" onClick={onClose} aria-label="Cerrar" className="grid size-10 place-items-center rounded-lg text-ink hover:bg-paper">
                <ChevronLeft size={22} />
              </button>
              <p className="truncate font-serif text-lg font-semibold text-ink">{title}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Scrollable table wrapper that never overflows the page on phones. */
export function TableWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('card overflow-hidden p-0', className)}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-[14px] [&_td]:px-4 [&_td]:py-2.5 [&_th]:bg-paper [&_th]:px-4 [&_th]:py-2.5 [&_th]:text-[12px] [&_th]:font-bold [&_th]:tracking-wide [&_th]:text-muted [&_th]:uppercase [&_tbody_tr]:border-t [&_tbody_tr]:border-line">{children}</table>
      </div>
    </div>
  )
}
