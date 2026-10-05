import { AnimatePresence, motion } from 'motion/react'
import { ChevronsDown, Pause } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSite } from '@/hooks/useSite'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { cn } from '@/lib/utils'

/** Reading speeds in CSS px per second. */
const SPEEDS = [
  { label: '1.5×', pxs: 105 },
  { label: '2×', pxs: 140 },
  { label: '2.5×', pxs: 175 },
  { label: '3×', pxs: 210 },
  { label: '3.5×', pxs: 245 },
]
const DEFAULT_SPEED = 0 // 1.5×
// v2: the list changed, so a speed remembered from the old list is ignored
const SPEED_KEY = 'rp-autoscroll-speed-v2'

const readSpeed = () => {
  try {
    const v = localStorage.getItem(SPEED_KEY)
    const i = Number(v)
    return v !== null && Number.isInteger(i) && i >= 0 && i < SPEEDS.length ? i : DEFAULT_SPEED
  } catch {
    return DEFAULT_SPEED
  }
}

/**
 * "Auto tour": the page scrolls down by itself at a reading pace, so on a phone the
 * visitor can watch the scroll animations without swiping. Never starts on its own;
 * stops as soon as the visitor touches, scrolls, uses the keyboard, leaves the tab or reaches the end.
 * Can be hidden from the admin panel (Ajustes).
 */
export function AutoScroll({ visible }: { visible: boolean }) {
  const t = useT()
  const enabled = useSite()?.autoScroll ?? false
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(readSpeed)
  const [atEnd, setAtEnd] = useState(false)
  const speedRef = useRef(SPEEDS[speed].pxs)
  speedRef.current = SPEEDS[speed].pxs
  const root = useRef<HTMLDivElement>(null)

  // hide the button at the very bottom of the page (nothing left to scroll)
  useEffect(() => {
    const check = () => setAtEnd(window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4)
    check()
    window.addEventListener('scroll', check, { passive: true })
    window.addEventListener('resize', check)
    return () => {
      window.removeEventListener('scroll', check)
      window.removeEventListener('resize', check)
    }
  }, [])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let pos = window.scrollY // fractional position: slow speeds move less than 1px per frame

    const stop = () => setPlaying(false)
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      pos += speedRef.current * dt
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (pos >= max) {
        window.scrollTo({ top: max, behavior: 'instant' })
        return stop()
      }
      window.scrollTo({ top: pos, behavior: 'instant' })
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    // any sign that the visitor wants control back stops the tour (clicks on the tour buttons excepted)
    const onUser = (e: Event) => {
      if (e.target instanceof Node && root.current?.contains(e.target)) return
      stop()
    }
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Escape'].includes(e.key)) stop()
    }
    const onHide = () => document.hidden && stop()
    window.addEventListener('wheel', onUser, { passive: true })
    window.addEventListener('touchstart', onUser, { passive: true })
    window.addEventListener('pointerdown', onUser)
    window.addEventListener('keydown', onKey)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('wheel', onUser)
      window.removeEventListener('touchstart', onUser)
      window.removeEventListener('pointerdown', onUser)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('visibilitychange', onHide)
    }
  }, [playing])

  const cycleSpeed = () => {
    const next = (speed + 1) % SPEEDS.length
    setSpeed(next)
    try {
      localStorage.setItem(SPEED_KEY, String(next))
    } catch {
      /* ignore */
    }
  }

  if (!enabled) return null
  const show = visible && (!atEnd || playing)

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          ref={root}
          className="flex items-center gap-2"
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.9 }}
          transition={{ duration: 0.25 }}
        >
          <AnimatePresence>
            {playing && (
              <motion.button
                type="button"
                onClick={cycleSpeed}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                aria-label={`${t(ui.autoScroll.speed)}: ${SPEEDS[speed].label}`}
                title={t(ui.autoScroll.speed)}
                className="flex h-9 min-w-12 items-center justify-center rounded-full border border-line bg-ink/85 px-3 font-mono text-[11px] text-cyan backdrop-blur-md"
              >
                {SPEEDS[speed].label}
              </motion.button>
            )}
          </AnimatePresence>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            aria-pressed={playing}
            aria-label={playing ? t(ui.autoScroll.stop) : t(ui.autoScroll.start)}
            title={playing ? t(ui.autoScroll.stop) : t(ui.autoScroll.start)}
            className={cn(
              'grid size-11 place-items-center rounded-full border bg-ink/85 backdrop-blur-md transition-colors duration-300',
              playing ? 'border-cyan/50 text-cyan shadow-[0_0_30px_-8px_rgb(82_211_255/0.6)]' : 'border-line-strong text-fg hover:border-cyan/50 hover:text-cyan',
            )}
          >
            {playing ? <Pause size={16} strokeWidth={1.75} /> : <ChevronsDown size={18} strokeWidth={1.75} className="animate-bounce [animation-duration:2s]" />}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
