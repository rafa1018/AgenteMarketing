import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { ArrowRight, ChevronsDown, Crosshair, Play, Radar as RadarIcon } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BotFigure } from '@/components/scene/BotFigure'
import { LAYOUT, Phone, RADAR_LOCK, RADAR_ZONES, Workspace, useLiveZones } from '@/components/scene/TradingScene'
import { PHASE_LEN, SPEC, TRADES, initialState, money, pnlOf, price, step as stepEngine, type SceneState } from '@/components/scene/engine'
import { useT } from '@/i18n'
import { links, ui } from '@/i18n/ui'
import { cn } from '@/lib/utils'

/**
 * The home of the site, as one scroll-driven story:
 *   welcome (impact title + message + CTAs) → a big closed laptop rises and opens → MiMatt PRO boots
 *   with a burst of light → four chapters: a spotlight travels across the platform (chart, radar,
 *   signal) while holographic cards slide out of the screen → the phone executes and shows the result.
 * The laptop stays big and centered (no camera jumps); headlines change above it like a product launch.
 * Scrolling back plays it in reverse. Reduced motion gets a static version.
 */

const EASE = [0.22, 1, 0.36, 1] as const

/** Stage geometry (design px): wide = landscape screens, medium = squarish screens (tablets, small windows),
 *  tall = portrait phones. Laptop base size: 560×368 (scaled by ls). */
const GEO = {
  wide: { W: 1200, H: 680, ls: 1.42, laptop: { left: 202, top: 120 }, liq: { left: 905, top: 64 }, sig: { left: 10, top: 250 }, phone: { left: 985, top: 245 }, bot: { left: 26, top: 450 }, res: { left: 0, top: 150 } },
  medium: { W: 1000, H: 800, ls: 1.6, laptop: { left: 52, top: 30 }, liq: { left: 690, top: 330 }, sig: { left: 20, top: 330 }, phone: { left: 800, top: 300 }, bot: { left: 18, top: 600 }, res: { left: 30, top: 420 } },
  // phones: cards under the laptop; at the end the phone and the result card sit side by side
  tall: { W: 600, H: 830, ls: 1, laptop: { left: 20, top: 30 }, liq: { left: 155, top: 430 }, sig: { left: 155, top: 430 }, phone: { left: 22, top: 420 }, bot: null, res: { left: 226, top: 470 } },
}
type Layout = keyof typeof GEO
type Geo = (typeof GEO)[Layout]

/** Spotlight targets inside the laptop screen (538×330). */
const SPOT = [
  { left: 28, top: 56, width: 350, height: 274 }, // chart
  { left: 386, top: 62, width: 148, height: 156 }, // radar
  { left: 120, top: 112, width: 236, height: 186 }, // signal (entry area)
  { left: 0, top: 0, width: 538, height: 330 }, // whole screen
]

// chapters (share of the pinned section)
const CH = [0.44, 0.58, 0.71, 0.84]

function buildTimeline(): SceneState[] {
  let s = initialState()
  const out = [s]
  // ends on the last tick of the result: position closed, chart badge already gone (no duplicate of the big result)
  const ticks = PHASE_LEN.scan + PHASE_LEN.signal + PHASE_LEN.order + PHASE_LEN.trade + PHASE_LEN.result - 1
  for (let i = 0; i < ticks; i++) out.push((s = stepEngine(s)))
  return out
}

const seg = (p: number, a: number, b: number) => Math.max(0, Math.min(1, (p - a) / (b - a)))

/** Live feel: the last candle keeps ticking (price, wicks, open P&L) even while the scroll is still. */
function breathe(s: SceneState, tick: number): SceneState {
  if (tick === 0 || s.candles.length === 0) return s
  const vol = SPEC[s.sym].vol
  const n = Math.sin(tick * 1.7) * 0.6 + Math.sin(tick * 0.43 + 1) * 0.4 // smooth pseudo-noise in [-1, 1]
  const last = s.candles[s.candles.length - 1]
  const c = Math.round((last.c + n * vol * 0.55) / 0.25) * 0.25
  const candles = [...s.candles.slice(0, -1), { ...last, c, h: Math.max(last.h, c), l: Math.min(last.l, c) }]
  const trade = TRADES[s.tradeIdx]
  return { ...s, candles, openPnl: s.phase === 'trade' ? pnlOf(s.sym, trade.side, s.entry, c) : s.openPnl }
}
export function Tour({ ready = true }: { ready?: boolean }) {
  const reduce = useReducedMotion()
  return reduce ? <TourStatic /> : <TourPinned ready={ready} />
}

function TourPinned({ ready }: { ready: boolean }) {
  const t = useT()
  const ref = useRef<HTMLElement>(null)
  const stageBox = useRef<HTMLDivElement>(null)
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const [layout, setLayout] = useState<Layout>('wide')
  const tall = layout === 'tall'
  const [scale, setScale] = useState(1)
  const [chapter, setChapter] = useState(-1)
  const [phase, setPhase] = useState<'welcome' | 'intro' | 'live'>('welcome')
  const [idx, setIdx] = useState(0)
  const TL = useMemo(buildTimeline, [])
  const G: Geo = GEO[layout]

  // fit the stage to the space under the headline (portrait phones get the tall composition)
  useLayoutEffect(() => {
    const el = stageBox.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e.contentRect
      const ratio = width / height
      const l: Layout = ratio < 0.85 ? 'tall' : ratio < 1.45 ? 'medium' : 'wide'
      setLayout(l)
      setScale(Math.min(width / GEO[l].W, height / GEO[l].H))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // story beats from the scroll position
  const sigFirst = PHASE_LEN.scan + 1
  const tradeFirst = sigFirst + PHASE_LEN.signal
  const last = TL.length - 1
  useMotionValueEvent(p, 'change', (v) => {
    setPhase(v < 0.1 ? 'welcome' : v < 0.4 ? 'intro' : 'live')
    setChapter(v < CH[0] ? -1 : v < CH[1] ? 0 : v < CH[2] ? 1 : v < CH[3] ? 2 : 3)
    let i = 0
    if (v >= 0.4 && v < CH[1]) i = Math.round(seg(v, 0.4, CH[1]) * (sigFirst - 1))
    else if (v >= CH[1] && v < CH[2]) i = sigFirst + Math.round(seg(v, CH[1], CH[2]) * (PHASE_LEN.signal - 1))
    else if (v >= CH[2] && v < 0.9) i = tradeFirst + Math.round(seg(v, CH[2], 0.9) * (last - 1 - tradeFirst))
    else if (v >= 0.9) i = last
    setIdx(i)
  })
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (phase !== 'live') return
    const id = window.setInterval(() => setTick((n) => n + 1), 420)
    return () => window.clearInterval(id)
  }, [phase])
  const state = useMemo(() => breathe(TL[idx], tick), [TL, idx, tick])
  const live = useLiveZones()
  const done = idx === last

  // laptop: big from the start, rises, opens, boots with a burst of light
  const lapY = useTransform(p, [0.08, 0.17], [G.H * 0.6, 0])
  const lapO = useTransform(p, [0.08, 0.14], [0, 1])
  const lid = useTransform(p, [0.19, 0.31], [-86, 0])
  const bootO = useTransform(p, [0.29, 0.31, 0.37, 0.4], [0, 1, 1, 0])
  const bootW = useTransform(p, [0.31, 0.37], ['0%', '100%'])
  const liveO = useTransform(p, [0.37, 0.41], [0, 1])
  const flash = useTransform(p, [0.3, 0.38, 0.42, 0.6], [0, 1, 0.55, 0.35])
  const sweepX = useTransform(p, [0.37, 0.42], ['-120%', '220%'])

  // welcome (first screen): visible on load, the scroll shrinks it away before the laptop rises
  const titleScale = useTransform(p, [0.015, 0.12], [1, 0.62])
  const titleY = useTransform(p, [0.015, 0.12], ['0vh', '-28vh'])
  const titleO = useTransform(p, [0.06, 0.12], [1, 0])
  const hintO = useTransform(p, [0, 0.03], [1, 0])
  const show = (delay: number) => ({ initial: { opacity: 0, y: 18 }, animate: ready ? { opacity: 1, y: 0 } : {}, transition: { duration: 0.8, delay, ease: EASE } })
  const explore = () => {
    const el = ref.current
    if (!el) return
    const top = el.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: top + (el.offsetHeight - window.innerHeight) * 0.45, behavior: 'smooth' })
  }

  const word = 'MIMATT PRO'
  const trade = TRADES[0]
  const sideLabel = t(trade.side === 'long' ? ui.scene.long : ui.scene.short)
  const phoneL = { ...LAYOUT.wide, phone: { left: 0, top: 0 } }
  const rr = (Math.abs(state.target - state.entry) / Math.max(0.25, Math.abs(state.entry - state.stop))).toFixed(1)
  const head = chapter >= 0 ? { n: chapter + 1, title: ui.tour.steps[chapter].title, text: ui.tour.steps[chapter].text } : { n: 0, title: ui.tour.intro, text: null }

  return (
    <section ref={ref} id="home" aria-label="MiMatt PRO" className="relative h-[640vh] sm:h-[720vh]">
      <div className="sticky top-0 h-svh overflow-hidden">
        {/* ambient light + grid + burst when the screen turns on */}
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_45%,rgb(var(--brand-rgb)/0.16),transparent_70%)]" />
        <motion.div aria-hidden style={{ opacity: flash }} className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_45%_40%_at_50%_62%,rgb(var(--brand-1-rgb)/0.45),transparent_70%)]" />
        <div aria-hidden className="grid-bg pointer-events-none absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_70%_60%_at_50%_55%,black,transparent)]" />

        {/* ── chapter headline (above the laptop) ── */}
        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 px-4 text-center sm:top-20">
          <AnimatePresence mode="wait">
            {phase !== 'welcome' && (
              <motion.div key={head.n} initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -14, filter: 'blur(6px)' }} transition={{ duration: 0.45, ease: EASE }}>
                {head.n > 0 && (
                  <p className="mb-2 flex items-center justify-center gap-3 font-mono text-[11px] tracking-[0.3em] text-cyan">
                    <span>0{head.n}</span>
                    <span className="flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <span key={i} className={cn('h-0.5 w-5 rounded-full', i <= head.n ? 'bg-cyan' : 'bg-white/15')} />
                      ))}
                    </span>
                    <span className="text-dim">04</span>
                  </p>
                )}
                <h2 className="font-display text-[clamp(1.6rem,4.4vw,3.2rem)] leading-[1.05] font-semibold tracking-[-0.03em]">
                  <span className={head.n === 0 ? 'text-silver' : 'text-gold'}>{t(head.title)}</span>
                </h2>
                {head.text && <p className="mx-auto mt-2 max-w-xl text-[13.5px] leading-relaxed text-muted sm:text-[15.5px]">{t(head.text)}</p>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── stage (scaled to fit under the headline) ── */}
        <div ref={stageBox} className="absolute inset-x-0 top-[200px] bottom-12 sm:top-[220px] sm:bottom-10">
          <div className="absolute top-1/2 left-1/2" style={{ width: G.W, height: G.H, transform: `translate(-50%, -50%) scale(${scale})` }}>
            {/* laptop (big) */}
            <motion.div className="absolute origin-top-left" style={{ ...G.laptop, width: 560, y: lapY, opacity: lapO, scale: G.ls, perspective: 1100, perspectiveOrigin: '50% -110%' }}>
              <motion.div className="relative" style={{ rotateX: lid, transformOrigin: '50% 100%', transformStyle: 'preserve-3d' }}>
                {/* back of the lid (seen while closed) */}
                <div aria-hidden className="absolute inset-0 grid place-items-center rounded-[18px] border border-[#3a4d74] bg-[linear-gradient(160deg,#1a2c52,#0b1630_55%,#14254a)] [backface-visibility:hidden]" style={{ transform: 'rotateX(180deg)' }}>
                  <img src="/images/logo-256.webp" alt="" className="size-32 drop-shadow-[0_0_28px_rgb(var(--brand-rgb)/0.6)]" />
                </div>
                {/* bezel + screen */}
                <div className="rounded-[18px] border border-[#2a3a5c] bg-[#0b1426] p-[10px] shadow-[0_50px_100px_-25px_rgb(0_0_0/0.95),0_0_0_1px_rgb(var(--brand-1-rgb)/0.12),0_0_80px_-30px_rgb(var(--brand-rgb)/0.6)] [backface-visibility:hidden]">
                  <div className="relative h-[330px] overflow-hidden rounded-[9px] bg-[#060d1b]">
                    <motion.div style={{ opacity: liveO }} className="h-full">
                      <Workspace state={state} sideLabel={sideLabel} />
                    </motion.div>

                    {/* spotlight: dims the screen except the part each chapter is about */}
                    <motion.div
                      aria-hidden
                      className="pointer-events-none absolute rounded-lg border border-[var(--brand-1)]"
                      initial={false}
                      animate={{ ...SPOT[Math.max(0, chapter)], opacity: chapter >= 0 && chapter < 3 ? 1 : 0 }}
                      transition={{ type: 'spring', stiffness: 90, damping: 18 }}
                      style={{ boxShadow: '0 0 0 1400px rgb(2 8 20 / 0.62), 0 0 26px rgb(var(--brand-1-rgb) / 0.55), inset 0 0 22px rgb(var(--brand-1-rgb) / 0.18)' }}
                    />

                    {/* boot screen (progress follows the scroll) */}
                    <motion.div style={{ opacity: bootO }} className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#10234a,#060d1b_70%)]">
                      <img src="/images/logo-128.webp" alt="" className="size-16 drop-shadow-[0_6px_20px_rgb(var(--brand-rgb)/0.5)]" />
                      <p className="mt-3 font-display text-[20px] font-semibold">
                        <span className="text-silver">MiMatt</span> <span className="text-gold">PRO</span>
                      </p>
                      <p className="mt-1 font-mono text-[9.5px] tracking-[0.2em] text-muted uppercase">{t(ui.tour.boot)}…</p>
                      <div className="mt-4 h-[3px] w-48 overflow-hidden rounded-full bg-white/10">
                        <motion.div className="h-full rounded-full bg-gradient-to-r from-[var(--brand-3)] to-[var(--brand-hi)]" style={{ width: bootW }} />
                      </div>
                    </motion.div>
                    {/* light sweep when it goes live */}
                    <motion.div aria-hidden style={{ x: sweepX }} className="pointer-events-none absolute inset-y-0 w-1/3 skew-x-[-18deg] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  </div>
                </div>
              </motion.div>
              {/* base */}
              <div className="relative mx-auto h-4 w-[560px] scale-x-110 rounded-b-[14px] bg-gradient-to-b from-[#2a3a5c] to-[#121d33] shadow-[0_22px_40px_-12px_rgb(0_0_0/0.95)]">
                <div className="absolute top-0 left-1/2 h-1.5 w-24 -translate-x-1/2 rounded-b-md bg-[#0b1426]" />
              </div>
            </motion.div>

            {/* ── holographic cards that slide out of the screen ── */}
            <AnimatePresence>
              {chapter === 1 && (
                <HoloCard key="liq" at={G.liq} from={tall ? { y: -40 } : { x: -60 }}>
                  <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-cyan uppercase">
                    <RadarIcon size={13} /> {t(ui.tour.liqTitle)}
                  </p>
                  <div className="mt-3 flex items-center gap-4">
                    <Gauge pct={live[RADAR_LOCK[0]]} />
                    <div className="min-w-0">
                      <p className="font-mono text-[9.5px] tracking-[0.12em] text-dim uppercase">{t(ui.tour.hit)}</p>
                      <span className="mt-1 inline-block rounded bg-long/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-long">{RADAR_ZONES[RADAR_LOCK[0]].side}</span>
                      <p className="mt-0.5 font-display text-[17px] font-semibold tabular-nums">
                        {price(state.entry - 4)} – {price(state.entry + 2)}
                      </p>
                      <p className="font-mono text-[10px] text-dim">NQ · 1m</p>
                    </div>
                  </div>
                  <p className="mt-3 font-mono text-[9px] tracking-[0.14em] text-dim uppercase">{t(ui.tour.otherZones)}</p>
                  <ul className="mt-1.5 space-y-1.5">
                    {[4, 1, 3, 2].map((z) => (
                      <li key={z} className="flex items-center gap-2 font-mono text-[10.5px]">
                        <span className={cn('w-10 shrink-0 font-bold', RADAR_ZONES[z].side === 'CALL' ? 'text-long' : 'text-short')}>{RADAR_ZONES[z].side}</span>
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                          <motion.span className={cn('block h-full rounded-full', RADAR_ZONES[z].side === 'CALL' ? 'bg-long' : 'bg-short')} initial={{ width: 0 }} animate={{ width: `${live[z]}%` }} transition={{ duration: 0.9, ease: EASE }} />
                        </span>
                        <span className="w-9 text-right text-fg tabular-nums">{live[z]}%</span>
                      </li>
                    ))}
                  </ul>
                </HoloCard>
              )}
              {chapter === 2 && (
                <HoloCard key="sig" at={G.sig} from={tall ? { y: -40 } : { x: 60 }}>
                  <p className="flex items-center gap-2 font-mono text-[10px] tracking-[0.16em] text-cyan uppercase">
                    <Crosshair size={13} /> {t(ui.tour.sigTitle)}
                  </p>
                  <p className="mt-2 font-display text-[22px] font-bold text-long">{sideLabel} · NQ</p>
                  <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
                    {[
                      [ui.scene.entry, price(state.entry), 'text-fg'],
                      [ui.scene.target, price(state.target), 'text-long'],
                      [ui.scene.stop, price(state.stop), 'text-short'],
                    ].map(([l, v, c]) => (
                      <div key={String(c)} className="rounded-lg bg-white/5 px-1.5 py-1.5">
                        <dt className="font-mono text-[8.5px] tracking-[0.1em] text-dim uppercase">{t(l as typeof ui.scene.entry)}</dt>
                        <dd className={cn('font-mono text-[11.5px] font-semibold tabular-nums', c as string)}>{v as string}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="mt-2 font-mono text-[10px] text-muted">
                    {t(ui.tour.rr)} <span className="text-cyan">1 : {rr}</span>
                  </p>
                </HoloCard>
              )}
            </AnimatePresence>

            {/* MiMatt Bot (wide screens) */}
            <AnimatePresence>
              {G.bot && chapter >= 2 && (
                <motion.div key="bot" className="absolute" style={G.bot} initial={{ opacity: 0, x: -50, scale: 0.8 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.6, ease: EASE }}>
                  <BotFigure mood={chapter === 2 ? 'alert' : done ? 'win' : 'long'} size={150} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* phone + result */}
            <AnimatePresence>
              {chapter === 3 && (
                <motion.div key="phone" className="absolute" style={G.phone} initial={{ opacity: 0, x: tall ? 0 : 160, y: tall ? 160 : 0, rotate: tall ? 0 : 8 }} animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }} exit={{ opacity: 0, x: tall ? 0 : 160, y: tall ? 160 : 0 }} transition={{ duration: 0.7, ease: EASE }}>
                  <div className="relative" style={{ width: 184, height: 372 }}>
                    <Phone state={state} sideLabel={sideLabel} L={phoneL} />
                  </div>
                </motion.div>
              )}
              {chapter === 3 && done && (
                <HoloCard key="result" at={G.res} from={tall ? { y: 40 } : { x: 60 }}>
                  <p className="font-mono text-[10px] tracking-[0.16em] text-cyan uppercase">{t(ui.tour.result)}</p>
                  <p className="mt-1 font-display text-[44px] leading-none font-bold text-long tabular-nums drop-shadow-[0_0_30px_rgb(47_208_142/0.5)]">{money(state.lastPnl, true)}</p>
                  <p className="mt-2 font-mono text-[10.5px] text-muted">
                    {t(ui.scene.startBalance)} {money(10_000)} → <span className="text-fg">{money(state.balance)}</span>
                  </p>
                  <a href={links.signup} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-[var(--brand-btn)] to-[var(--brand-3)] font-mono text-[11.5px] font-semibold tracking-[0.16em] text-[var(--on-brand)] uppercase shadow-[0_10px_40px_-10px_rgb(var(--brand-rgb)/0.85)]">
                    {t(ui.tour.cta)} <ArrowRight size={15} />
                  </a>
                </HoloCard>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── welcome: the first screen of the site ── */}
        <motion.div style={{ scale: titleScale, y: titleY, opacity: titleO }} className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-4 pt-16 text-center">
          <motion.p {...show(0.05)} className="font-mono text-[11px] tracking-[0.5em] text-cyan uppercase sm:text-[13px]">
            {t(ui.tour.welcome)}
          </motion.p>
          <p className="mt-3 flex font-display text-[clamp(3.2rem,14vw,10.5rem)] leading-[0.88] font-bold tracking-[-0.045em]" aria-hidden>
            {word.split('').map((ch, i) => (
              <Letter key={i} ch={ch} i={i} ready={ready} gold={i >= 7} />
            ))}
          </p>
          <motion.h1 {...show(0.75)} className="mt-6 font-display text-[clamp(1.45rem,3.6vw,2.6rem)] leading-[1.1] font-semibold tracking-[-0.02em]">
            <span className="text-silver">{t(ui.hero.title1)}</span> <span className="text-gold">{t(ui.hero.title2)}</span>
          </motion.h1>
          <motion.p {...show(0.9)} className="mt-4 max-w-xl text-[15px] leading-relaxed text-fg/80 sm:text-[17px]">
            {t(ui.hero.lead)}
          </motion.p>
          <motion.ul {...show(1)} className="mt-4 flex max-w-xl flex-wrap justify-center gap-2">
            {ui.tour.keywords.map((k) => (
              <li key={k.en} className="chip !py-1 !text-[11px]">
                <span className="size-1 rounded-full bg-cyan" /> {t(k)}
              </li>
            ))}
          </motion.ul>
          <motion.div {...show(1.1)} className="pointer-events-auto mt-7 flex flex-wrap justify-center gap-3">
            <a href={links.signup} className="group inline-flex h-12 items-center gap-2.5 rounded-xl bg-gradient-to-b from-[var(--brand-btn)] to-[var(--brand-3)] px-6 font-mono text-[11.5px] font-semibold tracking-[0.18em] text-[var(--on-brand)] uppercase shadow-[0_10px_40px_-10px_rgb(var(--brand-rgb)/0.85)] transition-[filter] hover:brightness-110">
              {t(ui.hero.start)} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </a>
            <button type="button" onClick={explore} className="inline-flex h-12 items-center gap-2.5 rounded-xl border border-line-strong bg-navy/40 px-6 font-mono text-[11.5px] tracking-[0.18em] text-fg uppercase transition-colors hover:border-cyan/60">
              <Play size={14} /> {t(ui.hero.explore)}
            </button>
          </motion.div>
          <motion.p style={{ opacity: hintO }} className="mt-8 flex flex-col items-center gap-1.5 font-mono text-[10px] tracking-[0.3em] text-dim uppercase sm:mt-10">
            {t(ui.tour.scroll)}
            <ChevronsDown size={18} className="animate-bounce text-cyan" />
          </motion.p>
        </motion.div>

        {/* honest label */}
        <AnimatePresence>
          {phase === 'live' && (
            <motion.p key="disc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute bottom-2 left-1/2 w-max max-w-[92vw] -translate-x-1/2 rounded-full border border-line bg-ink/80 px-3 py-1 text-center font-mono text-[9.5px] tracking-[0.06em] text-muted backdrop-blur sm:text-[10px]">
              {t(ui.scene.disclaimer)}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}

/** Circular hit-probability gauge (fills when it appears). */
function Gauge({ pct }: { pct: number }) {
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <div className="relative grid size-[68px] shrink-0 place-items-center">
      <svg viewBox="0 0 64 64" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgb(255 255 255 / 0.1)" strokeWidth="5" />
        <motion.circle cx="32" cy="32" r={r} fill="none" stroke="var(--brand-1)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct / 100) }} transition={{ duration: 1.1, delay: 0.2, ease: EASE }} />
      </svg>
      <span className="font-display text-[17px] font-bold tabular-nums">{pct}%</span>
    </div>
  )
}

/** A glassy "hologram" card that slides out of the laptop screen. */
function HoloCard({ at, from, children }: { at: { left: number; top: number }; from: { x?: number; y?: number }; children: React.ReactNode }) {
  return (
    <motion.div
      className="pointer-events-auto absolute w-[290px] rounded-2xl border border-[var(--brand-1)]/60 bg-[linear-gradient(160deg,rgb(var(--brand-rgb)/0.22),rgb(6_14_32/0.92)_55%)] p-4 shadow-[0_30px_70px_-20px_rgb(0_0_0/0.95),0_0_40px_-8px_rgb(var(--brand-1-rgb)/0.55)] backdrop-blur-xl"
      style={at}
      initial={{ opacity: 0, scale: 0.85, rotateY: from.x ? (from.x > 0 ? -18 : 18) : 0, ...from }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0, rotateY: 0 }}
      exit={{ opacity: 0, scale: 0.9, ...from }}
      transition={{ duration: 0.6, ease: EASE }}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[var(--brand-1)] to-transparent" />
      {children}
    </motion.div>
  )
}

/** One letter of the big title: flies in from below and unblurs, staggered, once the page is ready. */
function Letter({ ch, i, ready, gold }: { ch: string; i: number; ready: boolean; gold: boolean }) {
  if (ch === ' ') return <span className="w-[0.26em]" />
  return (
    <motion.span
      initial={{ opacity: 0, y: '0.5em', filter: 'blur(14px)' }}
      animate={ready ? { opacity: 1, y: '0em', filter: 'blur(0px)' } : {}}
      transition={{ duration: 0.9, delay: 0.12 + i * 0.055, ease: EASE }}
      className={cn('inline-block', gold ? 'text-gold' : 'text-silver')}
    >
      {ch}
    </motion.span>
  )
}

/** Reduced motion: the same story as four plain steps. */
function TourStatic() {
  const t = useT()
  return (
    <section id="home" className="container-x pt-28 pb-20">
      <p className="font-mono text-[13px] tracking-[0.4em] text-cyan uppercase">{t(ui.tour.welcome)}</p>
      <p className="mt-3 font-display text-6xl font-bold tracking-tight">
        <span className="text-silver">MIMATT</span> <span className="text-gold">PRO</span>
      </p>
      <h1 className="mt-5 font-display text-3xl font-semibold">
        <span className="text-silver">{t(ui.hero.title1)}</span> <span className="text-gold">{t(ui.hero.title2)}</span>
      </h1>
      <p className="mt-3 max-w-xl text-muted">{t(ui.hero.lead)}</p>
      <ol className="mt-10 grid gap-4 md:grid-cols-2">
        {ui.tour.steps.map((s, i) => (
          <li key={s.title.en} className="panel p-5">
            <span className="font-mono text-[11px] text-dim">0{i + 1}</span>
            <h2 className="mt-2 font-display text-lg font-semibold">{t(s.title)}</h2>
            <p className="mt-1 text-[14.5px] text-muted">{t(s.text)}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
