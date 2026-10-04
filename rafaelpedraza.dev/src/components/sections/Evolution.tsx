import { motion, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react'
import { useLayoutEffect, useRef, useState } from 'react'
import { evolution, type EvolutionStage } from '@/data/journey'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useIsDesktop, useReducedMotionPref } from '@/hooks/useMediaQuery'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { EASE_OUT, cn } from '@/lib/utils'

function StageCard({ stage, active }: { stage: EvolutionStage; active: boolean }) {
  const t = useT()
  const Icon = stage.icon
  return (
    <div
      className={cn(
        'panel relative h-full overflow-hidden p-6 transition-[border-color,opacity] duration-700',
        active ? 'border-line-strong opacity-100' : 'opacity-45',
        stage.current && active && 'border-cyan/40',
      )}
    >
      <div className="flex items-start justify-between">
        <span className={cn('grid size-11 place-items-center rounded-lg border transition-colors duration-700', active ? 'border-cyan/50 text-cyan' : 'border-line text-dim')}>
          <Icon size={20} strokeWidth={1.5} />
        </span>
        <span className="hud !text-[10px] text-dim">
          {t(ui.evolution.stage)} {stage.label}
          {stage.current && <span className="ml-2 text-cyan">· {t(ui.evolution.current)}</span>}
        </span>
      </div>
      <h3 className="mt-6 font-display text-2xl font-semibold tracking-tight">{t(stage.title)}</h3>
      <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{t(stage.text)}</p>
      <div className="mt-5 flex flex-wrap gap-1.5">
        {stage.tags.map((tag) => (
          <span key={tag} className="chip !text-[10.5px]">{tag}</span>
        ))}
      </div>
    </div>
  )
}

/** Desktop: sticky horizontal track driven by vertical scroll. */
function EvolutionHorizontal() {
  const t = useT()
  const outer = useRef<HTMLDivElement>(null)
  const track = useRef<HTMLDivElement>(null)
  const [distance, setDistance] = useState(0)
  const [active, setActive] = useState(0)

  useLayoutEffect(() => {
    const measure = () => {
      if (!track.current) return
      setDistance(Math.max(0, track.current.scrollWidth - window.innerWidth + 64))
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (track.current) ro.observe(track.current)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const { scrollYProgress } = useScroll({ target: outer, offset: ['start start', 'end end'] })
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.35 })
  const x = useTransform(smooth, [0.05, 0.95], [0, -distance])
  const fill = useTransform(smooth, [0.05, 0.95], [0, 1])

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setActive(Math.min(evolution.length - 1, Math.max(0, Math.floor(((v - 0.02) / 0.9) * evolution.length))))
  })

  return (
    <div ref={outer} style={{ height: `calc(100vh + ${Math.max(distance, 400)}px)` }} className="relative">
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <div className="container-x">
          <SectionHeader index="02" kicker={t(ui.evolution.kicker)} title={t(ui.evolution.title)} className="!mb-10" />
        </div>
        <ProgressTrack fill={fill} active={active} />
        <motion.div ref={track} style={{ x }} className="flex gap-5 pt-8 pr-16 pl-[max(1rem,calc((100vw-1240px)/2+2.5rem))] will-change-transform">
          {evolution.map((s, i) => (
            <div key={s.id} className="w-[380px] shrink-0">
              <StageCard stage={s} active={i <= active} />
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

function ProgressTrack({ fill, active }: { fill: MotionValue<number>; active: number }) {
  return (
    <div className="container-x">
      <div className="relative flex items-center justify-between">
        <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
        <motion.span className="absolute inset-x-0 top-1/2 h-px origin-left bg-gradient-to-r from-volt via-cyan to-violet" style={{ scaleX: fill }} />
        {evolution.map((s, i) => (
          <div key={s.id} className="relative flex flex-col items-center">
            <span
              className={cn(
                'size-2.5 rotate-45 border transition-all duration-500',
                i <= active ? 'border-cyan bg-cyan shadow-[0_0_14px_rgb(82_211_255)]' : 'border-line-strong bg-ink',
                i === active && 'scale-150',
              )}
            />
            <span className={cn('hud absolute top-5 !text-[9px] whitespace-nowrap transition-colors duration-500', i <= active ? 'text-fg/80' : 'text-dim')}>{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Mobile / reduced motion: vertical timeline that lights stage by stage. */
function EvolutionVertical() {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.7', 'end 0.6'] })
  const [active, setActive] = useState(-1)
  useMotionValueEvent(scrollYProgress, 'change', (v) => setActive(Math.floor(v * evolution.length * 0.999)))

  return (
    <div className="container-x py-20">
      <SectionHeader index="02" kicker={t(ui.evolution.kicker)} title={t(ui.evolution.title)} />
      <div ref={ref} className="relative space-y-4 pl-8">
        <span className="absolute top-0 bottom-0 left-[5px] w-px bg-line" />
        <motion.span className="absolute top-0 bottom-0 left-[5px] w-px origin-top bg-gradient-to-b from-volt via-cyan to-violet" style={{ scaleY: scrollYProgress }} />
        {evolution.map((s, i) => (
          <motion.div key={s.id} className="relative" initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.6, ease: EASE_OUT }}>
            <span className={cn('absolute top-7 -left-[31px] size-2.5 rotate-45 border transition-colors duration-500', i <= active ? 'border-cyan bg-cyan' : 'border-line-strong bg-ink')} />
            <StageCard stage={s} active={i <= active} />
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export function Evolution() {
  const desktop = useIsDesktop()
  const reduce = useReducedMotionPref()
  return <section id="evolution" className="relative">{desktop && !reduce ? <EvolutionHorizontal /> : <EvolutionVertical />}</section>
}
