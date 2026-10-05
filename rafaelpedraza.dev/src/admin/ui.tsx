import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useToast } from './api'

/* Tailwind class sets shared by every page */
export const btn = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50'
export const btnPrimary = cn(btn, 'bg-volt text-white hover:opacity-90')
export const btnGhost = cn(btn, 'border border-line-strong text-fg hover:border-cyan/60 hover:text-white')
export const btnDanger = cn(btn, 'border border-danger/40 text-danger hover:bg-danger/10')
export const field = 'w-full rounded-lg border border-line-strong bg-ink/70 px-3.5 py-2.5 text-[15px] text-fg placeholder:text-dim focus:border-cyan/70 focus:outline-none'
export const label = 'hud mb-2 block !text-[10px] text-muted'

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn('panel p-5 sm:p-6', className)}>{children}</section>
}

export function CardTitle({ icon: Icon, children, sub }: { icon?: React.ComponentType<{ size?: number; className?: string }>; children: ReactNode; sub?: ReactNode }) {
  return (
    <header className="mb-4">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-fg">
        {Icon && <Icon size={19} className="text-cyan" />} {children}
      </h2>
      {sub && <p className="mt-1 text-sm leading-relaxed text-muted">{sub}</p>}
    </header>
  )
}

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-fg sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Stat({ label: text, value, hint, tone = 'text-fg' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: string }) {
  return (
    <div className="panel p-4 sm:p-5">
      <p className="hud !text-[10px] text-muted">{text}</p>
      <p className={cn('mt-2 font-display text-3xl font-semibold tabular-nums sm:text-4xl', tone)}>{value}</p>
      {hint && <p className="mt-1 text-xs text-dim">{hint}</p>}
    </div>
  )
}

/** On/off switch. */
export function Toggle({ on, onChange, disabled, label: aria }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={aria}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn('relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:opacity-50', on ? 'border-volt bg-volt' : 'border-line-strong bg-steel')}
    >
      <span className={cn('absolute top-0.5 size-[22px] rounded-full bg-white shadow transition-[left]', on ? 'left-[22px]' : 'left-0.5')} />
    </button>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-line-strong px-4 py-10 text-center text-sm text-muted">{children}</p>
}

/** Simple confirm dialog. */
export function Confirm({ open, title, body, confirm, danger, onClose, onConfirm }: { open: boolean; title: string; body?: ReactNode; confirm: string; danger?: boolean; onClose: () => void; onConfirm: () => void }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90] grid place-items-center bg-ink/80 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div role="dialog" aria-modal="true" className="panel w-full max-w-md bg-abyss p-6" initial={{ y: 12, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 12, opacity: 0 }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold">{title}</h3>
            {body && <div className="mt-2 text-sm leading-relaxed text-muted">{body}</div>}
            <div className="mt-6 flex justify-end gap-2">
              <button type="button" className={btnGhost} onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className={danger ? cn(btn, 'bg-danger text-white hover:opacity-90') : btnPrimary}
                onClick={() => {
                  onConfirm()
                  onClose()
                }}
              >
                {confirm}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function Toasts() {
  const t = useToast()
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[100] flex justify-center px-4 lg:bottom-6">
      <AnimatePresence>
        {t && (
          <motion.p key={t.id} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }} className="rounded-lg border border-line-strong bg-abyss/95 px-4 py-3 text-sm text-fg shadow-2xl backdrop-blur">
            {t.text}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ───────── hash router: #/inicio, #/mensajes … ───────── */

export function useRoute(fallback: string) {
  const read = () => location.hash.replace(/^#\/?/, '').split('?')[0] || fallback
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return route
}
