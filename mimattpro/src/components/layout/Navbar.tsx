import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { LogIn, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { useActiveSection } from '@/hooks/useActiveSection'
import { useT } from '@/i18n'
import { links, ui } from '@/i18n/ui'
import { cn, scrollToId } from '@/lib/utils'

const ids = ui.nav.items.map((i) => i.id)

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <img src="/images/logo-128.webp" alt="" className="size-9 drop-shadow-[0_4px_12px_rgb(var(--brand-rgb)/0.25)]" />
      <span className="font-display text-[17px] font-semibold tracking-tight">
        <span className="text-silver">MiMatt</span> <span className="text-gold">PRO</span>
      </span>
    </span>
  )
}

export function Navbar() {
  const t = useT()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { scrollY } = useScroll()
  const active = useActiveSection(ids)
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24))

  useEffect(() => {
    document.documentElement.style.overflow = open ? 'hidden' : ''
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const go = (id: string) => {
    setOpen(false)
    scrollToId(id)
  }

  return (
    <>
      <header className={cn('fixed inset-x-0 top-0 z-50 transition-colors duration-300', scrolled || open ? 'border-b border-line bg-ink/80 backdrop-blur-xl' : 'border-b border-transparent')}>
        <div className="container-x flex h-16 items-center gap-6">
          <a href="#home" onClick={(e) => (e.preventDefault(), go('home'))} aria-label="MiMatt PRO">
            <Brand />
          </a>
          <nav className="ml-auto hidden lg:block">
            <ul className="flex items-center gap-1">
              {ui.nav.items.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => (e.preventDefault(), go(item.id))}
                    className={cn('relative rounded-md px-3 py-2 text-[13.5px] transition-colors', active === item.id ? 'text-fg' : 'text-muted hover:text-fg')}
                  >
                    {t(item.label)}
                    {active === item.id && <motion.span layoutId="nav-active" className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-volt to-cyan" />}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <LanguageToggle className="hidden sm:flex" />
            <a href={links.login} className="hidden h-9 items-center gap-2 rounded-md border border-line-strong px-3.5 font-mono text-[10.5px] tracking-[0.16em] text-fg uppercase transition-colors hover:border-cyan/70 sm:inline-flex">
              <LogIn size={14} /> {t(ui.nav.login)}
            </a>
            <button type="button" className="grid size-10 place-items-center rounded-md border border-line text-fg lg:hidden" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={t(ui.nav.menu)}>
              {open ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 flex flex-col bg-ink/95 pt-20 backdrop-blur-xl lg:hidden">
            <ul className="container-x space-y-1">
              {ui.nav.items.map((item, i) => (
                <motion.li key={item.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
                  <a href={`#${item.id}`} onClick={(e) => (e.preventDefault(), go(item.id))} className="block border-b border-line py-4 font-display text-2xl font-semibold text-fg">
                    {t(item.label)}
                  </a>
                </motion.li>
              ))}
            </ul>
            <div className="container-x mt-8 flex flex-wrap items-center gap-3">
              <a href={links.signup} className="inline-flex h-11 items-center rounded-md bg-gradient-to-b from-[var(--brand-btn)] to-[var(--brand-3)] px-5 font-mono text-[11px] font-semibold tracking-[0.16em] text-[var(--on-brand)] uppercase">
                {t(ui.nav.start)}
              </a>
              <a href={links.login} className="inline-flex h-11 items-center gap-2 rounded-md border border-line-strong px-5 font-mono text-[11px] tracking-[0.16em] text-fg uppercase">
                <LogIn size={14} /> {t(ui.nav.login)}
              </a>
              <LanguageToggle id="lang-mobile" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
