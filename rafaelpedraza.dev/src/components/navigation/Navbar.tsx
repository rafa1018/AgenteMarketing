import { AnimatePresence, motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react'
import { Download, Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { navItems } from '@/data/navigation'
import { profile } from '@/data/profile'
import { useActiveSection } from '@/hooks/useActiveSection'
import { Logo } from '@/components/ui/Logo'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { GithubIcon, LinkedinIcon } from '@/components/ui/BrandIcons'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { EASE_OUT, cn, isPlaceholder, pad, scrollToId } from '@/lib/utils'

const ids = navItems.map((n) => n.id)
// sections without their own nav item map to the closest group
const groupOf: Record<string, string> = { evolution: 'about', focus: 'architecture', manifesto: 'home', build: 'home' }
const trackedIds = [...ids, ...Object.keys(groupOf)]

export function Navbar({ visible }: { visible: boolean }) {
  const t = useT()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { scrollY, scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 })
  const rawActive = useActiveSection(trackedIds)
  const active = groupOf[rawActive] ?? rawActive

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
    requestAnimationFrame(() => scrollToId(id))
  }

  return (
    <>
      <motion.header
        className={cn(
          'fixed inset-x-0 top-0 z-50 transition-[background-color,border-color,backdrop-filter] duration-500',
          scrolled || open ? 'border-b border-line bg-ink/75 backdrop-blur-xl' : 'border-b border-transparent',
        )}
        initial={{ y: -80, opacity: 0 }}
        animate={visible ? { y: 0, opacity: 1 } : { y: -80, opacity: 0 }}
        transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.2 }}
      >
        <div className="container-x flex h-16 items-center justify-between gap-4">
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault()
              go('home')
            }}
            aria-label="Rafael Pedraza"
          >
            <Logo />
          </a>

          <nav aria-label="Main" className="hidden xl:block">
            <ul className="flex items-center gap-0.5">
              {navItems.map((item) => (
                <li key={item.id}>
                  <a
                    href={`#${item.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      go(item.id)
                    }}
                    className={cn(
                      'relative block px-2.5 py-2 font-mono text-[10.5px] tracking-[0.18em] uppercase transition-colors duration-300',
                      active === item.id ? 'text-fg' : 'text-muted hover:text-fg',
                    )}
                    aria-current={active === item.id ? 'true' : undefined}
                  >
                    {t(item.label)}
                    {active === item.id && (
                      <motion.span layoutId="nav-active" className="absolute inset-x-2.5 -bottom-px h-px bg-gradient-to-r from-volt to-cyan" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageToggle className="hidden sm:flex" />
            <a
              href={profile.links.cv}
              download
              className="hidden h-9 items-center gap-2 rounded-md border border-line-strong px-3.5 font-mono text-[10.5px] tracking-[0.18em] text-fg uppercase transition-colors hover:border-cyan/70 hover:text-white sm:inline-flex"
            >
              <Download size={14} strokeWidth={1.75} /> {t(ui.nav.cv)}
            </a>
            <button
              type="button"
              className="grid size-10 place-items-center rounded-md border border-line text-fg xl:hidden"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={open ? t(ui.nav.closeMenu) : t(ui.nav.openMenu)}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span key={open ? 'x' : 'm'} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
                  {open ? <X size={18} /> : <Menu size={18} />}
                </motion.span>
              </AnimatePresence>
            </button>
          </div>
        </div>
        <motion.div aria-hidden className="absolute inset-x-0 bottom-0 h-px origin-left bg-gradient-to-r from-volt via-cyan to-violet" style={{ scaleX: progress, opacity: scrolled ? 0.8 : 0 }} />
      </motion.header>

      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="fixed inset-0 z-40 flex flex-col bg-ink/95 pt-16 backdrop-blur-xl xl:hidden"
            initial={{ clipPath: 'inset(0 0 100% 0)' }}
            animate={{ clipPath: 'inset(0 0 0% 0)' }}
            exit={{ clipPath: 'inset(0 0 100% 0)' }}
            transition={{ duration: 0.55, ease: [0.76, 0, 0.24, 1] }}
          >
            <div className="grid-bg pointer-events-none absolute inset-0 opacity-50" />
            <nav aria-label="Mobile" className="container-x relative flex-1 overflow-y-auto py-6">
              <LanguageToggle id="lang-mobile" className="mb-4 w-fit sm:hidden" />
              <ul className="space-y-1">
                {navItems.map((item, i) => (
                  <motion.li key={item.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.045, duration: 0.5, ease: EASE_OUT }}>
                    <a
                      href={`#${item.id}`}
                      onClick={(e) => {
                        e.preventDefault()
                        go(item.id)
                      }}
                      className="flex items-baseline gap-4 border-b border-line py-3"
                    >
                      <span className="hud !text-[10px] text-cyan">{pad(i)}</span>
                      <span className={cn('font-display text-[1.75rem] font-semibold tracking-tight', active === item.id ? 'text-fg' : 'text-fg/60')}>{t(item.label)}</span>
                    </a>
                  </motion.li>
                ))}
              </ul>
              <motion.div className="mt-8 flex flex-wrap items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.55 }}>
                <a href={profile.links.cv} download className="inline-flex h-11 items-center gap-2 rounded-md bg-volt px-4 font-mono text-[11px] tracking-[0.18em] text-white uppercase">
                  <Download size={15} /> {t(ui.nav.downloadCv)}
                </a>
                <a href={profile.links.linkedin} target="_blank" rel="noopener noreferrer" className="grid size-11 place-items-center rounded-md border border-line text-fg" aria-label="LinkedIn">
                  <LinkedinIcon size={17} />
                </a>
                {!isPlaceholder(profile.links.github) && (
                  <a href={profile.links.github} target="_blank" rel="noopener noreferrer" className="grid size-11 place-items-center rounded-md border border-line text-fg" aria-label="GitHub">
                    <GithubIcon size={17} />
                  </a>
                )}
              </motion.div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
