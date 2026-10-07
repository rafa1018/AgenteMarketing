import { motion } from 'motion/react'
import type { ElementType } from 'react'
import { EASE_OUT, cn } from '@/lib/utils'

interface RevealTextProps {
  text: string
  as?: ElementType
  className?: string
  wordClassName?: string
  delay?: number
  stagger?: number
  /** 'view' animates when scrolled into view, 'mount' (or a boolean) animates immediately / on demand */
  trigger?: 'view' | 'mount' | boolean
}

/** Word-by-word masked reveal. Screen readers get the full sentence once. */
export function RevealText({ text, as: Tag = 'span', className, wordClassName, delay = 0, stagger = 0.06, trigger = 'view' }: RevealTextProps) {
  const words = text.split(' ')
  const container = {
    hidden: {},
    show: { transition: { staggerChildren: stagger, delayChildren: delay } },
  }
  const word = {
    hidden: { y: '110%', opacity: 0 },
    show: { y: '0%', opacity: 1, transition: { duration: 0.9, ease: EASE_OUT } },
  }
  const animateProps =
    trigger === 'view'
      ? { whileInView: 'show', viewport: { once: true, amount: 0.5 } }
      : { animate: trigger === 'mount' || trigger === true ? 'show' : 'hidden' }

  return (
    <Tag className={className} aria-label={text}>
      <motion.span aria-hidden className="inline" variants={container} initial="hidden" {...animateProps}>
        {words.map((w, i) => (
          <span key={i} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
            <motion.span className={cn('inline-block will-change-transform', wordClassName)} variants={word}>
              {w}
              {i < words.length - 1 ? ' ' : ''}
            </motion.span>
          </span>
        ))}
      </motion.span>
    </Tag>
  )
}
