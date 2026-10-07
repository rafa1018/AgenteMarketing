import { motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { EASE_OUT, scrollToId } from '@/lib/utils'
import { useHeroScroll } from '@/components/animations'
import { BlinkingCharacter } from '@/components/fx/BlinkingCharacter'

/**
 * Home hero: clean, modern and airy. Text on the left, the Gabush lion (blinking + floating) on the
 * right; on phones the text is centred and the lion sits below it. Colour only in small accents.
 * The character is swappable: <BlinkingCharacter id="elefante" /> etc.
 */
export function Hero({ ready }: { ready: boolean }) {
  const t = useT()
  const hero = useHeroScroll()

  const show = (delay: number) => ({
    initial: { opacity: 0, y: 18 },
    animate: ready ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 0.7, delay, ease: EASE_OUT },
  })

  return (
    <section id="inicio" ref={hero.ref} className="relative overflow-clip bg-white pt-28 sm:pt-32">
      {/* a single soft wash of colour behind the character */}
      <div aria-hidden className="pointer-events-none absolute top-[-10%] right-[-12%] hidden size-[62vw] max-w-[900px] rounded-full bg-[radial-gradient(closest-side,rgba(18,181,201,0.12),rgba(18,181,201,0.04)_60%,transparent)] lg:block" />

      <div className="container-x relative grid items-center gap-8 pb-20 sm:pb-24 lg:min-h-[min(calc(100svh-8rem),760px)] lg:grid-cols-[1.08fr_0.92fr] lg:gap-6 lg:pb-28">
        {/* text */}
        <motion.div className="relative z-10 text-center lg:text-left" style={hero.copy}>
          <motion.p {...show(0)} className="inline-flex items-center gap-2 rounded-full bg-[#ecfbfd] px-3.5 py-1.5 text-[13px] font-bold text-turquoise-dark">
            <span className="relative flex size-2">
              <span className="absolute inset-0 animate-pulse-ring rounded-full bg-turquoise" />
              <span className="relative size-2 rounded-full bg-turquoise" />
            </span>
            {t(ui.hero.badge)} · {t(ui.hero.place)}
          </motion.p>

          <motion.h1 {...show(0.08)} className="mt-6 text-[clamp(2.7rem,6.4vw,5.1rem)] leading-[1.02] font-semibold tracking-[-0.015em] text-ink">
            {t(ui.hero.headA)}{' '}
            <span className="relative inline-block whitespace-nowrap text-turquoise">
              {t(ui.hero.headB)}
              {/* hand-drawn underline */}
              <svg aria-hidden viewBox="0 0 220 18" preserveAspectRatio="none" className="absolute -bottom-[0.12em] left-0 h-[0.22em] w-full overflow-visible">
                <motion.path
                  d="M3 12 C 50 4, 110 3, 217 9"
                  fill="none"
                  stroke="#f8c21c"
                  strokeWidth={6}
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={ready ? { pathLength: 1 } : undefined}
                  transition={{ delay: 0.6, duration: 0.8, ease: EASE_OUT }}
                />
              </svg>
            </span>
          </motion.h1>

          <motion.p {...show(0.18)} className="mx-auto mt-7 max-w-xl font-serif text-[clamp(1.25rem,2.2vw,1.6rem)] leading-snug font-medium text-ink/85 lg:mx-0">
            {t(ui.hero.subtitle)}
          </motion.p>

          <motion.p {...show(0.26)} className="mx-auto mt-4 max-w-lg text-[17px] leading-relaxed text-muted lg:mx-0 lg:border-l-[3px] lg:border-pink/70 lg:pl-4">
            “{t(ui.hero.quote)}”
          </motion.p>

          <motion.div {...show(0.34)} className="mt-9 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <button type="button" onClick={() => scrollToId('nosotros')} className="btn btn-ghost w-full sm:w-auto">
              {t(ui.hero.discover)}
            </button>
            {/* the current enrolment form (Contacto) */}
            <button type="button" onClick={() => scrollToId('contacto')} className="btn btn-turquoise w-full sm:w-auto">
              {t(ui.hero.signUp)}
              <ArrowRight size={19} strokeWidth={2.5} />
            </button>
          </motion.div>

          <motion.ul {...show(0.42)} className="mt-9 flex flex-wrap justify-center gap-x-5 gap-y-2 text-[14px] font-semibold text-ink/70 lg:justify-start">
            {[
              [ui.hero.small, '#f8c21c'],
              [ui.hero.levelsShort, '#5cb531'],
              [{ es: 'Arte, música y danza', en: 'Art, music & dance' }, '#f26b1d'],
            ].map(([label, color], i) => (
              <li key={i} className="inline-flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ background: color as string }} />
                {t(label as { es: string; en: string })}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        {/* character */}
        <motion.div className="relative mx-auto w-[min(76vw,400px)] lg:w-[min(36vw,470px)]" style={hero.photo}>
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 24 }}
            animate={ready ? { opacity: 1, scale: 1, y: 0 } : undefined}
            transition={{ duration: 0.9, delay: 0.15, ease: EASE_OUT }}
            className="relative"
          >
            {/* soft disc + a few small accents */}
            <div aria-hidden className="absolute inset-x-[2%] top-[14%] aspect-square rounded-full bg-[#ecfbfd] ring-1 ring-turquoise/15" />
            <span aria-hidden className="absolute top-[12%] left-[6%] size-4 rounded-full bg-yellow" />
            <span aria-hidden className="absolute top-[30%] right-[2%] size-3 rounded-full bg-pink" />
            <span aria-hidden className="absolute bottom-[22%] left-[0%] size-2.5 rounded-full bg-green" />
            <span aria-hidden className="absolute right-[10%] bottom-[12%] h-2.5 w-6 rounded-full bg-orange/80" />
            <BlinkingCharacter id="leon" priority className="relative" sizes="(min-width: 1024px) 470px, 76vw" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
