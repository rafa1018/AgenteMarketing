import { motion } from 'motion/react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TechNodeProps {
  label: string
  icon?: LucideIcon
  active?: boolean
  size?: 'sm' | 'md'
  className?: string
}

/** A small HUD node: status dot + icon + label. Used in the hero orbit, AI core and stack. */
export function TechNode({ label, icon: Icon, active = false, size = 'sm', className }: TechNodeProps) {
  return (
    <motion.span
      className={cn(
        'inline-flex items-center gap-2 rounded-md border bg-ink/70 backdrop-blur-sm transition-colors duration-500',
        size === 'sm' ? 'px-2 py-1 text-[10px]' : 'px-3 py-1.5 text-xs',
        active ? 'border-cyan/50 text-fg shadow-[0_0_24px_-6px_rgb(82_211_255/0.6)]' : 'border-line text-muted',
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full transition-colors duration-500', active ? 'bg-cyan' : 'bg-dim')} />
      {Icon && <Icon className="size-3.5 shrink-0" strokeWidth={1.6} />}
      <span className="font-mono tracking-[0.14em] uppercase">{label}</span>
    </motion.span>
  )
}
