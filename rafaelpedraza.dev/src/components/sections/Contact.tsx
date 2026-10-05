import { motion } from 'motion/react'
import { Download } from 'lucide-react'
import { profile } from '@/data/profile'
import { GithubIcon, LinkedinIcon } from '@/components/ui/BrandIcons'
import { FadeIn, Parallax, RevealText } from '@/components/animations'
import { ContactForm } from './contact/ContactForm'
import { ShareButton } from '@/components/ui/ShareButton'
import { useCvEnabled } from '@/hooks/useSite'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { cn, isPlaceholder } from '@/lib/utils'

export function Contact() {
  const t = useT()
  const cvEnabled = useCvEnabled()

  const channels = [
    { label: 'LinkedIn', sub: 'in/rafael-pedraza', href: profile.links.linkedin, icon: LinkedinIcon, tone: 'text-[#5aa9ff]', external: true },
    { label: 'GitHub', sub: '', href: profile.links.github, icon: GithubIcon, tone: 'text-fg', external: true },
    ...(cvEnabled ? [{ label: t(ui.nav.downloadCv), sub: 'PDF', href: profile.links.cv, icon: Download, tone: 'text-cyan', external: false, download: true }] : []),
  ].filter((c) => !isPlaceholder(c.href))

  return (
    <section id="contact" className="relative overflow-hidden py-24 sm:py-32">
      {/* converging circuit: every line of the page ends here */}
      <Parallax speed={40} className="pointer-events-none absolute inset-x-0 top-0 h-[70%]" aria-hidden>
        <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" className="h-full w-full opacity-60">
          {[...Array(9)].map((_, i) => {
            const x = 100 + i * 125
            return (
              <motion.path
                key={i}
                d={`M${x} 0 V${120 + Math.abs(4 - i) * 30} L600 330`}
                fill="none"
                stroke={i === 4 ? '#52d3ff' : 'rgb(47 140 255 / 0.25)'}
                strokeWidth={1}
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.6, delay: Math.abs(4 - i) * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            )
          })}
          <circle cx="600" cy="330" r="160" fill="url(#contact-glow)" />
          <defs>
            <radialGradient id="contact-glow">
              <stop offset="0" stopColor="#2f8cff" stopOpacity="0.25" />
              <stop offset="1" stopColor="#2f8cff" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
      </Parallax>

      <div className="container-x relative">
        <div className="text-center">
          <FadeIn>
            <span className="hud text-cyan">[08] ·{t(ui.contact.kicker)}</span>
          </FadeIn>
          <RevealText
            key={t(ui.contact.title)}
            as="h2"
            text={t(ui.contact.title)}
            className="mx-auto mt-6 block max-w-5xl font-display text-[clamp(2.4rem,8.5vw,7rem)] leading-[0.92] font-bold tracking-[-0.045em]"
            wordClassName="text-gradient"
          />
          <FadeIn delay={0.2}>
            <p className="mx-auto mt-7 max-w-xl text-lg text-muted sm:text-xl">{t(ui.contact.text)}</p>
          </FadeIn>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-6 lg:grid-cols-[1.35fr_1fr] lg:gap-8">
          <FadeIn delay={0.1}>
            <ContactForm />
          </FadeIn>

          <FadeIn delay={0.2} className="flex flex-col">
            <p className="hud mb-4 !text-[9.5px] text-dim">{t(ui.contact.or)}</p>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {channels.map((c) => (
                <li key={c.label}>
                  <a
                    href={c.href}
                    {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    {...(c.download ? { download: '' } : {})}
                    className="glow-border panel group flex items-center gap-4 p-4 transition-colors duration-300 hover:border-line-strong"
                  >
                    <span className={cn('grid size-11 shrink-0 place-items-center rounded-lg border border-line bg-ink/60 transition-transform duration-300 group-hover:scale-105', c.tone)}>
                      <c.icon size={19} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium text-fg">{c.label}</span>
                      {c.sub && <span className="block truncate font-mono text-[11px] text-dim">{c.sub}</span>}
                    </span>
                  </a>
                </li>
              ))}
            </ul>

            {/* share this profile */}
            <div className="panel corners mt-3 bg-[linear-gradient(150deg,rgb(47_140_255/0.12),rgb(7_13_26/0.6)_60%)] p-5">
              <p className="font-display text-[16px] font-semibold tracking-tight text-fg">{t(ui.share.cardTitle)}</p>
              <p className="mt-1 text-[13.5px] text-muted">{t(ui.share.cardText)}</p>
              <ShareButton className="mt-4" placement="up" align="left" />
            </div>
          </FadeIn>
        </div>
      </div>
    </section>
  )
}
