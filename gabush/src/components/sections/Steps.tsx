import { motion, useScroll, useSpring } from 'motion/react'
import { useRef } from 'react'
import { steps } from '@/data/content'
import { TONES } from '@/data/programs'
import { useT } from '@/i18n'
import { FadeIn } from '@/components/animations'
import { SectionHeader } from '@/components/ui/SectionHeader'

/** "¿Cómo inscribir?" — four coloured steps; a rainbow path draws with the scroll. */
export function Steps() {
  const t = useT()
  const ref = useRef<HTMLOListElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.8', 'end 0.6'] })
  const draw = useSpring(scrollYProgress, { stiffness: 100, damping: 26, mass: 0.3 })
  const rainbow = 'linear-gradient(90deg,#e5197e,#f8c21c,#1fa3dd,#5cb531)'

  return (
    <section id="como-empezar" className="relative py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader kicker={steps.kicker} title={steps.title} mascot="conejo" />

        <ol ref={ref} className="relative mt-14 grid gap-10 md:grid-cols-4 md:gap-6">
          <div aria-hidden className="absolute top-0 bottom-0 left-[31px] w-1.5 rounded-full bg-line md:top-[29px] md:right-0 md:bottom-auto md:left-0 md:h-1.5 md:w-auto">
            <motion.div className="size-full origin-top rounded-full md:hidden" style={{ scaleY: draw, background: 'linear-gradient(180deg,#e5197e,#f8c21c,#1fa3dd,#5cb531)' }} />
            <motion.div className="hidden size-full origin-left rounded-full md:block" style={{ scaleX: draw, background: rainbow }} />
          </div>

          {steps.items.map((s, i) => {
            const tone = TONES[s.tone]
            return (
              <li key={i} className="relative flex gap-5 md:flex-col md:gap-0">
                <motion.span
                  className="relative z-10 grid size-16 shrink-0 place-items-center rounded-[20px] border-4 border-white text-white"
                  style={{ background: tone.solid, boxShadow: `0 5px 0 ${tone.edge}`, rotate: i % 2 ? 4 : -4 }}
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true, amount: 0.8 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 14, delay: i * 0.12 }}
                  whileHover={{ rotate: 0, scale: 1.1 }}
                >
                  <s.icon size={26} strokeWidth={2.3} className={s.tone === 'yellow' ? 'text-ink' : undefined} />
                  <span className="absolute -top-2.5 -right-2.5 grid size-7 place-items-center rounded-full bg-ink font-serif text-sm font-semibold text-white">{i + 1}</span>
                </motion.span>
                <FadeIn delay={i * 0.08} distance={16} className="md:mt-6">
                  <h3 className="text-xl sm:text-[1.45rem]">{t(s.title)}</h3>
                  <p className="mt-1.5 text-[16px] text-muted">{t(s.text)}</p>
                </FadeIn>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
