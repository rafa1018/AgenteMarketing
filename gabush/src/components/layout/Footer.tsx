import { Mail, MapPin, Phone } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { site } from '@/data/site'
import { useVisits } from '@/hooks/useMediaQuery'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { scrollToId } from '@/lib/utils'
import { AnimatedCounter } from '@/components/animations'
import { FacebookIcon, InstagramIcon, WhatsappIcon } from '@/components/ui/BrandIcons'
import { ShareButton } from '@/components/ui/ShareButton'
import { Cloud } from '@/components/fx/Fx'
import { NAV } from './Navbar'

function VisitCounter() {
  const t = useT()
  const count = useVisits()
  return (
    <AnimatePresence>
      {count !== null && (
        <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-1.5 text-sm text-white/70">
          <AnimatedCounter to={count} className="font-bold text-white" /> {t(ui.footer.visits)}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

export function Footer() {
  const t = useT()
  return (
    <footer className="relative overflow-clip bg-[#789b34] text-white/85">
      {/* sky with clouds, then the hills */}
      <div className="relative h-[max(150px,calc(13vw+70px))] bg-[linear-gradient(180deg,#ffffff_0%,#cdeeff_100%)]">
        <Cloud className="top-6" size={150} duration={80} delay={15} />
        <Cloud className="top-16" size={100} duration={65} delay={45} opacity={0.8} />
        <motion.img
          src="/images/opt/lion-200.webp"
          alt=""
          aria-hidden
          width={200}
          loading="lazy"
          className="absolute bottom-[calc(min(13vw,260px)*0.25)] left-[12%] z-10 w-16 sm:w-24"
          initial={{ y: 40, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ once: true }}
          transition={{ type: 'spring', stiffness: 200, damping: 12 }}
        />
        <img src="/images/opt/anim-7.webp" alt="" aria-hidden loading="lazy" width={70} className="absolute top-6 right-[10%] w-12 animate-float sm:w-16" />
        <img
          src="/images/opt/grass-1000.webp"
          srcSet="/images/opt/grass-1000.webp 1000w, /images/opt/grass-2000.webp 2000w"
          sizes="100vw"
          alt=""
          aria-hidden
          loading="lazy"
          width={1000}
          height={130}
          className="absolute inset-x-0 bottom-0 h-auto min-h-[84px] w-full object-cover object-[18%_top] sm:object-top"
        />
      </div>

      <div className="relative bg-[linear-gradient(180deg,#789b34_0%,#4f7219_140px)] pb-24">
        <div className="container-x grid gap-10 pt-8 sm:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1.3fr]">
          <div>
            <span className="inline-block rounded-2xl bg-white p-3">
              <img src="/images/opt/logo-240.webp" alt={site.fullName} width={240} height={101} loading="lazy" className="h-16 w-auto" />
            </span>
            <p className="mt-4 font-serif text-xl font-semibold text-white">{t(site.motto)} 🎨</p>
            <p className="mt-1 text-sm text-white/75">
              {site.license} · DANE {site.dane}
            </p>
            <div className="mt-5 flex gap-3">
              <a href={site.socials.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="grid size-11 place-items-center rounded-2xl bg-white/15 text-white hover:bg-white/25">
                <FacebookIcon size={20} />
              </a>
              <a href={site.socials.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="grid size-11 place-items-center rounded-2xl bg-white/15 text-white hover:bg-white/25">
                <InstagramIcon size={20} />
              </a>
              <a href={`https://wa.me/${site.whatsapp}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="grid size-11 place-items-center rounded-2xl bg-white/15 text-white hover:bg-white/25">
                <WhatsappIcon size={20} />
              </a>
            </div>
          </div>

          <nav aria-label={t(ui.footer.links)}>
            <p className="font-serif text-lg font-semibold text-white">{t(ui.footer.links)}</p>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-1">
              {NAV.map((n) => (
                <li key={n.id}>
                  <a
                    href={`#${n.id}`}
                    onClick={(e) => {
                      e.preventDefault()
                      scrollToId(n.id)
                    }}
                    className="inline-flex min-h-10 items-center gap-2 font-semibold hover:text-yellow"
                  >
                    <span className="size-2.5 rounded-[3px]" style={{ background: n.color === '#23206b' ? '#fff' : n.color }} />
                    {t(n.label)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <p className="font-serif text-lg font-semibold text-white">{t(ui.footer.contact)}</p>
            <ul className="mt-3 space-y-3 font-semibold">
              <li className="flex items-center gap-3">
                <Phone size={18} className="shrink-0 text-yellow" />
                <a href={`tel:+${site.whatsapp}`} className="hover:text-yellow">
                  {site.phoneDisplay}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={18} className="shrink-0 text-yellow" />
                <a href={`mailto:${site.email}`} className="break-all hover:text-yellow">
                  {site.email}
                </a>
              </li>
              <li className="flex items-start gap-3">
                <MapPin size={18} className="mt-1 shrink-0 text-yellow" />
                <span>
                  {site.address}, {site.city}
                </span>
              </li>
            </ul>
            <ShareButton className="mt-5" tone="dark" />
          </div>
        </div>

        <div className="container-x mt-10 flex flex-col items-center justify-between gap-3 border-t border-white/20 pt-6 text-center text-sm sm:flex-row sm:text-left">
          <p>
            © {new Date().getFullYear()} {site.fullName}. {t(ui.footer.rights)}
          </p>
          <div className="flex flex-col items-center gap-2 sm:flex-row sm:gap-5">
            <VisitCounter />
            <a href="https://rafaelpedraza.dev/" target="_blank" rel="noopener" className="group inline-flex items-center gap-1.5 text-white/75 hover:text-white">
              {t({ es: 'Hecho con', en: 'Made with' })} <span className="transition-transform group-hover:scale-125">💛</span> {t({ es: 'por', en: 'by' })}
              <span className="rounded-md bg-white/15 px-2 py-0.5 font-serif font-semibold text-white group-hover:bg-white/25">RP Technologies</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
