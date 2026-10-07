import { motion } from 'motion/react'
import { Heart, Palette, Users } from 'lucide-react'
import { about } from '@/data/content'
import { TONES } from '@/data/programs'
import { site } from '@/data/site'
import { useT } from '@/i18n'
import { FadeIn, RevealItem, RevealText, ScrollReveal } from '@/components/animations'
import { Deco, useSectionScroll } from '@/components/fx/Fx'

const PILLAR_ICONS = [Users, Palette, Heart]

export function About() {
  const t = useT()
  const { ref, progress } = useSectionScroll<HTMLElement>()
  return (
    <section id="nosotros" ref={ref} className="relative overflow-clip py-20 sm:py-28">
      <Deco src="/images/opt/anim-2.webp" width={120} className="top-10 right-[4%] hidden opacity-80 md:block" anim="none" progress={progress} scroll={-80} />
      <Deco src="/images/opt/anim-6.webp" width={150} className="bottom-8 left-[2%] hidden lg:block" anim="float" progress={progress} scroll={-60} duration={7} />

      <div className="container-x grid items-center gap-14 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        {/* shield + statement */}
        <FadeIn direction="right" className="relative order-2 mx-auto w-full max-w-[500px] lg:order-1">
          <div aria-hidden className="absolute -inset-4 rotate-3 rounded-[40px] bg-yellow" />
          <div aria-hidden className="absolute -inset-4 -rotate-2 rounded-[40px] bg-blue/90" />
          <figure className="relative overflow-hidden rounded-[32px] bg-white p-7 sm:p-9">
            <div className="flex items-center gap-5">
              <motion.img
                src="/images/opt/escudo-400.webp"
                alt={t({ es: 'Escudo del Jardín Infantil Gabush Kids', en: 'Gabush Kids kindergarten crest' })}
                width={400}
                height={470}
                loading="lazy"
                className="w-28 shrink-0 sm:w-36"
                whileHover={{ rotate: [0, -4, 4, 0], transition: { duration: 0.6 } }}
              />
              <div>
                <p className="font-serif text-xl leading-tight font-semibold text-ink sm:text-2xl">{site.fullName}</p>
                <p className="mt-1 font-serif text-lg text-pink">{t(site.motto)}</p>
              </div>
            </div>
            <blockquote className="mt-6 border-t-2 border-dashed border-line pt-6 font-serif text-[clamp(1.35rem,3vw,1.75rem)] leading-snug font-medium text-ink">“{t(about.closing)}”</blockquote>
            <figcaption className="mt-5 flex flex-wrap gap-2 text-[13px] font-bold text-muted">
              <span className="rounded-full bg-paper px-3 py-1">{t({ es: 'Licencia', en: 'Licence' })}: {site.license}</span>
              <span className="rounded-full bg-paper px-3 py-1">DANE {site.dane}</span>
            </figcaption>
          </figure>
        </FadeIn>

        {/* copy */}
        <div className="order-1 lg:order-2">
          <FadeIn distance={12}>
            <p className="kicker">{t({ es: 'Bienvenidos a Gabush', en: 'Welcome to Gabush' })}</p>
          </FadeIn>
          <RevealText as="h2" text={t(about.title)} className="section-title mt-4" />
          <FadeIn delay={0.1}>
            <p className="mt-5 text-lg leading-relaxed text-text/90">{t(about.body)}</p>
          </FadeIn>

          <ScrollReveal className="mt-9 grid gap-4 sm:grid-cols-3" stagger={0.1}>
            {about.pillars.map((p, i) => {
              const Icon = PILLAR_ICONS[i]
              const tone = TONES[p.tone]
              return (
                <RevealItem key={i} className="rounded-3xl p-5 transition-transform hover:-translate-y-1 hover:rotate-[-1deg]" style={{ background: tone.soft }}>
                  <span className="grid size-12 place-items-center rounded-2xl text-white" style={{ background: tone.solid, boxShadow: `0 4px 0 ${tone.edge}` }}>
                    <Icon size={24} strokeWidth={2.2} />
                  </span>
                  <h3 className="mt-4 text-[1.2rem]">{t(p.title)}</h3>
                  <p className="mt-1 text-[15px] leading-snug text-text/75">{t(p.text)}</p>
                </RevealItem>
              )
            })}
          </ScrollReveal>
        </div>
      </div>
    </section>
  )
}
