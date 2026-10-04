import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { LogoMark } from '@/components/ui/Logo'
import { EASE_OUT } from '@/lib/utils'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'

const LINES = ui.boot.lines.map((text, i) => ({ text, ok: i > 0 }))
const STEP = 260
const SESSION_KEY = 'rp-boot-seen'

// Read once at module load so StrictMode's double effect doesn't flip it.
const seenBefore = (() => {
  try {
    return sessionStorage.getItem(SESSION_KEY) === '1'
  } catch {
    return false
  }
})()

/**
 * Narrative "system" boot: a short, skippable sequence (~2.2s; ~1s on
 * repeat visits) that hands off to a clean professional interface.
 */
export function BootSequence({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(0)
  const [phase, setPhase] = useState<'log' | 'online' | 'exit'>('log')
  const [open, setOpen] = useState(true)
  const finished = useRef(false)
  const repeat = useRef(seenBefore)
  const t = useT()

  const finish = () => {
    if (finished.current) return
    finished.current = true
    setOpen(false)
  }

  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, '1')
    } catch {
      /* storage unavailable — play full sequence */
    }
    const step = repeat.current ? 90 : STEP
    const timers: number[] = []
    LINES.forEach((_, i) => timers.push(window.setTimeout(() => setShown(i + 1), 120 + i * step)))
    const tOnline = 120 + LINES.length * step + 120
    timers.push(window.setTimeout(() => setPhase('online'), tOnline))
    timers.push(window.setTimeout(() => setPhase('exit'), tOnline + (repeat.current ? 300 : 750)))
    timers.push(window.setTimeout(finish, tOnline + (repeat.current ? 400 : 900)))

    const skip = () => finish()
    window.addEventListener('keydown', skip)
    document.documentElement.style.overflow = 'hidden'
    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('keydown', skip)
      document.documentElement.style.overflow = ''
    }
  }, [])

  return (
    <AnimatePresence
      onExitComplete={() => {
        document.documentElement.style.overflow = ''
        onDone()
      }}
    >
      {open && (
        <motion.div
          key="boot"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-ink"
          initial={{ clipPath: 'inset(0% 0% 0% 0%)' }}
          exit={{ clipPath: 'inset(0% 0% 100% 0%)', transition: { duration: 0.9, ease: [0.76, 0, 0.24, 1] } }}
          onClick={finish}
          role="status"
          aria-live="polite"
        >
          <div className="grid-bg absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black,transparent_70%)]" />
          <div className="relative w-full max-w-xl px-6">
            <div className="mb-8 flex items-center gap-3">
              <LogoMark className="h-5" />
              <span className="hud text-dim">rafaelpedraza.dev · boot</span>
            </div>

            <AnimatePresence mode="wait">
              {phase === 'log' ? (
                <motion.ul key="log" className="space-y-2.5 font-mono text-[11px] tracking-[0.14em] sm:text-xs" exit={{ opacity: 0, y: -8, transition: { duration: 0.25 } }}>
                  {LINES.slice(0, shown).map((l, i) => (
                    <motion.li key={i} className="flex items-center gap-3" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }}>
                      <span className="text-dim">{String(i).padStart(2, '0')}</span>
                      <span className={i === LINES.length - 1 ? 'text-cyan' : 'text-fg/85'}>{t(l.text)}{i === LINES.length - 1 ? '.' : '...'}</span>
                      <span className="dotted-leader" />
                      <span className={l.ok ? 'text-ok' : 'text-volt animate-blink'}>{l.ok ? 'OK' : '▮'}</span>
                    </motion.li>
                  ))}
                </motion.ul>
              ) : (
                <motion.div key="online" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                  <motion.p className="hud text-muted" initial={{ letterSpacing: '0.6em', opacity: 0 }} animate={{ letterSpacing: '0.3em', opacity: 1 }} transition={{ duration: 0.8, ease: EASE_OUT }}>
                    {t(ui.boot.system)}
                  </motion.p>
                  <motion.p
                    className="mt-3 font-display text-5xl font-semibold tracking-[0.12em] text-gradient sm:text-6xl"
                    initial={{ opacity: 0, scale: 0.94, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.1 }}
                  >
                    ONLINE
                  </motion.p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-10 h-px w-full overflow-hidden bg-line">
              <motion.div
                className="h-full origin-left bg-gradient-to-r from-volt to-cyan"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: phase === 'log' ? shown / LINES.length : 1 }}
                transition={{ duration: 0.35 }}
              />
            </div>
            <div className="mt-3 flex justify-between">
              <span className="hud !text-[9.5px] text-dim">{phase === 'log' ? t(ui.boot.loading) : t(ui.boot.ready)}</span>
              <button type="button" onClick={finish} className="hud !text-[9.5px] text-muted transition-colors hover:text-cyan">
                {t(ui.boot.skip)}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
