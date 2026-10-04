import { motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react'
import { useRef } from 'react'
import { railSections } from '@/data/navigation'
import { useActiveSection } from '@/hooks/useActiveSection'
import { cn, pad, scrollToId } from '@/lib/utils'

const ids = railSections.map((s) => s.id)

/**
 * The page "spine": a fixed circuit line on the left edge that fills as you
 * scroll, with a node per section. It is the visual thread that connects the
 * whole experience. Wide desktop only (≥1440px) so it never overlaps content.
 */
export function ScrollRail() {
  const { scrollYProgress } = useScroll()
  const fill = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 })
  const active = useActiveSection(ids)
  const readout = useRef<HTMLSpanElement>(null)
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (readout.current) readout.current.textContent = pad(Math.round(v * 100), 3)
  })
  const activeIndex = ids.indexOf(active as (typeof ids)[number])

  return (
    <nav aria-label="Section progress" className="fixed top-1/2 left-6 z-40 hidden -translate-y-1/2 min-[1440px]:block">
      <div className="relative flex flex-col items-start gap-[18px] py-2">
        <span className="absolute top-0 bottom-0 left-[4px] w-px bg-line" />
        <motion.span className="absolute top-0 bottom-0 left-[4px] w-px origin-top bg-gradient-to-b from-cyan to-volt" style={{ scaleY: fill }} />
        {railSections.map((s, i) => {
          const on = i === activeIndex
          const passed = i < activeIndex
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollToId(s.id)}
              className="group relative flex items-center gap-3"
              aria-label={`Go to ${s.label}`}
              aria-current={on ? 'true' : undefined}
            >
              <span
                className={cn(
                  'relative z-10 block size-[9px] rotate-45 border transition-all duration-500',
                  on ? 'scale-125 border-cyan bg-cyan shadow-[0_0_12px_rgb(82_211_255)]' : passed ? 'border-volt bg-volt/70' : 'border-line-strong bg-ink',
                )}
              />
              <span
                className={cn(
                  'hud !text-[9.5px] whitespace-nowrap transition-all duration-300',
                  on ? 'translate-x-0 text-cyan opacity-100' : '-translate-x-1 text-muted opacity-0 group-hover:translate-x-0 group-hover:opacity-100',
                )}
              >
                {pad(i)} {s.label}
              </span>
            </button>
          )
        })}
      </div>
      <div className="hud mt-4 !text-[9px] text-dim">
        SYS <span ref={readout} className="text-muted">000</span>%
      </div>
    </nav>
  )
}
