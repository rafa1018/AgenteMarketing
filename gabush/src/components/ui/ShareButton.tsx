import { AnimatePresence, motion } from 'motion/react'
import { Check, Link2, Mail, Share2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { site } from '@/data/site'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { FacebookIcon, TelegramIcon, WhatsappIcon, XIcon } from './BrandIcons'
import { cn } from '@/lib/utils'

/** Always share the public URL (never localhost or a #hash). */
const SHARE_URL = `${site.url.replace(/\/$/, '')}/`

function targets(text: string, title: string) {
  const u = encodeURIComponent(SHARE_URL)
  const tx = encodeURIComponent(text)
  return [
    { id: 'whatsapp', label: 'WhatsApp', icon: WhatsappIcon, color: '#1faa53', href: `https://wa.me/?text=${encodeURIComponent(`${text} ${SHARE_URL}`)}` },
    { id: 'facebook', label: 'Facebook', icon: FacebookIcon, color: '#1877f2', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { id: 'telegram', label: 'Telegram', icon: TelegramIcon, color: '#229ed9', href: `https://t.me/share/url?url=${u}&text=${tx}` },
    { id: 'x', label: 'X', icon: XIcon, color: '#100643', href: `https://twitter.com/intent/tweet?text=${tx}&url=${u}` },
    { id: 'email', label: 'Email', icon: Mail, color: '#173079', href: `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${text}\n${SHARE_URL}`)}` },
  ] as const
}

interface ShareButtonProps {
  placement?: 'down' | 'up'
  align?: 'left' | 'right'
  className?: string
  tone?: 'light' | 'dark'
}

/** Share the site: native share sheet on phones (Web Share API), a menu of networks + "copy link" on desktop. */
export function ShareButton({ placement = 'up', align = 'left', className, tone = 'light' }: ShareButtonProps) {
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
        if ((e as Error).name === 'AbortError') return
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
    <div ref={root} className={cn('relative inline-block', className)}>
      <button
        type="button"
        onClick={onClick}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn('btn', tone === 'light' ? 'btn-ghost' : 'border-2 border-white/25 bg-white/10 text-white hover:bg-white/20')}
      >
        <Share2 size={19} strokeWidth={2.2} />
        {t(ui.share.button)}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: placement === 'down' ? -8 : 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: placement === 'down' ? -8 : 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className={cn(
              'absolute z-[70] w-72 rounded-xl border border-line bg-white p-3 text-text shadow-[0_30px_60px_-20px_rgba(16,6,67,0.4)]',
              placement === 'down' ? 'top-full mt-2' : 'bottom-full mb-2',
              align === 'right' ? 'right-0' : 'left-0',
            )}
          >
            <p className="px-2 pt-1 pb-2 font-display text-sm font-bold text-muted">{t(ui.share.title)}</p>
            <div className="grid grid-cols-5 gap-1">
              {targets(text, title).map((s) => (
                <a
                  key={s.id}
                  role="menuitem"
                  href={s.href}
                  target={s.id === 'email' ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  aria-label={s.label}
                  title={s.label}
                  className="group grid place-items-center rounded-lg py-2 transition-colors hover:bg-paper"
                >
                  <span className="grid size-11 place-items-center rounded-full bg-paper transition-transform duration-200 group-hover:scale-110" style={{ color: s.color }}>
                    <s.icon size={20} />
                  </span>
                </a>
              ))}
            </div>
            <button
              type="button"
              role="menuitem"
              onClick={copy}
              className="mt-2 flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-left transition-colors hover:border-sky"
            >
              <span className="truncate text-sm text-muted">{SHARE_URL.replace('https://', '')}</span>
              <span className={cn('flex shrink-0 items-center gap-1 text-sm font-bold', copied ? 'text-leaf' : 'text-royal')}>
                {copied ? <Check size={15} /> : <Link2 size={15} />}
                {copied ? t(ui.share.copied) : t(ui.share.copy)}
              </span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
