import { AnimatePresence, motion } from 'motion/react'
import { useVisits } from '@/hooks/useVisits'
import { AnimatedCounter } from '@/components/animations/AnimatedCounter'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { cn } from '@/lib/utils'

/** HUD-style live visit counter. Renders nothing until the API answers. */
export function VisitCounter({ className, compact = false }: { className?: string; compact?: boolean }) {
  const t = useT()
  const count = useVisits()
  return (
    <AnimatePresence>
      {count !== null && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn('inline-flex items-center gap-2.5', !compact && 'rounded-md border border-line bg-navy/40 px-3 py-2', className)}
          aria-label={`${t(ui.visits)}: ${count}`}
        >
          <span className="relative flex size-1.5">
            <span className="absolute inset-0 rounded-full bg-ok animate-pulse-ring" />
            <span className="relative size-1.5 rounded-full bg-ok" />
          </span>
          <span className="hud !text-[9.5px] text-dim">{t(ui.visits)}</span>
          <AnimatedCounter to={count} pad={6} className="font-mono text-[12px] tracking-[0.14em] text-fg" />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
