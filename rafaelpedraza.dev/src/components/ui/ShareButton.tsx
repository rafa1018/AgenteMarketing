import { AnimatePresence, motion } from 'motion/react'
import { Check, Link2, Mail, Share2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode, type SVGProps } from 'react'
import { profile } from '@/data/profile'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { LinkedinIcon } from './BrandIcons'
import { cn } from '@/lib/utils'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }
const brand = (d: string) =>
  function Icon({ size = 16, ...p }: IconProps) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden {...p}>
        <path d={d} />
      </svg>
    )
  }
const XIcon = brand('M18.9 2H22l-7.2 8.2L23 22h-6.6l-5.2-6.8L5.3 22H2.2l7.7-8.8L1.8 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.7L7.4 3.9H5.6L17.7 20Z')
const FacebookIcon = brand('M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.5c0-.9.3-1.6 1.6-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.2h2.8V22h3.4Z')
const TelegramIcon = brand('M21.9 4.3 18.7 19.4c-.2 1-.9 1.3-1.7.8l-4.8-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.4-.1-.6-.6-.2l-11 6.9L1.8 11.7c-1-.3-1-1 .2-1.5L20.6 3c.9-.3 1.6.2 1.3 1.3Z')
const WhatsappIcon = brand(
  'M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35ZM12.05 21.5a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.56.93.95-3.47-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.43-9.43a9.4 9.4 0 0 1 9.43 9.44c0 5.2-4.23 9.42-9.44 9.42Zm8.02-17.45A11.3 11.3 0 0 0 12.05.73C5.8.73.72 5.8.72 12.05c0 2 .52 3.95 1.52 5.66L.62 23.27l5.7-1.5a11.3 11.3 0 0 0 5.72 1.46c6.25 0 11.33-5.08 11.33-11.33 0-3.03-1.18-5.87-3.31-8.02Z',
)

/** Always share the public URL (never localhost or a #hash). */
const SHARE_URL = profile.siteUrl.endsWith('/') ? profile.siteUrl : `${profile.siteUrl}/`

function targets(text: string, title: string) {
  const u = encodeURIComponent(SHARE_URL)
  const tx = encodeURIComponent(text)
  return [
    { id: 'linkedin', label: 'LinkedIn', icon: LinkedinIcon, color: '#0a66c2', href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { id: 'whatsapp', label: 'WhatsApp', icon: WhatsappIcon, color: '#25d366', href: `https://wa.me/?text=${encodeURIComponent(`${text} ${SHARE_URL}`)}` },
    { id: 'x', label: 'X', icon: XIcon, color: '#e7e9ea', href: `https://twitter.com/intent/tweet?text=${tx}&url=${u}` },
    { id: 'facebook', label: 'Facebook', icon: FacebookIcon, color: '#1877f2', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { id: 'telegram', label: 'Telegram', icon: TelegramIcon, color: '#29a9eb', href: `https://t.me/share/url?url=${u}&text=${tx}` },
    { id: 'email', label: 'Email', icon: Mail, color: '#8797b0', href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n${SHARE_URL}`)}` },
  ] as const
}

interface ShareButtonProps {
  /** 'icon' = compact square (navbar), 'button' = labelled pill */
  variant?: 'icon' | 'button'
  /** where the menu opens */
  placement?: 'down' | 'up'
  align?: 'left' | 'right'
  className?: string
  children?: ReactNode
}

/**
 * Share this site. Uses the native share sheet on phones (Web Share API) and a
 * menu of networks + "copy link" on desktop.
 */
export function ShareButton({ variant = 'button', placement = 'down', align = 'right', className, children }: ShareButtonProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const text = t(ui.share.text)
  const title = t(ui.share.subject)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const onClick = async () => {
    const touch = window.matchMedia('(pointer: coarse)').matches
    if (touch && typeof navigator.share === 'function') {
      try {
        await navigator.share({ title, text, url: SHARE_URL })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return // user closed the sheet
      }
    }
    setOpen((o) => !o)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        type="button"
        onClick={onClick}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t(ui.share.button)}
        title={t(ui.share.button)}
        className={cn(
          'inline-flex items-center justify-center gap-2 border font-mono uppercase transition-colors',
          variant === 'icon'
            ? 'size-9 rounded-md border-line text-fg hover:border-cyan/60 hover:text-cyan'
            : 'h-11 rounded-lg border-line-strong px-4 text-[11px] tracking-[0.18em] text-fg hover:border-cyan/60 hover:text-white',
        )}
      >
        <Share2 size={variant === 'icon' ? 15 : 16} strokeWidth={1.75} />
        {variant === 'button' && (children ?? t(ui.share.button))}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: placement === 'down' ? -6 : 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: placement === 'down' ? -6 : 6, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'absolute z-[70] w-64 rounded-xl border border-line-strong bg-abyss/95 p-2 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-xl',
              placement === 'down' ? 'top-full mt-2' : 'bottom-full mb-2',
              align === 'right' ? 'right-0' : 'left-0',
            )}
          >
            <p className="hud px-2 pt-1 pb-2 !text-[9.5px] text-dim">{t(ui.share.title)}</p>
            <div className="grid grid-cols-3 gap-1">
              {targets(text, title).map((s) => (
                <a
                  key={s.id}
                  role="menuitem"
                  href={s.href}
                  target={s.id === 'email' ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="group flex flex-col items-center gap-1.5 rounded-lg px-1 py-2.5 transition-colors hover:bg-white/[0.06]"
                >
                  <span className="grid size-9 place-items-center rounded-full border border-line bg-ink/70 transition-transform duration-200 group-hover:scale-110" style={{ color: s.color }}>
                    <s.icon size={16} />
                  </span>
                  <span className="text-[11px] text-muted group-hover:text-fg">{s.label}</span>
                </a>
              ))}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={copy}
              className="mt-1 flex w-full items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-left transition-colors hover:border-cyan/50"
            >
              <span className="truncate font-mono text-[11px] text-muted">{SHARE_URL.replace('https://', '')}</span>
              <span className={cn('flex shrink-0 items-center gap-1 text-[11px] font-medium', copied ? 'text-ok' : 'text-cyan')}>
                {copied ? <Check size={13} /> : <Link2 size={13} />}
                {copied ? t(ui.share.copied) : t(ui.share.copy)}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
