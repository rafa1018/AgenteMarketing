import { animate, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'

interface AnimatedCounterProps {
  to: number
  from?: number
  duration?: number
  suffix?: string
  pad?: number
  className?: string
}

/** Counts up once when visible. Writes to textContent directly — zero React re-renders per frame. */
export function AnimatedCounter({ to, from = 0, duration = 1.6, suffix = '', pad = 2, className }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reduce = useReducedMotion()
  const format = (v: number) => String(Math.round(v)).padStart(pad, '0') + suffix

  useEffect(() => {
    const el = ref.current
    if (!el || !inView) return
    if (reduce) {
      el.textContent = format(to)
      return
    }
    const controls = animate(from, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => (el.textContent = format(v)),
    })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, to])

  return (
    <span ref={ref} className={className} aria-label={`${to}${suffix}`}>
      {format(from)}
    </span>
  )
}
