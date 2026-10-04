import { motion, type HTMLMotionProps, type Variants } from 'motion/react'
import { EASE_OUT } from '@/lib/utils'

interface ScrollRevealProps extends HTMLMotionProps<'div'> {
  stagger?: number
  delay?: number
  amount?: number
}

/** Stagger container: children using <RevealItem> animate in sequence when the group enters the viewport. */
export function ScrollReveal({ stagger = 0.08, delay = 0, amount = 0.15, children, ...rest }: ScrollRevealProps) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: stagger, delayChildren: delay } } }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

export const revealItem: Variants = {
  hidden: { opacity: 0, y: 24, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: EASE_OUT } },
}

export function RevealItem({ children, ...rest }: HTMLMotionProps<'div'>) {
  return (
    <motion.div variants={revealItem} {...rest}>
      {children}
    </motion.div>
  )
}
