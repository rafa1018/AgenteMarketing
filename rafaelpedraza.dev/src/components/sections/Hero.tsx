import { motion, useMotionValue, useScroll, useSpring, useTransform } from 'motion/react'
import { ArrowDown, ArrowRight, Download, Mail } from 'lucide-react'
import { useRef, type PointerEvent } from 'react'
import { profile } from '@/data/profile'
import { useFinePointer } from '@/hooks/useMediaQuery'
import { Button } from '@/components/ui/Button'
import { HeroPortrait } from './hero/HeroPortrait'
import { VisitCounter } from '@/components/ui/VisitCounter'
import { EASE_OUT, scrollToId } from '@/lib/utils'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'

// background-clip:text doesn't reach individually transformed glyphs, so the
// blue→cyan gradient is interpolated per letter instead.
const lerpColor = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(' ')})`
const VOLT = [47, 140, 255]
const CYAN = [82, 211, 255]

function SplitName({ text, ready, delay, className, gradient }: { text: string; ready: boolean; delay: number; className?: string; gradient?: boolean }) {
  return (
    <span className={`block overflow-hidden pb-[0.04em] ${className ?? ''}`} aria-hidden>
      {text.split('').map((ch, i) => (
        <motion.span
          key={i}
          style={gradient ? { color: lerpColor(VOLT, CYAN, i / Math.max(1, text.length - 1)) } : undefined}
          className="inline-block will-change-transform"
          initial={{ y: '105%', opacity: 0 }}
          animate={ready ? { y: '0%', opacity: 1 } : {}}
          transition={{ duration: 1, ease: EASE_OUT, delay: delay + i * 0.045 }}
        >
          {ch}
        </motion.span>
      ))}
    </span>
  )
}

export function Hero({ ready }: { ready: boolean }) {
  const t = useT()
  const ref = useRef<HTMLElement>(null)
  const fine = useFinePointer()
  const mxRaw = useMotionValue(0)
  const myRaw = useMotionValue(0)
  const mx = useSpring(mxRaw, { stiffness: 60, damping: 18, mass: 0.6 })
  const my = useSpring(myRaw, { stiffness: 60, damping: 18, mass: 0.6 })

  // scroll-out: hero content recedes as the manifesto takes over
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 120])
  const contentOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0])
  const portraitScale = useTransform(scrollYProgress, [0, 1], [1, 0.92])

  const onMove = (e: PointerEvent) => {
    if (!fine) return
    mxRaw.set((e.clientX / window.innerWidth) * 2 - 1)
    myRaw.set((e.clientY / window.innerHeight) * 2 - 1)
  }

  const show = (delay: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: ready ? { opacity: 1, y: 0 } : {},
    transition: { duration: 0.9, ease: EASE_OUT, delay },
  })

  return (
    <section id="home" ref={ref} onPointerMove={onMove} className="relative flex min-h-svh flex-col overflow-hidden pt-24 pb-10 lg:pt-20">
      <div className="container-x relative grid flex-1 items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-6">
        <motion.div style={{ y: contentY, opacity: contentOpacity }} className="relative z-10 order-1">
          <motion.div {...show(0.05)} className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-line bg-navy/40 py-1.5 pr-3.5 pl-2.5 backdrop-blur">
            <span className="relative flex size-2">
              <span className="absolute inset-0 rounded-full bg-ok animate-pulse-ring" />
              <span className="relative size-2 rounded-full bg-ok" />
            </span>
            <span className="hud !text-[10px] text-muted">
              {t(ui.hero.status)}
            </span>
          </motion.div>

          <h1 className="font-display text-[clamp(3.2rem,9.2vw,7rem)] leading-[0.88] whitespace-nowrap font-bold tracking-[-0.045em]">
            <span className="sr-only">{profile.fullName}</span>
            <SplitName text={profile.name.first.toUpperCase()} ready={ready} delay={0.1} className="text-fg" />
            <SplitName text={profile.name.last.toUpperCase()} ready={ready} delay={0.3} gradient />
          </h1>

          <motion.ul {...show(0.75)} className="mt-7 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6">
            {profile.roles.map((r) => (
              <li key={r.en} className="flex items-center gap-2.5 font-mono text-[11.5px] tracking-[0.22em] text-fg/85 uppercase sm:text-xs">
                <span className="size-1.5 rotate-45 border border-cyan" />
                {t(r)}
              </li>
            ))}
          </motion.ul>

          <motion.p {...show(0.9)} className="mt-7 max-w-[34rem] text-lg leading-relaxed text-muted sm:text-xl">
            {t(profile.tagline)}
          </motion.p>

          <motion.div {...show(1.05)} className="mt-9 flex flex-wrap gap-3">
            <Button icon={ArrowRight} iconRight onClick={() => scrollToId('projects')}>
              {t(ui.hero.explore)}
            </Button>
            <Button variant="secondary" icon={Download} href={profile.links.cv} download>
              {t(ui.nav.downloadCv)}
            </Button>
            <Button variant="ghost" icon={Mail} onClick={() => scrollToId('contact')} className="!px-3">
              {t(ui.hero.contact)}
            </Button>
          </motion.div>
        </motion.div>

        <motion.div className="relative order-2 mx-auto w-full max-w-[460px] lg:max-w-none" style={{ scale: portraitScale }}>
          <HeroPortrait ready={ready} mx={mx} my={my} />
        </motion.div>
      </div>

      {/* bottom data strip + scroll cue: the line that continues into the next section */}
      <motion.div {...show(1.3)} className="container-x relative mt-10 hidden items-end justify-between gap-6 md:flex">
        <dl className="flex gap-10">
          {ui.hero.strip.map(({ k, v }) => (
            <div key={k.en}>
              <dt className="hud !text-[9px] text-dim">{t(k)}</dt>
              <dd className="mt-1 font-mono text-xs tracking-[0.08em] text-fg/80">{t(v)}</dd>
            </div>
          ))}
        </dl>
        <VisitCounter />
      </motion.div>
      <motion.button
        type="button"
        onClick={() => scrollToId('manifesto')}
        className="group absolute bottom-0 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 md:flex"
        initial={{ opacity: 0 }}
        animate={ready ? { opacity: 1 } : {}}
        transition={{ delay: 1.6, duration: 1 }}
        aria-label="Scroll to explore"
      >
        <span className="hud !text-[9px] text-dim transition-colors group-hover:text-cyan">{t(ui.hero.scroll)}</span>
        <ArrowDown size={13} className="text-cyan" />
        <span className="relative h-12 w-px overflow-hidden bg-line">
          <span className="absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-transparent to-cyan" style={{ animation: 'scan 2s ease-in-out infinite' }} />
        </span>
      </motion.button>
    </section>
  )
}
