import type { ComponentType, ReactNode, MouseEvent } from 'react'
import { MagneticButton } from '@/components/animations/MagneticButton'
import { cn, isPlaceholder } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps {
  children: ReactNode
  href?: string
  onClick?: (e: MouseEvent) => void
  variant?: Variant
  icon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
  iconRight?: boolean
  download?: boolean | string
  external?: boolean
  className?: string
  magnetic?: boolean
  ariaLabel?: string
}

const styles: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-[#3b95ff] to-[#1f6fe0] text-white shadow-[0_0_0_1px_rgb(120_180_255/0.5),0_10px_40px_-10px_rgb(47_140_255/0.8)] hover:shadow-[0_0_0_1px_rgb(150_200_255/0.8),0_12px_50px_-8px_rgb(47_140_255/0.95)]',
  secondary: 'border border-line-strong bg-navy/40 text-fg hover:border-cyan/60 hover:bg-navy/70 hover:text-white',
  ghost: 'text-muted hover:text-fg',
}

/**
 * Link/button with HUD styling. Placeholder hrefs (e.g. "[ADD GITHUB URL]")
 * render as a non-interactive "pending" pill — never a broken link.
 */
export function Button({ children, href, onClick, variant = 'primary', icon: Icon, iconRight, download, external, className, magnetic = true, ariaLabel }: ButtonProps) {
  const base = cn(
    'group relative inline-flex h-12 items-center justify-center gap-2.5 overflow-hidden rounded-lg px-5 font-mono text-[11.5px] font-medium tracking-[0.18em] uppercase transition-[box-shadow,background-color,border-color,color] duration-300 select-none',
    styles[variant],
    className,
  )
  const content = (
    <>
      {variant === 'primary' && (
        <span aria-hidden className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" />
      )}
      {Icon && !iconRight && <Icon size={16} strokeWidth={1.75} className="relative transition-transform duration-300 group-hover:-translate-y-px" />}
      <span className="relative">{children}</span>
      {Icon && iconRight && <Icon size={16} strokeWidth={1.75} className="relative transition-transform duration-300 group-hover:translate-x-0.5" />}
    </>
  )

  let el: ReactNode
  if (href !== undefined && isPlaceholder(href)) {
    el = (
      <span className={cn(base, '!cursor-not-allowed border border-dashed border-line-strong !bg-transparent !text-dim !shadow-none')} title={`Pending: ${href}`} aria-disabled="true">
        {Icon && <Icon size={16} strokeWidth={1.75} />}
        <span>{children}</span>
      </span>
    )
  } else if (href !== undefined) {
    el = (
      <a
        href={href}
        className={base}
        onClick={onClick}
        aria-label={ariaLabel}
        download={download === true ? '' : download || undefined}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        data-cursor="hover"
      >
        {content}
      </a>
    )
  } else {
    el = (
      <button type="button" className={base} onClick={onClick} aria-label={ariaLabel} data-cursor="hover">
        {content}
      </button>
    )
  }
  return magnetic ? <MagneticButton>{el}</MagneticButton> : el
}
