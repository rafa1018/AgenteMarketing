import { motion } from 'motion/react'
import { ArrowRight, GraduationCap, Play } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { TradingScene } from '@/components/scene/TradingScene'
import { useT } from '@/i18n'
import { links, ui } from '@/i18n/ui'
import { EASE_OUT, scrollToId } from '@/lib/utils'

export function Hero({ ready = true }: { ready?: boolean }) {
  const t = useT()
  // entrance animations start when the page preloader is gone
  const show = (delay: number) => ({ initial: { opacity: 0, y: 24 }, animate: ready ? { opacity: 1, y: 0 } : {}, transition: { duration: 0.9, ease: EASE_OUT, delay } })
  return (
    <section id="home" className="relative overflow-hidden pt-28 pb-10 sm:pt-32 lg:pb-16">
      <div className="container-x grid items-center gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-8">
        <div>
          <motion.p {...show(0.05)} className="chip !text-cyan">
            <span className="size-1.5 animate-pulse rounded-full bg-cyan" /> {t(ui.hero.kicker)}
          </motion.p>
          <motion.h1 {...show(0.15)} className="mt-6 font-display text-[clamp(2.4rem,5vw,4.3rem)] leading-[0.98] font-semibold tracking-[-0.04em]">
            <span className="text-silver">{t(ui.hero.title1)}</span>
            <br />
            <span className="text-gold">{t(ui.hero.title2)}</span>
          </motion.h1>
          <motion.p {...show(0.3)} className="mt-6 max-w-xl text-[17px] leading-relaxed text-fg/85">
            {t(ui.hero.lead)}
          </motion.p>
          <motion.p {...show(0.38)} className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
            {t(ui.hero.sub)}
          </motion.p>
          <motion.div {...show(0.48)} className="mt-9 flex flex-wrap gap-3">
            <Button href={links.signup} icon={ArrowRight} iconRight>
              {t(ui.hero.start)}
            </Button>
            <Button variant="secondary" icon={Play} onClick={() => scrollToId('platform')}>
              {t(ui.hero.explore)}
            </Button>
          </motion.div>
          <motion.a {...show(0.56)} href={links.masterclass} className="mt-5 inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-cyan">
            <GraduationCap size={16} className="text-cyan" /> {t(ui.hero.masterclass)} <ArrowRight size={14} />
          </motion.a>
        </div>

        <motion.div initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={ready ? { opacity: 1, y: 0, scale: 1 } : {}} transition={{ duration: 1, ease: EASE_OUT, delay: 0.1 }} className="relative">
          <div aria-hidden className="absolute inset-[8%] -z-10 rounded-full bg-[radial-gradient(closest-side,rgb(var(--brand-rgb)/0.18),transparent)] blur-2xl" />
          <TradingScene ready={ready} />
        </motion.div>
      </div>
    </section>
  )
}
