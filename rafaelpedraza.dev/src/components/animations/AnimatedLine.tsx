import { motion, type MotionValue } from 'motion/react'
import type { SVGProps } from 'react'
import { EASE_OUT } from '@/lib/utils'

interface AnimatedLineProps extends Omit<SVGProps<SVGPathElement>, 'ref' | 'onAnimationStart' | 'onDrag' | 'onDragStart' | 'onDragEnd' | 'style'> {
  d: string
  /** Scroll-linked progress (0–1). When omitted the line draws itself on enter. */
  progress?: MotionValue<number>
  delay?: number
  duration?: number
}

/** An SVG path that "draws" itself — either on viewport entry or bound to scroll progress. */
export function AnimatedLine({ d, progress, delay = 0, duration = 1.4, ...rest }: AnimatedLineProps) {
  if (progress) {
    return <motion.path d={d} fill="none" style={{ pathLength: progress }} {...(rest as object)} />
  }
  return (
    <motion.path
      d={d}
      fill="none"
      initial={{ pathLength: 0, opacity: 0 }}
      whileInView={{ pathLength: 1, opacity: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ pathLength: { duration, delay, ease: EASE_OUT }, opacity: { duration: 0.2, delay } }}
      {...(rest as object)}
    />
  )
}
