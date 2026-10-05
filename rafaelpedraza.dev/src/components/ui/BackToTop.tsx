import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring } from 'motion/react'
import { ArrowUp } from 'lucide-react'
import { useState } from 'react'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'

const R = 19 // ring radius inside the 44px button

/**
 * "Back to top" button stacked above the music button (bottom-right dock).
 * Appears once the visitor is past the hero; the ring around the arrow fills with
 * the page progress — the same idea as the progress rail on the left.
 */
export function BackToTop() {
  const t = useT()
  const reduce = useReducedMotion()
  const { scrollY, scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 })
  const [show, setShow] = useState(false)

  useMotionValueEvent(scrollY, 'change', (y) => setShow(y > window.innerHeight * 0.9))

  const toTop = () => {
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    // move keyboard focus back to the start of the page as well
    document.querySelector<HTMLElement>('header a, header button')?.focus({ preventScroll: true })
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          type="button"
          onClick={toTop}
          aria-label={t(ui.backToTop)}
          title={t(ui.backToTop)}
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.9 }}
          transition={{ duration: 0.25 }}
          className="group relative grid size-11 place-items-center rounded-full border border-line-strong bg-ink/85 text-fg backdrop-blur-md transition-colors duration-300 hover:border-cyan/50 hover:text-cyan"
        >
          <svg aria-hidden viewBox="0 0 44 44" className="absolute inset-0 size-full -rotate-90">
            <circle cx="22" cy="22" r={R} fill="none" stroke="rgb(120 165 230 / 0.14)" strokeWidth="1.5" />
            <motion.circle cx="22" cy="22" r={R} fill="none" stroke="url(#btt-grad)" strokeWidth="1.5" strokeLinecap="round" style={{ pathLength: progress }} />
            <defs>
              <linearGradient id="btt-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#52d3ff" />
                <stop offset="100%" stopColor="#2f8cff" />
              </linearGradient>
            </defs>
          </svg>
          <ArrowUp size={17} strokeWidth={1.75} className="relative transition-transform duration-300 group-hover:-translate-y-0.5" />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
