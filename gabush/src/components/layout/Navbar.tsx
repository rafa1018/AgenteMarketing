import { AnimatePresence, motion, useMotionValueEvent, useScroll } from 'motion/react'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'
import { site, whatsappLink } from '@/data/site'
import { useActiveSection } from '@/hooks/useMediaQuery'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { cn, scrollToId } from '@/lib/utils'
import { LanguageToggle } from '@/components/ui/LanguageToggle'
import { WhatsappIcon } from '@/components/ui/BrandIcons'
import { AdminButton } from '@/components/admin/AdminUI'
import { BlockLogo } from '@/components/fx/Fx'

export const NAV = [
  { id: 'inicio', label: ui.nav.home, color: '#e5197e' },
  { id: 'nosotros', label: ui.nav.about, color: '#e5197e' },
  { id: 'programas', label: ui.nav.programs, color: '#f8c21c' },
  { id: 'momentos', label: ui.nav.feed, color: '#1fa3dd' },
  { id: 'galeria', label: ui.nav.spaces, color: '#5cb531' },
  { id: 'calendario', label: ui.nav.calendar, color: '#f26b1d' },
  { id: 'contacto', label: ui.nav.contact, color: '#23206b' },
] as const
const IDS = NAV.map((n) => n.id)

export function Navbar({ visible }: { visible: boolean }) {
  const t = useT()
  const active = useActiveSection(IDS)
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const { scrollY } = useScroll()
  useMotionValueEvent(scrollY, 'change', (v) => setScrolled(v > 24))

  const go = (id: string) => {
    setOpen(false)
    scrollToId(id)
  }

  return (
    <motion.header
      initial={{ y: -110, opacity: 0 }}
      animate={visible ? { y: 0, opacity: 1 } : undefined}
      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      className="fixed inset-x-0 top-0 z-50 px-2.5 pt-2.5 sm:px-4 sm:pt-3"
    >
      <div
        className={cn(
          'mx-auto max-w-[1240px] rounded-[26px] border-2 transition-[background-color,box-shadow,border-color] duration-300',
          scrolled || open ? 'border-white bg-white/95 shadow-[0_14px_34px_-18px_rgba(35,32,107,0.45)] backdrop-blur-xl' : 'border-transparent bg-white/70 backdrop-blur-sm',
        )}
      >
        <nav aria-label="Principal" className="flex h-16 items-center justify-between gap-3 pr-2 pl-3 sm:h-[70px] sm:pl-4">
          <a
            href="#inicio"
            onClick={(e) => {
              e.preventDefault()
              go('inicio')
            }}
            aria-label={site.fullName}
            className="group flex shrink-0 items-center gap-2 rounded-xl"
          >
            <img src="/images/opt/lion-head-160.webp" alt="" width={160} height={150} className="size-10 object-contain transition-transform group-hover:animate-wiggle sm:size-11" />
            <BlockLogo size="text-[1.05rem] sm:text-[1.3rem]" kids="text-[0.72rem] px-1.5 sm:text-[0.82rem] sm:px-2" className="pt-0.5" />
          </a>

          <ul className="hidden items-center gap-0.5 lg:flex">
            {NAV.slice(1).map((n) => (
              <li key={n.id}>
                <a
                  href={`#${n.id}`}
                  onClick={(e) => {
                    e.preventDefault()
                    go(n.id)
                  }}
                  aria-current={active === n.id ? 'true' : undefined}
                  className={cn('relative block rounded-full px-3 py-2 font-serif text-[16px] font-medium transition-colors', active === n.id ? 'text-white' : 'text-ink hover:bg-paper')}
                >
                  {active === n.id && <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full" style={{ background: n.color }} transition={{ type: 'spring', stiffness: 420, damping: 30 }} />}
                  <span className={cn('relative', active === n.id && n.color === '#f8c21c' && 'text-ink')}>{t(n.label)}</span>
                </a>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2">
            <LanguageToggle className="hidden sm:flex" />
            <AdminButton />
            <a href={whatsappLink(t(site.whatsappMessage))} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp hidden shrink-0 !min-h-11 !px-4 !text-[15px] xl:inline-flex">
              <WhatsappIcon size={18} />
              {t(ui.contact.cta)}
            </a>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              aria-controls="mobile-menu"
              aria-label={t(open ? ui.nav.close : ui.nav.menu)}
              className="grid size-11 place-items-center rounded-full bg-ink text-white lg:hidden"
            >
              {open ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </nav>

        <AnimatePresence>
          {open && (
            <motion.div
              id="mobile-menu"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden px-3 lg:hidden"
            >
              <ul className="grid grid-cols-2 gap-2 pb-3">
                {NAV.map((n, i) => (
                  <motion.li key={n.id} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.03 * i, type: 'spring', stiffness: 400, damping: 20 }}>
                    <a
                      href={`#${n.id}`}
                      onClick={(e) => {
                        e.preventDefault()
                        go(n.id)
                      }}
                      className={cn('flex min-h-12 items-center gap-2.5 rounded-2xl px-3 font-serif text-lg font-medium', active === n.id ? 'bg-paper text-ink' : 'text-text')}
                    >
                      <span className="size-3 rounded-[4px]" style={{ background: n.color }} />
                      {t(n.label)}
                    </a>
                  </motion.li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-3 border-t-2 border-line px-1 py-3">
                <LanguageToggle id="lang-mobile" />
                <a href={whatsappLink(t(site.whatsappMessage))} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp !min-h-11 flex-1 !px-4 !text-base">
                  <WhatsappIcon size={20} />
                  {t(ui.contact.cta)}
                </a>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.header>
  )
}
