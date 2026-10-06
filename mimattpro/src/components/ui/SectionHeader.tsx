import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { RevealText } from '@/components/animations/RevealText'
import { EASE_OUT, cn } from '@/lib/utils'

interface SectionHeaderProps {
  index: string
  kicker: string
  title: string
  description?: ReactNode
  align?: 'left' | 'center'
  className?: string
}

/** Consistent HUD-style section heading: [index] ── KICKER, then a masked title reveal. */
export function SectionHeader({ index, kicker, title, description, align = 'left', className }: SectionHeaderProps) {
  const center = align === 'center'
  return (
    <header className={cn('relative mb-12 sm:mb-16', center && 'text-center', className)}>
      <div className={cn('mb-5 flex items-center gap-3', center && 'justify-center')}>
        <span className="hud text-cyan">[{index}]</span>
        <motion.span
          aria-hidden
          className="h-px w-14 origin-left bg-gradient-to-r from-cyan to-volt/0"
          initial={{ scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.9, ease: EASE_OUT }}
        />
        <span className="hud text-muted">{kicker}</span>
      </div>
      <RevealText
        key={title}
        as="h2"
        text={title}
        className="font-display text-[clamp(2.1rem,6vw,4.6rem)] leading-[0.98] font-semibold tracking-[-0.035em] text-fg"
      />
      {description && (
        <motion.div
          className={cn('mt-6 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-base', center && 'mx-auto')}
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.25, ease: EASE_OUT }}
        >
          {description}
        </motion.div>
      )}
    </header>
  )
}
