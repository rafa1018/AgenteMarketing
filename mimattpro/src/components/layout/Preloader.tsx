import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'

const DURATION = 2200 // ms of the loading bar

/**
 * Page preloader: the wolf logo lights up, "MiMatt PRO" reveals and a gold bar loads.
 * Skippable (button, click or any key). Not rendered for reduced motion (see App).
 */
export function Preloader({ onDone }: { onDone: () => void }) {
  const t = useT()
  const [leaving, setLeaving] = useState(false)
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / DURATION)
      setPct(Math.round(100 * (1 - Math.pow(1 - p, 2))))
      if (p < 1) raf = requestAnimationFrame(tick)
      else setLeaving(true)
    }
    raf = requestAnimationFrame(tick)
    const skip = () => setLeaving(true)
    window.addEventListener('keydown', skip)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', skip)
    }
  }, [])

  useEffect(() => {
    document.documentElement.style.overflow = leaving ? '' : 'hidden'
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [leaving])

  return (
    <AnimatePresence onExitComplete={onDone}>
      {!leaving && (
        <motion.div
          key="preloader"
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-ink"
          exit={{ opacity: 0, scale: 1.04, filter: 'blur(6px)' }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          onClick={() => setLeaving(true)}
        >
          <div aria-hidden className="grid-bg absolute inset-0 opacity-60 [mask-image:radial-gradient(circle_at_center,black_10%,transparent_60%)]" />

          {/* logo with rotating gold ring */}
          <div className="relative grid size-44 place-items-center sm:size-52">
            <svg viewBox="0 0 200 200" className="absolute inset-0 size-full" aria-hidden>
              <circle cx="100" cy="100" r="92" fill="none" stroke="rgb(var(--brand-1-rgb) / 0.12)" strokeWidth="1.5" />
              <motion.circle
                cx="100"
                cy="100"
                r="92"
                fill="none"
                stroke="url(#pre-gold)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="120 460"
                animate={{ rotate: 360 }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
                style={{ transformOrigin: '100px 100px' }}
              />
              <defs>
                <linearGradient id="pre-gold" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--brand-hi)" />
                  <stop offset="100%" stopColor="var(--brand-3)" />
                </linearGradient>
              </defs>
            </svg>
            <motion.div aria-hidden className="absolute inset-6 rounded-full bg-[radial-gradient(closest-side,rgb(var(--brand-rgb)/0.35),transparent)]" animate={{ opacity: [0.5, 1, 0.5], scale: [0.95, 1.05, 0.95] }} transition={{ duration: 1.8, repeat: Infinity }} />
            <motion.img
              src="/images/logo-256.webp"
              alt="MiMatt PRO"
              className="relative size-28 drop-shadow-[0_10px_30px_rgb(var(--brand-rgb)/0.45)] sm:size-32"
              initial={{ opacity: 0, scale: 0.6, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>

          <motion.p
            className="relative mt-8 font-display text-4xl font-semibold tracking-tight sm:text-5xl"
            initial={{ opacity: 0, y: 14, letterSpacing: '0.2em' }}
            animate={{ opacity: 1, y: 0, letterSpacing: '-0.02em' }}
            transition={{ duration: 1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="text-silver">MiMatt</span> <span className="text-gold">PRO</span>
          </motion.p>
          <motion.p className="relative mt-2 font-mono text-[11px] tracking-[0.3em] text-muted uppercase" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
            Futures Intelligence
          </motion.p>

          {/* loading bar */}
          <div className="relative mt-10 w-56 sm:w-64">
            <div className="h-[3px] overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-[var(--brand-3)] via-[var(--brand-1)] to-[var(--brand-hi)] shadow-[0_0_12px_rgb(var(--brand-1-rgb)/0.8)]" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[10px] tracking-[0.18em] text-dim uppercase">
              <span>{t(ui.preloader.loading)}</span>
              <span className="text-cyan tabular-nums">{pct}%</span>
            </div>
          </div>

          <button type="button" onClick={() => setLeaving(true)} className="absolute right-6 bottom-6 font-mono text-[10.5px] tracking-[0.2em] text-dim uppercase transition-colors hover:text-cyan">
            {t(ui.preloader.skip)} →
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
