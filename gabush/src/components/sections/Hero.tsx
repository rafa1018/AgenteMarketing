import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { site } from '@/data/site'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { EASE_OUT, cn, scrollToId } from '@/lib/utils'
import { useHeroScroll } from '@/components/animations'
import { useReducedMotionPref } from '@/hooks/useMediaQuery'
import { Cloud, Deco, Wave, usePointer } from '@/components/fx/Fx'

/** Header slider: the real façade first, then everyday life at Gabush. */
const SLIDES = [
  { id: 'hero-fachada', w: [960, 1600], pos: '22% 50%', alt: ui.hero.photoAlt },
  { id: 'espacio-salon', w: [640, 1280], pos: '50% 40%', alt: { es: 'Salón de clase con murales de colores', en: 'Classroom with colourful murals' } },
  { id: 'espacio-arte', w: [640, 1280], pos: '50% 50%', alt: { es: 'Niños pintando sobre tapetes de colores', en: 'Children painting on colourful mats' } },
  { id: 'espacio-psico', w: [640, 1280], pos: '50% 60%', alt: { es: 'Niños en circuito de psicomotricidad', en: 'Children on a motor-skills circuit' } },
]
const COLORS = ['#e5197e', '#f8c21c', '#1fa3dd', '#5cb531', '#f26b1d', '#23206b']

/** "con las artes" with every letter in a logo colour, bouncing in. */
function RainbowText({ text, play, delay = 0 }: { text: string; play: boolean; delay?: number }) {
  let n = 0
  return (
    <span aria-hidden className="inline-block">
      {text.split(' ').map((word, wi) => (
        <span key={wi} className="inline-block whitespace-nowrap">
          {[...word].map((ch) => {
            const i = n++
            return (
              <motion.span
                key={i}
                className="inline-block"
                style={{ color: COLORS[i % COLORS.length] }}
                initial={{ y: 40, opacity: 0, rotate: -20 }}
                animate={play ? { y: 0, opacity: 1, rotate: 0 } : undefined}
                transition={{ type: 'spring', stiffness: 380, damping: 13, delay: delay + i * 0.035 }}
                whileHover={{ y: -10, rotate: i % 2 ? 8 : -8 }}
              >
                {ch}
              </motion.span>
            )
          })}
          {wi < text.split(' ').length - 1 && <span className="inline-block w-[0.28em]" />}
        </span>
      ))}
    </span>
  )
}

function Slider({ ready }: { ready: boolean }) {
  const t = useT()
  const reduce = useReducedMotionPref()
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!ready || reduce) return
    const id = window.setInterval(() => setI((x) => (x + 1) % SLIDES.length), 4800)
    return () => window.clearInterval(id)
  }, [ready, reduce, i])
  const s = SLIDES[i]
  return (
    <div className="relative aspect-[5/4] overflow-hidden rounded-[30px] border-[7px] border-white bg-cloud shadow-[0_30px_60px_-30px_rgba(35,32,107,0.55)] sm:aspect-[16/12]">
      <AnimatePresence initial={false}>
        <motion.img
          key={s.id}
          src={`/images/opt/${s.id}-${s.w[0]}.webp`}
          srcSet={`/images/opt/${s.id}-${s.w[0]}.webp ${s.w[0]}w, /images/opt/${s.id}-${s.w[1]}.webp ${s.w[1]}w`}
          sizes="(min-width: 1024px) 600px, 92vw"
          alt={t(s.alt)}
          fetchPriority={i === 0 ? 'high' : undefined}
          className="absolute inset-0 size-full object-cover"
          style={{ objectPosition: s.pos }}
          initial={{ opacity: 0, scale: 1.12 }}
          animate={{ opacity: 1, scale: 1.02 }}
          exit={{ opacity: 0 }}
          transition={{ opacity: { duration: 0.9 }, scale: { duration: 6, ease: 'linear' } }}
        />
      </AnimatePresence>
      <div className="absolute right-3 bottom-3 flex gap-1.5 rounded-full bg-white/85 px-2.5 py-2 backdrop-blur">
        {SLIDES.map((x, k) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setI(k)}
            aria-label={`${k + 1} / ${SLIDES.length}`}
            aria-current={k === i}
            className={cn('h-2.5 rounded-full transition-all', k === i ? 'w-6' : 'w-2.5 bg-ink/25')}
            style={k === i ? { background: COLORS[k % COLORS.length] } : undefined}
          />
        ))}
      </div>
    </div>
  )
}

export function Hero({ ready }: { ready: boolean }) {
  const t = useT()
  const hero = useHeroScroll()
  const pointer = usePointer()

  const show = (delay: number) => ({
    initial: { opacity: 0, y: 22 },
    animate: ready ? { opacity: 1, y: 0 } : undefined,
    transition: { duration: 0.7, delay, ease: EASE_OUT },
  })

  return (
    <section id="inicio" ref={hero.ref} className="relative overflow-clip bg-[linear-gradient(180deg,#a8e1ff_0%,#d6f1ff_45%,#f4fbff_80%,#ffffff_100%)] pt-28 sm:pt-32">
      {/* sky */}
      <Cloud className="top-[14%]" size={200} duration={80} delay={10} />
      <Cloud className="top-[42%]" size={130} duration={95} delay={55} opacity={0.85} />
      <Cloud className="top-[6%]" size={110} duration={70} delay={40} opacity={0.7} />

      {/* floating objects (anim-icons) */}
      <Deco src="/images/opt/anim-1.webp" width={92} className="top-24 left-[2%] hidden sm:block" anim="sway" depth={28} pointer={pointer} />
      <Deco src="/images/opt/anim-10.webp" width={120} className="top-24 right-[3%] hidden md:block" anim="float" depth={36} delay={0.2} pointer={pointer} />
      <Deco src="/images/opt/anim-5.webp" width={60} className="top-[15%] left-[45%] hidden lg:block" anim="float" depth={18} delay={0.4} duration={7} pointer={pointer} />
      <Deco src="/images/opt/anim-11.webp" width={110} className="top-[58%] left-[-1%] hidden lg:block opacity-80" anim="none" depth={10} pointer={pointer} />
      <Deco src="/images/opt/anim-7.webp" width={78} className="right-[1%] bottom-[30%] hidden xl:block" anim="float" depth={40} delay={0.3} duration={8} pointer={pointer} />

      <div className="container-x relative grid items-center gap-14 pb-[max(9rem,calc(13vw+4.5rem))] lg:grid-cols-[1.02fr_1fr] lg:gap-10">
        {/* copy */}
        <motion.div className="relative z-10" style={hero.copy}>
          <motion.div {...show(0)} className="flex flex-wrap items-center gap-2.5">
            <p className="kicker">{t(ui.hero.kicker)}</p>
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[13px] font-extrabold text-leaf shadow-[0_0_0_2px_#d9f0cd]">
              <span className="relative flex size-2.5">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-green" />
                <span className="relative size-2.5 rounded-full bg-green" />
              </span>
              {t(ui.hero.badge)}
            </p>
          </motion.div>

          <h1 className="mt-6 text-[clamp(2.9rem,7.4vw,5.4rem)] leading-[0.98] font-bold" aria-label={t(ui.hero.title)}>
            <motion.span aria-hidden {...show(0.08)} className="block text-ink">
              {t(ui.hero.titleA)}
            </motion.span>
            <RainbowText text={t(ui.hero.titleB)} play={ready} delay={0.25} />
          </h1>

          <motion.p {...show(0.3)} className="mt-6 max-w-xl text-lg font-medium text-text/80 sm:text-xl">
            {t(site.slogan)}
          </motion.p>

          <motion.div {...show(0.4)} className="mt-9 flex flex-col gap-3.5 sm:flex-row">
            <button type="button" onClick={() => scrollToId('contacto')} className="btn btn-pink">
              {t(ui.hero.enroll)}
              <ArrowRight size={19} strokeWidth={2.5} />
            </button>
            <button type="button" onClick={() => scrollToId('programas')} className="btn btn-ghost">
              {t(ui.hero.programs)}
            </button>
          </motion.div>

          <motion.dl {...show(0.5)} className="mt-10 flex flex-wrap gap-3">
            {[
              { n: '12', label: ui.hero.perClass, c: '#e5197e' },
              { n: '4', label: ui.hero.levels, c: '#1fa3dd' },
            ].map((s) => (
              <div key={s.n} className="flex items-center gap-3 rounded-2xl bg-white/85 py-2 pr-4 pl-2 shadow-[0_8px_20px_-14px_rgba(35,32,107,0.5)] backdrop-blur">
                <dt className="block-letter text-[1.9rem]" style={{ background: s.c }}>
                  {s.n}
                </dt>
                <dd className="max-w-[10rem] text-[14px] leading-tight font-bold text-ink">{t(s.label)}</dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>

        {/* slider + mascot */}
        <motion.div style={hero.photo} className="relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.85, rotate: 4 }}
            animate={ready ? { opacity: 1, scale: 1, rotate: -2 } : undefined}
            transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.15 }}
            className="relative mx-auto w-full max-w-[600px]"
          >
            <Slider ready={ready} />

            {/* girl jumping (anim-icon-16) */}
            <Deco src="/images/opt/anim-16.webp" width={118} className="-top-16 -right-3 sm:-right-10" anim="float" depth={30} delay={0.9} pointer={pointer} />
            {/* ABC blocks */}
            <Deco src="/images/opt/anim-3.webp" width={62} className="-right-2 -bottom-12 sm:-right-8" anim="wiggle" depth={22} delay={1.1} pointer={pointer} />

            {/* Gabush the lion, with a speech bubble */}
            <motion.div
              className="absolute -bottom-16 -left-4 w-[34%] max-w-[190px] sm:-left-14"
              initial={{ y: 120, opacity: 0 }}
              animate={ready ? { y: 0, opacity: 1 } : undefined}
              transition={{ type: 'spring', stiffness: 160, damping: 12, delay: 0.7 }}
            >
              <motion.span
                className="absolute -top-12 left-[58%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 font-serif text-[15px] font-semibold whitespace-nowrap text-ink shadow-[0_10px_22px_-12px_rgba(35,32,107,0.6)]"
                initial={{ scale: 0, opacity: 0 }}
                animate={ready ? { scale: 1, opacity: 1 } : undefined}
                transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 1.4 }}
                style={{ originX: 0, originY: 1 }}
              >
                {t(ui.hero.hello)} 👋
              </motion.span>
              <div className="origin-bottom animate-wiggle" style={{ animationDuration: '3.2s' }}>
                <img src="/images/opt/lion-400.webp" srcSet="/images/opt/lion-200.webp 200w, /images/opt/lion-400.webp 400w" sizes="190px" alt="" width={400} height={528} className="w-full drop-shadow-[0_14px_16px_rgba(35,32,107,0.25)]" />
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* grass & trees: shown whole (never cropped), on a strip of the same green, then a white wave */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0">
        <img
          src="/images/opt/grass-1000.webp"
          srcSet="/images/opt/grass-1000.webp 1000w, /images/opt/grass-2000.webp 2000w"
          sizes="100vw"
          alt=""
          width={1000}
          height={130}
          className="block h-auto min-h-[84px] w-full object-cover object-[18%_top] sm:object-top"
        />
        <div className="h-10 bg-[#789b34] sm:h-14" />
        <Wave color="#fff" className="absolute inset-x-0 -bottom-px" />
      </div>
    </section>
  )
}
