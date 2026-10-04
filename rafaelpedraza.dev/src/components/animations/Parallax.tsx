import { motion, useReducedMotion, useScroll, useTransform, type HTMLMotionProps } from 'motion/react'
import { useRef } from 'react'

interface ParallaxProps extends HTMLMotionProps<'div'> {
  /** Pixels travelled across the element's pass through the viewport. Negative = moves up faster. */
  speed?: number
}

/** Scroll-linked vertical parallax driven by a MotionValue (no React re-renders). */
export function Parallax({ speed = 60, children, style, ...rest }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] })
  const y = useTransform(scrollYProgress, [0, 1], [speed, -speed])
  return (
    <motion.div ref={ref} style={{ ...style, y: reduce ? 0 : y }} {...rest}>
      {children}
    </motion.div>
  )
}
