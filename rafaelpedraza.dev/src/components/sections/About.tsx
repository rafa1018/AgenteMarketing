import { motion } from 'motion/react'
import { BadgeCheck, MapPin, GraduationCap } from 'lucide-react'
import { profile } from '@/data/profile'
import { experience, education } from '@/data/experience'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { AnimatedCounter, FadeIn, RevealItem, ScrollReveal, TiltCard } from '@/components/animations'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { EASE_OUT, pad } from '@/lib/utils'

export function About() {
  const t = useT()
  return (
    <section id="about" className="relative py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader index="01" kicker={t(ui.about.kicker)} title={t(ui.about.title)} />

        <div className="grid gap-8 lg:grid-cols-[400px_1fr] lg:gap-14">
          {/* Dossier card */}
          <FadeIn direction="right">
            <TiltCard max={3} className="glow-border panel corners overflow-hidden p-6">
              <div className="flex items-center justify-between">
                <span className="hud !text-[9.5px] text-cyan">{t(ui.about.card)}</span>
                <span className="hud !text-[9.5px] text-dim">ID · RP</span>
              </div>
              <div className="mt-6 flex items-center gap-5">
                <div className="relative size-24 shrink-0">
                  <img src={profile.photo.face} alt="" width={96} height={96} loading="lazy" className="size-24 rounded-xl object-cover" />
                  <span aria-hidden className="absolute inset-0 rounded-xl ring-1 ring-cyan/40 ring-inset" />
                  <span aria-hidden className="absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-md border border-line bg-ink">
                    <BadgeCheck size={13} className="text-cyan" />
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="font-display text-xl font-semibold">{profile.fullName}</div>
                  <div className="mt-1 text-sm text-muted">{t(profile.degree)}</div>
                  <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-dim">
                    <MapPin size={12} /> {profile.location}
                  </div>
                </div>
              </div>

              <div className="mt-7 space-y-2.5">
                <div className="hud !text-[9.5px] text-dim">{t(ui.about.modules)}</div>
                {profile.capabilities.map((c, i) => (
                  <div key={c.en} className="flex items-center gap-3">
                    <span className="w-6 font-mono text-[10px] text-dim">{pad(i + 1)}</span>
                    <span className="flex-1 text-[13px] text-fg/90">{t(c)}</span>
                    <span className="relative h-[3px] w-16 overflow-hidden rounded-full bg-steel sm:w-20">
                      <motion.span
                        className="absolute inset-0 origin-left rounded-full bg-gradient-to-r from-volt to-cyan"
                        initial={{ scaleX: 0 }}
                        whileInView={{ scaleX: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.1, delay: 0.2 + i * 0.12, ease: EASE_OUT }}
                      />
                    </span>
                    <span className="font-mono text-[9.5px] tracking-[0.15em] text-ok">OK</span>
                  </div>
                ))}
              </div>

              <div className="mt-7 border-t border-line pt-5">
                {education.map((e) => (
                  <div key={e.title.en} className="flex items-start gap-3 py-1.5">
                    <GraduationCap size={15} className="mt-0.5 shrink-0 text-volt" />
                    <div className="min-w-0 text-[13px]">
                      <span className="text-fg/90">{t(e.title)}</span>
                      <span className="text-dim"> · {t(e.date)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </TiltCard>
          </FadeIn>

          <div className="flex flex-col justify-center">
            <FadeIn>
              <p className="font-display text-[clamp(1.35rem,2.6vw,2rem)] leading-snug font-medium tracking-[-0.02em] text-fg">{t(profile.about.summary)}</p>
            </FadeIn>
            <FadeIn delay={0.1}>
              <p className="mt-6 max-w-3xl text-[15.5px] leading-relaxed text-muted">{t(profile.about.detail)}</p>
            </FadeIn>

            <ScrollReveal className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line xl:grid-cols-4">
              {profile.indicators.map((ind) => {
                const value = ind.value === 'roles' ? experience.length : ind.value
                return (
                  <RevealItem key={ind.label.en} className="bg-abyss p-5">
                    <div className="font-display text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
                      <AnimatedCounter to={value} suffix={ind.suffix} />
                    </div>
                    <div className="hud mt-2 !text-[9.5px] leading-relaxed text-muted">{t(ind.label)}</div>
                  </RevealItem>
                )
              })}
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  )
}
