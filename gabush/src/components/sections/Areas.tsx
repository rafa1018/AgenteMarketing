import { motion } from 'motion/react'
import { areas } from '@/data/content'
import { TONES } from '@/data/programs'
import { useT } from '@/i18n'
import { RevealItem, ScrollReveal } from '@/components/animations'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { Cloud, Deco, Wave, useSectionScroll } from '@/components/fx/Fx'

/** The development dimensions as tilted toy blocks (like the GABUSH letters) on a sky band. */
export function Areas() {
  const t = useT()
  const { ref, progress } = useSectionScroll<HTMLElement>()
  return (
    <section id="areas" ref={ref} className="relative overflow-clip bg-[linear-gradient(180deg,#1fa3dd_0%,#3cb6ea_100%)] text-white">
      <Wave color="#fff" flip />
      <Cloud className="top-[18%]" size={170} duration={90} delay={20} opacity={0.35} />
      <Cloud className="bottom-[20%]" size={120} duration={75} delay={50} opacity={0.3} />
      <Deco src="/images/opt/anim-8.webp" width={96} className="top-24 right-[5%] hidden md:block" anim="wiggle" progress={progress} scroll={-90} />
      <Deco src="/images/opt/anim-9.webp" width={110} className="bottom-24 left-[3%] hidden lg:block" anim="float" progress={progress} scroll={-60} />

      <div className="container-x relative py-14 sm:py-20">
        <SectionHeader kicker={areas.kicker} title={areas.title} sub={areas.sub} light />

        <ScrollReveal className="mt-14 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3" stagger={0.07}>
          {areas.items.map((a, i) => {
            const tone = TONES[a.tone]
            const tilt = [-2, 1.5, -1, 2, -1.5, 1][i]
            const dark = a.tone === 'yellow'
            return (
              <RevealItem key={i}>
                <motion.div
                  className="relative h-full rounded-[26px] border-4 border-white p-5 sm:p-7"
                  style={{ background: tone.solid, rotate: tilt, boxShadow: `0 8px 0 ${tone.edge}, 0 24px 40px -24px rgba(35,32,107,.6)` }}
                  whileHover={{ rotate: 0, y: -6, scale: 1.03 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                >
                  <span className="grid size-12 place-items-center rounded-2xl bg-white/95 sm:size-14" style={{ color: tone.solid }}>
                    <a.icon size={26} strokeWidth={2.2} />
                  </span>
                  <h3 className="mt-4 text-[1.35rem] sm:text-2xl" style={{ color: dark ? '#23206b' : '#fff' }}>
                    {t(a.title)}
                  </h3>
                  <p className="mt-1 text-[15px] leading-snug font-semibold" style={{ color: dark ? 'rgba(35,32,107,.8)' : 'rgba(255,255,255,.88)' }}>
                    {t(a.text)}
                  </p>
                </motion.div>
              </RevealItem>
            )
          })}
        </ScrollReveal>
      </div>
      <Wave color="#fff" />
    </section>
  )
}
