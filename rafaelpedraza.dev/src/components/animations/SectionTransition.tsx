import { motion, useScroll, useSpring, useTransform } from 'motion/react'
import { useRef } from 'react'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'

interface SectionTransitionProps {
  /** Label of the next section, e.g. "EXPERIENCE" */
  next: string
  index: string
}

/**
 * A circuit trace that connects one section to the next. The trace draws
 * itself as you scroll through it, and the node lights when reached — the
 * page reads as one continuous system instead of stacked blocks.
 */
export function SectionTransition({ next, index }: SectionTransitionProps) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.9', 'end 0.45'] })
  const p = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })
  const top = useTransform(p, [0, 0.5], [0, 1])
  const bottom = useTransform(p, [0.5, 1], [0, 1])
  const nodeOn = useTransform(p, [0.42, 0.52], [0, 1])
  const nodeScale = useTransform(nodeOn, [0, 1], [0.6, 1])

  return (
    <div ref={ref} aria-hidden className="relative mx-auto flex h-36 w-full max-w-[1240px] justify-center sm:h-44">
      <svg className="absolute inset-y-0 left-1/2 h-full w-[220px] -translate-x-1/2 overflow-visible" viewBox="0 0 220 176" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`st-${index}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2f8cff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#52d3ff" />
            <stop offset="1" stopColor="#2f8cff" stopOpacity="0.1" />
          </linearGradient>
        </defs>
        <path d="M110 0 V176" stroke="rgb(120 165 230 / 0.12)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <motion.path d="M110 0 V80" stroke={`url(#st-${index})`} strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" style={{ pathLength: top }} />
        <motion.path d="M110 96 V176" stroke="#2f8cff" strokeOpacity="0.6" strokeWidth="1.5" fill="none" vectorEffect="non-scaling-stroke" style={{ pathLength: bottom }} />
      </svg>
      <motion.div
        className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center"
        style={{ opacity: useTransform(nodeOn, [0, 1], [0.35, 1]) }}
      >
        <motion.span
          className="relative block size-3 rotate-45 border border-cyan bg-ink"
          style={{ scale: nodeScale, boxShadow: '0 0 18px rgb(82 211 255 / 0.55)' }}
        />
        <span className="hud absolute top-6 left-1/2 -translate-x-1/2 !text-[9.5px] whitespace-nowrap text-muted sm:top-auto sm:left-6 sm:translate-x-0 sm:!text-[10px]">
          <span className="text-cyan">{index}</span> · {t(ui.link)} → {next}
        </span>
      </motion.div>
    </div>
  )
}
