import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose: () => void
  label: string
  closeLabel: string
  children: ReactNode
  className?: string
  /** 'sheet' = card dialog, 'bare' = full-screen dark backdrop (lightbox) */
  variant?: 'sheet' | 'bare'
}

/** Open dialogs, innermost last — only the top one reacts to Escape / Tab when dialogs are stacked. */
const stack: object[] = []

/** Accessible dialog: Escape closes, focus moves in and returns, page scroll is locked. */
export function Modal({ open, onClose, label, closeLabel, children, className, variant = 'sheet' }: ModalProps) {
  const panel = useRef<HTMLDivElement>(null)
  // callers usually pass a new arrow function on every render: keep the latest one in a ref so the effect
  // below runs only when the dialog opens/closes (otherwise each keystroke re-ran it and moved the focus
  // to the close button)
  const close = useRef(onClose)
  close.current = onClose

  useEffect(() => {
    if (!open) return
    const token = {}
    stack.push(token)
    const prev = document.activeElement as HTMLElement | null
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== token) return
      if (e.key === 'Escape') close.current()
      if (e.key === 'Tab' && panel.current) {
        const f = panel.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])')
        if (!f.length) return
        const first = f[0]
        const last = f[f.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus())
    return () => {
      window.removeEventListener('keydown', onKey)
      stack.splice(stack.indexOf(token), 1)
      document.body.style.overflow = overflow
      prev?.focus?.()
    }
  }, [open])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className={cn('fixed inset-0 z-[90] flex justify-center', variant === 'bare' ? 'items-center p-3 sm:p-6' : 'items-end sm:items-center sm:p-6')}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          <div className={cn('absolute inset-0', variant === 'bare' ? 'bg-ink/90' : 'bg-ink/55 backdrop-blur-sm')} onClick={onClose} aria-hidden />
          <motion.div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            initial={variant === 'sheet' ? { y: 60, opacity: 0, scale: 0.98 } : { scale: 0.94, opacity: 0 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={variant === 'sheet' ? { y: 40, opacity: 0 } : { scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className={cn('relative', variant === 'sheet' && 'max-h-[92svh] w-full overflow-y-auto rounded-t-2xl bg-white sm:max-w-2xl sm:rounded-2xl', className)}
          >
            <button
              type="button"
              data-autofocus
              onClick={onClose}
              aria-label={closeLabel}
              className={cn(
                'absolute top-3 right-3 z-10 grid size-11 place-items-center rounded-lg transition-colors',
                variant === 'bare' ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-white/90 text-ink shadow-md hover:bg-paper',
              )}
            >
              <X size={22} strokeWidth={2.5} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
