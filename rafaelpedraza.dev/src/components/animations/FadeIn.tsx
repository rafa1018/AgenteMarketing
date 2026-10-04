import { motion, type HTMLMotionProps } from 'motion/react'
import { EASE_OUT } from '@/lib/utils'

type Direction = 'up' | 'down' | 'left' | 'right' | 'none'

interface FadeInProps extends HTMLMotionProps<'div'> {
  delay?: number
  duration?: number
  direction?: Direction
  distance?: number
  once?: boolean
  amount?: number
}

const offset = (d: Direction, n: number) =>
  d === 'up' ? { y: n } : d === 'down' ? { y: -n } : d === 'left' ? { x: n } : d === 'right' ? { x: -n } : {}

/** Viewport-triggered fade + slide. Transform/opacity only. */
export function FadeIn({ delay = 0, duration = 0.8, direction = 'up', distance = 28, once = true, amount = 0.25, children, ...rest }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, ...offset(direction, distance) }}
      whileInView={{ opacity: 1, x: 0, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration, delay, ease: EASE_OUT }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
