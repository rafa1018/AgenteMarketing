import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { AlignJustify, BellRing, Camera, CandlestickChart, CheckCircle2, ChevronDown, Columns2, Hand, Magnet, Maximize2, Pencil, Plus, Ruler, Signal, Slash, Spline, Square, Star, Type, Wifi, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'
import { cn } from '@/lib/utils'
import { BotFigure, type BotMood } from './BotFigure'
import { MAX_CANDLES, PHASE_LEN, SPEC, START_BALANCE, TRADES, initialState, money, price, staticState, step, type SceneState, type Side } from './engine'

/** Two compositions: wide (laptop + phone side by side) and compact for phones (laptop on top, bot + phone below). */
const LAYOUT = {
  wide: { w: 760, h: 560, laptop: { left: 30, top: 18 }, robot: { left: 0, top: 334 }, phone: { left: 566, top: 150 }, bubble: 300 },
  compact: { w: 560, h: 790, laptop: { left: 0, top: 0 }, robot: { left: 0, top: 400 }, phone: { left: 372, top: 392 }, bubble: 210 },
}
type Layout = (typeof LAYOUT)['wide']
const TICK_MS = 650
const OPEN_MS = 1300 // lid opening
const BOOT_MS = 2400 // logo loading screen

/** Intro: closed laptop → lid opens → MiMatt PRO boots → live platform (only then trades run). */
type Intro = 'closed' | 'opening' | 'booting' | 'live'

/** Fills {placeholders} of a localized template. */
const fill = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')

/**
 * Hero motion graphic: a laptop running the MiMatt PRO workspace (live candles + radar), the
 * MiMatt bot spotting the setup and telling the trader when to enter, and a phone where the trader
 * executes it. Fully simulated and labeled as such. Pauses off-screen; static for reduced motion.
 */
export function TradingScene({ ready = true }: { ready?: boolean }) {
  const t = useT()
  const reduce = useReducedMotion()
  const wrap = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)
  const [compact, setCompact] = useState(false)
  const [state, setState] = useState<SceneState>(() => (reduce ? staticState() : initialState()))
  const [running, setRunning] = useState(false)
  const [intro, setIntro] = useState<Intro>(reduce ? 'live' : 'closed')

  // play the intro once the page preloader is gone
  useEffect(() => {
    if (reduce) return setIntro('live')
    if (!ready) return
    const CLOSED_MS = 700 // let the closed laptop be seen before it opens
    const o = window.setTimeout(() => setIntro('opening'), CLOSED_MS)
    const a = window.setTimeout(() => setIntro('booting'), CLOSED_MS + OPEN_MS)
    const b = window.setTimeout(() => setIntro('live'), CLOSED_MS + OPEN_MS + BOOT_MS)
    return () => {
      window.clearTimeout(o)
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [ready, reduce])
  const live = intro === 'live'
  const powered = intro === 'booting' || live

  // scale the fixed-size stage to the available width
  useLayoutEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => {
      const w = e.contentRect.width
      const c = w < 600
      setCompact(c)
      setScale(Math.min(1.15, w / (c ? LAYOUT.compact.w : LAYOUT.wide.w)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // run only while visible on screen and the tab is in the foreground
  useEffect(() => {
    if (reduce) return
    const el = wrap.current
    if (!el) return
    let onScreen = false
    const update = () => setRunning(onScreen && !document.hidden)
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting
      update()
    })
    io.observe(el)
    document.addEventListener('visibilitychange', update)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', update)
    }
  }, [reduce])

  useEffect(() => {
    if (!running || !live) return
    const id = window.setInterval(() => setState(step), TICK_MS)
    return () => window.clearInterval(id)
  }, [running, live])

  const trade = TRADES[state.tradeIdx]
  const sideLabel = t(trade.side === 'long' ? ui.scene.long : ui.scene.short)
  const L = compact ? LAYOUT.compact : LAYOUT.wide

  return (
    <div ref={wrap} className="relative w-full" style={{ height: L.h * scale }}>
      <div className="absolute top-0 left-1/2 origin-top" style={{ width: L.w, height: L.h, transform: `translateX(-50%) scale(${scale})` }}>
        <Laptop state={state} sideLabel={sideLabel} L={L} intro={intro} />
        {/* the bot and the phone join once the platform is booting */}
        <motion.div initial={false} animate={powered ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <Robot state={state} sideLabel={sideLabel} L={L} booting={!live} />
        </motion.div>
        <motion.div initial={false} animate={powered ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }} transition={{ duration: 0.8, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}>
          <Phone state={state} sideLabel={sideLabel} L={L} />
        </motion.div>
        {/* honest label: this is a demo, not a track record */}
        <motion.div
          initial={false}
          animate={{ opacity: live ? 1 : 0 }}
          className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full border border-line bg-ink/80 px-3 py-1 font-mono text-[10.5px] tracking-[0.08em] whitespace-nowrap text-muted backdrop-blur"
        >
          {t(ui.scene.disclaimer)}
        </motion.div>
      </div>
    </div>
  )
}

/* ───────────────────────── laptop ───────────────────────── */

function Laptop({ state, sideLabel, L, intro }: { state: SceneState; sideLabel: string; L: Layout; intro: Intro }) {
  const live = intro === 'live'
  return (
    // seen slightly from above, so the closed lid reads as a laptop lying shut (logo on top)
    <div className="absolute" style={{ ...L.laptop, width: 560, perspective: 1100, perspectiveOrigin: '50% -110%' }}>
      {/* lid: closed (folded down onto the base, logo up) → swings open in 3D */}
      <motion.div
        initial={false}
        animate={{ rotateX: intro === 'closed' ? -86 : 0 }}
        transition={{ duration: OPEN_MS / 1000, ease: [0.3, 1.2, 0.4, 1] }}
        style={{ transformOrigin: '50% 100%', transformStyle: 'preserve-3d' }}
        className="relative"
      >
        {/* back of the lid (visible only while closed) */}
        <div
          aria-hidden
          className="absolute inset-0 grid place-items-center rounded-[18px] border border-[#3a4d74] bg-[linear-gradient(160deg,#1a2c52,#0b1630_55%,#14254a)] [backface-visibility:hidden]"
          style={{ transform: 'rotateX(180deg)' }}
        >
          <img src="/images/logo-256.webp" alt="" className="size-28 opacity-90 drop-shadow-[0_0_24px_rgb(var(--brand-rgb)/0.55)]" />
        </div>
        {/* front: bezel + screen */}
        <div className="rounded-[18px] border border-[#2a3a5c] bg-[#0b1426] p-[10px] shadow-[0_30px_80px_-20px_rgb(0_0_0/0.8),0_0_0_1px_rgb(var(--brand-1-rgb)/0.08)] [backface-visibility:hidden]">
        <div className="relative h-[330px] overflow-hidden rounded-[9px] bg-[#060d1b]">
          <AnimatePresence>{intro === 'booting' && <BootScreen key="boot" />}</AnimatePresence>
          {/* screen glare while it opens */}
          <motion.div aria-hidden initial={false} animate={{ opacity: intro === 'opening' ? 1 : 0 }} transition={{ duration: 0.6 }} className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-br from-white/15 via-transparent to-transparent" />
          <motion.div initial={false} animate={{ opacity: live ? 1 : 0 }} transition={{ duration: 0.6 }} className="h-full">
          {/* symbol tabs (trading-platform style) */}
          <div className="flex h-7 items-center gap-1 border-b border-white/5 bg-[#071022] px-2">
            {[state.sym, state.sym === 'NQ' ? 'ES' : 'NQ'].map((s, i) => (
              <span
                key={s}
                className={cn(
                  'flex h-5 items-center gap-1 rounded-md border px-1.5 font-mono text-[8.5px] font-bold',
                  i === 0 ? 'border-volt/60 bg-volt/10 text-fg shadow-[0_0_10px_-2px_rgb(var(--brand-rgb)/0.6)]' : 'border-white/10 text-muted',
                )}
              >
                {i === 0 && <span className="size-1 rounded-full bg-long" />}M{s}1!
                {i === 0 && (
                  <>
                    <Star size={7} className="fill-cyan text-cyan" />
                    <X size={7} className="text-dim" />
                  </>
                )}
              </span>
            ))}
            <Plus size={10} className="ml-1 text-muted" />
            <span className="ml-auto flex items-center gap-1.5">
              <img src="/images/logo-128.webp" alt="" className="size-3.5" />
              <span className="font-display text-[8.5px] font-semibold">
                MiMatt <span className="text-gold">PRO</span>
              </span>
              <span className="ml-1 flex items-center gap-0.5 font-mono text-[7.5px] text-long">
                <span className="size-1 animate-pulse rounded-full bg-long" /> LIVE
              </span>
            </span>
          </div>
          {/* timeframes + drawing tools + layouts */}
          <div className="flex h-7 items-center gap-0.5 border-b border-volt/25 bg-[#081329] px-2 text-muted">
            {['1m', '5m', '15m', '1h', '4h', 'D', 'W', 'M'].map((tf) => (
              <span key={tf} className={cn('grid h-5 min-w-5 place-items-center rounded px-1 font-mono text-[8px] font-bold', tf === '1m' ? 'border border-volt/60 bg-volt/15 text-fg' : 'text-muted')}>
                {tf}
              </span>
            ))}
            <span className="mx-1.5 h-3.5 w-px bg-white/10" />
            {[CandlestickChart, Columns2, Slash, Square, Type, Spline, AlignJustify].map((Icon, i) => (
              <span key={i} className={cn('grid size-5 place-items-center rounded', i === 0 && 'bg-volt/15 text-cyan')}>
                <Icon size={9} />
              </span>
            ))}
            <span className="ml-auto flex items-center gap-1.5 font-mono text-[7.5px]">
              Layouts <ChevronDown size={7} />
              <Camera size={9} />
              <Maximize2 size={8} />
            </span>
          </div>
          <div className="flex h-[274px]">
            {/* left drawing rail */}
            <div className="flex w-7 shrink-0 flex-col items-center gap-2 border-r border-white/5 bg-[#060e1f] pt-2 text-muted">
              <span className="grid size-5 place-items-center rounded border border-volt/50 bg-volt/10 text-cyan">
                <Plus size={9} />
              </span>
              {[Slash, Pencil, Square, Ruler, Magnet].map((Icon, i) => (
                <Icon key={i} size={9} />
              ))}
            </div>
            <Chart state={state} sideLabel={sideLabel} />
            <div className="flex w-[160px] shrink-0 flex-col gap-2 border-l border-white/5 p-2">
              <Radar state={state} />
              <Balance state={state} />
            </div>
          </div>
          </motion.div>
        </div>
        </div>
      </motion.div>
      {/* base */}
      <div className="relative mx-auto h-4 w-[560px] scale-x-110 rounded-b-[14px] bg-gradient-to-b from-[#2a3a5c] to-[#121d33] shadow-[0_18px_30px_-12px_rgb(0_0_0/0.9)]">
        <div className="absolute top-0 left-1/2 h-1.5 w-24 -translate-x-1/2 rounded-b-md bg-[#0b1426]" />
        {/* power light on the hinge while closed */}
        <motion.span
          initial={false}
          animate={intro === 'closed' ? { opacity: [0.3, 1, 0.3] } : { opacity: 0 }}
          transition={intro === 'closed' ? { duration: 1.6, repeat: Infinity } : { duration: 0.3 }}
          className="absolute -top-1 left-1/2 h-0.5 w-16 -translate-x-1/2 rounded-full bg-cyan shadow-[0_0_12px_rgb(var(--brand-1-rgb)/0.9)]"
        />
      </div>
    </div>
  )
}

/** What the laptop shows while MiMatt PRO starts: the logo loading with a gold ring and boot steps. */
function BootScreen() {
  const t = useT()
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 1.04 }} transition={{ duration: 0.4 }} className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[radial-gradient(circle_at_50%_40%,#10234a,#060d1b_70%)]">
      <div className="relative grid size-28 place-items-center">
        <svg viewBox="0 0 120 120" className="absolute inset-0 size-full" aria-hidden>
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgb(var(--brand-1-rgb) / 0.12)" strokeWidth="2" />
          <motion.circle cx="60" cy="60" r="54" fill="none" stroke="var(--brand-1)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="70 270" animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }} style={{ transformOrigin: '60px 60px' }} />
        </svg>
        <motion.img src="/images/logo-128.webp" alt="" className="size-16 drop-shadow-[0_6px_20px_rgb(var(--brand-rgb)/0.5)]" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: [0.5, 1.08, 1], opacity: 1 }} transition={{ duration: 0.8 }} />
      </div>
      <p className="mt-4 font-display text-[20px] font-semibold">
        <span className="text-silver">MiMatt</span> <span className="text-gold">PRO</span>
      </p>
      <p className="mt-1 font-mono text-[9.5px] tracking-[0.2em] text-muted uppercase">{t(ui.scene.booting)}</p>
      <div className="mt-4 h-[3px] w-48 overflow-hidden rounded-full bg-white/10">
        <motion.div className="h-full rounded-full bg-gradient-to-r from-[var(--brand-3)] to-[var(--brand-hi)]" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: (BOOT_MS - 300) / 1000, ease: 'easeInOut' }} />
      </div>
      <ul className="mt-4 space-y-1">
        {ui.scene.bootSteps.map((s, i) => (
          <motion.li key={s.en} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.6 }} className="flex items-center gap-1.5 font-mono text-[9px] text-dim">
            <CheckCircle2 size={10} className="text-long" /> {t(s)}
          </motion.li>
        ))}
      </ul>
    </motion.div>
  )
}

/* ───────────────────────── chart ───────────────────────── */

function Chart({ state, sideLabel }: { state: SceneState; sideLabel: string }) {
  const t = useT()
  const W = 352
  const H = 274
  const PAD_R = 46
  const PAD_Y = 22
  const { candles, phase } = state
  const trade = TRADES[state.tradeIdx]
  const showLevels = phase === 'signal' || phase === 'order' || phase === 'trade' || phase === 'result'

  const values = candles.flatMap((c) => [c.h, c.l])
  if (showLevels) values.push(state.target, state.stop)
  const hi = Math.max(...values)
  const lo = Math.min(...values)
  const range = Math.max(hi - lo, SPEC[state.sym].vol * 4)
  const y = (v: number) => PAD_Y + (1 - (v - lo) / range) * (H - PAD_Y * 2)
  const slot = (W - PAD_R) / MAX_CANDLES
  const cw = slot * 0.58
  const x = (i: number) => (W - PAD_R) - (candles.length - i) * slot + slot / 2

  const last = candles[candles.length - 1]
  const up = last.c >= last.o
  const isLong = trade.side === 'long'
  const resultPnl = state.lastPnl

  return (
    <div className="relative flex-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full">
        {/* grid */}
        {[0.2, 0.4, 0.6, 0.8].map((f) => (
          <line key={f} x1={0} x2={W - PAD_R} y1={H * f} y2={H * f} stroke="rgb(150 175 220 / 0.06)" />
        ))}
        {[lo + range * 0.15, lo + range * 0.5, lo + range * 0.85].map((v) => (
          <text key={v} x={W - PAD_R + 6} y={y(v) + 3} className="fill-[#5b6880] font-mono text-[8.5px]">
            {price(v)}
          </text>
        ))}

        {/* trade levels */}
        {showLevels && (
          <g>
            <Level y={y(state.target)} w={W - PAD_R} color="#2fd08e" label={`${t(ui.scene.target)} ${price(state.target)}`} />
            <Level y={y(state.stop)} w={W - PAD_R} color="#ff5b6e" label={`${t(ui.scene.stop)} ${price(state.stop)}`} />
            <Level y={y(state.entry)} w={W - PAD_R} color="var(--brand-1)" label={`${t(ui.scene.entry)} ${price(state.entry)}`} solid />
          </g>
        )}

        {/* candles */}
        {candles.map((c, i) => {
          const green = c.c >= c.o
          const col = green ? 'var(--candle-up)' : 'var(--candle-down)' // per theme: blue/navy or green/red
          const top = y(Math.max(c.o, c.c))
          const bot = y(Math.min(c.o, c.c))
          return (
            <g key={i}>
              <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth={1} opacity={0.85} />
              <rect x={x(i) - cw / 2} y={top} width={cw} height={Math.max(1.2, bot - top)} rx={1} fill={col} opacity={i === candles.length - 1 ? 1 : 0.82} />
            </g>
          )
        })}

        {/* entry marker */}
        {state.entryIndex >= 0 && (phase === 'trade' || phase === 'result') && (
          <g transform={`translate(${x(state.entryIndex)} ${isLong ? y(candles[state.entryIndex].l) + 14 : y(candles[state.entryIndex].h) - 14})`}>
            <circle r={9} fill="rgb(var(--brand-1-rgb) / 0.18)" className="animate-pulse" />
            <path d={isLong ? 'M0 -6 L5 3 L-5 3 Z' : 'M0 6 L5 -3 L-5 -3 Z'} fill="var(--brand-1)" />
          </g>
        )}

        {/* last price tag */}
        <g transform={`translate(${W - PAD_R} ${y(last.c)})`}>
          <rect x={1} y={-8} width={PAD_R - 2} height={16} rx={3} fill={up ? 'var(--candle-up)' : 'var(--candle-down)'} stroke="rgb(255 255 255 / 0.25)" strokeWidth={0.5} />
          <text x={PAD_R / 2} y={3.5} textAnchor="middle" className="fill-white font-mono text-[8.5px] font-bold">
            {price(last.c)}
          </text>
        </g>
      </svg>

      {/* symbol + last price chip */}
      <div className="pointer-events-none absolute top-2 left-2 flex items-baseline gap-2 rounded-xl border border-white/10 bg-[#0a1630]/85 px-2.5 py-1 backdrop-blur">
        <span className="font-display text-[12px] font-semibold text-fg">M{state.sym}</span>
        <span className="font-display text-[13px] font-semibold text-cyan tabular-nums">{price(last.c)}</span>
      </div>

      {/* signal banner on the chart */}
      <AnimatePresence>
        {phase === 'signal' && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className={cn('absolute top-9 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.1em] whitespace-nowrap backdrop-blur', isLong ? 'border-long/50 bg-long/15 text-long' : 'border-short/50 bg-short/15 text-short')}
          >
            <span className="relative flex size-2">
              <span className={cn('absolute inset-0 animate-pulse-ring rounded-full', isLong ? 'bg-long' : 'bg-short')} />
              <span className={cn('relative size-2 rounded-full', isLong ? 'bg-long' : 'bg-short')} />
            </span>
            {sideLabel} · {state.sym}
          </motion.div>
        )}
      </AnimatePresence>

      {/* open P&L while in the trade */}
      {phase === 'trade' && (
        <div className={cn('absolute top-9 left-1/2 -translate-x-1/2 rounded-md border bg-ink/70 whitespace-nowrap px-2.5 py-1.5 font-mono text-[11px] font-bold tabular-nums backdrop-blur', state.openPnl >= 0 ? 'border-long/40 text-long' : 'border-short/40 text-short')}>
          {t(ui.scene.openPnl)} {money(state.openPnl, true)}
        </div>
      )}

      {/* floating result */}
      <AnimatePresence>
        {phase === 'result' && state.step < 3 && (
          <motion.div
            key={`res-${state.tradeIdx}`}
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: -10, scale: 1 }}
            exit={{ opacity: 0, y: -40 }}
            transition={{ duration: 0.6 }}
            className={cn(
              'absolute top-1/3 left-1/2 -translate-x-1/2 rounded-xl border px-4 py-2 font-display text-2xl font-bold tabular-nums shadow-2xl backdrop-blur',
              resultPnl >= 0 ? 'border-long/50 bg-long/15 text-long shadow-[0_0_40px_-6px_rgb(47_208_142/0.6)]' : 'border-short/50 bg-short/15 text-short',
            )}
          >
            {money(resultPnl, true)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Level({ y, w, color, label, solid }: { y: number; w: number; color: string; label: string; solid?: boolean }) {
  return (
    <g>
      <line x1={0} x2={w} y1={y} y2={y} stroke={color} strokeWidth={1} strokeDasharray={solid ? undefined : '4 4'} opacity={0.75} />
      <rect x={4} y={y - 8} width={label.length * 5.2 + 8} height={13} rx={2} fill="#060d1b" stroke={color} strokeWidth={0.6} opacity={0.95} />
      <text x={8} y={y + 2} className="font-mono text-[8px]" fill={color}>
        {label}
      </text>
    </g>
  )
}

/* ───────────────────────── radar ───────────────────────── */

const BLIPS = [
  [62, 40],
  [104, 58],
  [48, 96],
  [96, 104],
  [76, 70],
]

function Radar({ state }: { state: SceneState }) {
  const t = useT()
  const locked = state.phase === 'signal' || state.phase === 'order'
  const target = BLIPS[state.tradeIdx % BLIPS.length]
  return (
    <div className="rounded-lg border border-white/5 bg-[#081227] p-2">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[9px] tracking-[0.14em] text-cyan uppercase">{t(ui.scene.radar)}</span>
        <span className="font-mono text-[8px] text-dim">{state.sym}</span>
      </div>
      <p className="font-mono text-[8px] text-dim">{t(ui.scene.radarSub)}</p>
      <svg viewBox="0 0 150 140" className="mt-1 w-full">
        <defs>
          <radialGradient id="radar-bg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgb(var(--brand-rgb) / 0.10)" />
            <stop offset="100%" stopColor="rgb(var(--brand-rgb) / 0)" />
          </radialGradient>
          <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgb(var(--brand-1-rgb) / 0)" />
            <stop offset="100%" stopColor="rgb(var(--brand-1-rgb) / 0.55)" />
          </linearGradient>
        </defs>
        <circle cx={75} cy={70} r={64} fill="url(#radar-bg)" />
        {[64, 46, 28, 10].map((r) => (
          <circle key={r} cx={75} cy={70} r={r} fill="none" stroke="rgb(var(--brand-1-rgb) / 0.16)" />
        ))}
        <line x1={11} x2={139} y1={70} y2={70} stroke="rgb(var(--brand-1-rgb) / 0.12)" />
        <line x1={75} x2={75} y1={6} y2={134} stroke="rgb(var(--brand-1-rgb) / 0.12)" />
        {/* sweep */}
        <g className="animate-sweep" style={{ transformOrigin: '75px 70px' }}>
          <path d="M75 70 L139 70 A64 64 0 0 0 120 24.7 Z" fill="url(#sweep)" opacity={0.7} />
        </g>
        {BLIPS.map(([bx, by], i) => (
          <circle key={i} cx={bx} cy={by} r={2} fill="#c6cfdc" opacity={0.45} />
        ))}
        {locked && (
          <g>
            <circle cx={target[0]} cy={target[1]} r={4} fill="var(--brand-1)" />
            <circle cx={target[0]} cy={target[1]} r={4} fill="none" stroke="var(--brand-1)" className="animate-pulse-ring" style={{ transformOrigin: `${target[0]}px ${target[1]}px` }} />
            <path d={`M${target[0] - 10} ${target[1]} h6 M${target[0] + 4} ${target[1]} h6 M${target[0]} ${target[1] - 10} v6 M${target[0]} ${target[1] + 4} v6`} stroke="var(--brand-1)" strokeWidth={1} />
          </g>
        )}
      </svg>
    </div>
  )
}

/* ───────────────────────── balance ───────────────────────── */

function Balance({ state }: { state: SceneState }) {
  const t = useT()
  const session = state.balance - START_BALANCE
  const shown = state.balance + (state.phase === 'trade' ? state.openPnl : 0)
  return (
    <div className="flex-1 rounded-lg border border-white/5 bg-[#081227] p-2">
      <p className="font-mono text-[8.5px] tracking-[0.12em] text-dim uppercase">{t(ui.scene.startBalance)}</p>
      <p className="font-mono text-[10.5px] text-muted tabular-nums">{money(START_BALANCE)}</p>
      <p className="mt-1.5 font-mono text-[8.5px] tracking-[0.12em] text-dim uppercase">{t(ui.scene.balance)}</p>
      <p className="font-display text-[17px] leading-tight font-semibold text-fg tabular-nums">{money(shown)}</p>
      <p className={cn('mt-1 font-mono text-[10px] font-bold tabular-nums', session >= 0 ? 'text-long' : 'text-short')}>
        {t(ui.scene.sessionPnl)} {money(session, true)}
      </p>
      <div className="mt-1.5 flex items-center gap-1">
        <span className="font-mono text-[8px] text-dim uppercase">{t(ui.scene.trades)}</span>
        {TRADES.map((_, i) => {
          const r = state.results[i]
          return <span key={i} className={cn('size-2 rounded-full', r === undefined ? 'bg-white/10' : r >= 0 ? 'bg-long' : 'bg-short')} />
        })}
      </div>
    </div>
  )
}

/* ───────────────────────── robot ───────────────────────── */

function Robot({ state, sideLabel, L, booting }: { state: SceneState; sideLabel: string; L: Layout; booting?: boolean }) {
  const t = useT()
  const trade = TRADES[state.tradeIdx]
  const alert = state.phase === 'signal' || state.phase === 'order'
  let msg: string
  let tone: 'muted' | 'gold' | 'long' | 'short' = 'muted'
  if (alert) {
    msg = fill(t(ui.scene.signal), { side: sideLabel, sym: state.sym, price: price(state.entry) })
    tone = 'gold'
  } else if (state.phase === 'trade') {
    msg = fill(t(ui.scene.managing), { target: price(state.target) })
  } else if (state.phase === 'result') {
    const won = state.lastPnl >= 0
    msg = fill(t(won ? ui.scene.win : ui.scene.loss), { pnl: money(state.lastPnl, true) })
    tone = won ? 'long' : 'short'
  } else {
    msg = t(booting ? ui.scene.booting : ui.scene.scanning)
  }
  const mood: BotMood = alert ? 'alert' : state.phase === 'trade' ? trade.side : state.phase === 'result' ? (state.lastPnl >= 0 ? 'win' : 'loss') : 'scan'

  return (
    <div className="absolute flex items-end gap-3" style={L.robot}>
      <div className="relative shrink-0">
        {/* soft halo that turns gold when the bot spots a setup */}
        <div aria-hidden className={cn('absolute inset-x-2 top-6 bottom-4 -z-10 rounded-full blur-2xl transition-colors duration-500', alert ? 'bg-cyan/35' : 'bg-steel/60')} />
        <BotFigure mood={mood} size={150} />
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={booting ? 'boot' : `${state.tradeIdx}-${state.phase === 'order' ? 'signal' : state.phase}`}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.3 }}
          className={cn(
            'relative mb-6 rounded-2xl rounded-bl-sm border px-3.5 py-2.5 text-[12.5px] leading-snug font-medium shadow-xl backdrop-blur-md',
            tone === 'gold' && 'border-cyan/60 bg-abyss/90 text-cyan',
            tone === 'long' && 'border-long/50 bg-[#062018]/90 text-long',
            tone === 'short' && 'border-short/50 bg-[#22070c]/90 text-short',
            tone === 'muted' && 'border-line bg-abyss/90 text-fg/85',
          )}
          style={{ maxWidth: L.bubble }}
        >
          <span className="mb-0.5 block font-mono text-[9px] tracking-[0.16em] text-dim uppercase">MiMatt Bot · {trade.sym}</span>
          {msg}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/* ───────────────────────── phone ───────────────────────── */

function Phone({ state, sideLabel, L }: { state: SceneState; sideLabel: string; L: Layout }) {
  const t = useT()
  const trade = TRADES[state.tradeIdx]
  const isLong = trade.side === 'long'
  const screen: 'idle' | 'notify' | 'ticket' | 'filled' | 'closed' =
    state.phase === 'signal' ? (state.step === 0 ? 'notify' : 'ticket') : state.phase === 'order' ? 'filled' : state.phase === 'trade' ? 'filled' : state.phase === 'result' ? 'closed' : 'idle'
  const tapping = state.phase === 'signal' && state.step === PHASE_LEN.signal - 1

  return (
    <div className="absolute" style={{ ...L.phone, width: 184 }}>
      <div className="relative h-[372px] rounded-[30px] border border-[#3a4a6c] bg-[#0b1426] p-[7px] shadow-[0_30px_70px_-15px_rgb(0_0_0/0.95),0_0_0_1px_rgb(var(--brand-1-rgb)/0.1)]">
        <div className="relative h-full overflow-hidden rounded-[24px] bg-[#050c19]">
          {/* status bar */}
          <div className="flex items-center justify-between px-4 pt-2 font-mono text-[8.5px] text-fg/80">
            <span>9:41</span>
            <span className="absolute top-1.5 left-1/2 h-4 w-14 -translate-x-1/2 rounded-full bg-black" />
            <span className="flex items-center gap-1">
              <Signal size={9} /> <Wifi size={9} />
            </span>
          </div>

          <div className="px-3 pt-5">
            <div className="flex items-center gap-1.5">
              <img src="/images/logo-128.webp" alt="" className="size-4" />
              <span className="font-display text-[11px] font-semibold">
                MiMatt <span className="text-gold">PRO</span>
              </span>
            </div>
            <p className="mt-0.5 font-mono text-[8.5px] text-dim">
              {trade.sym} · {price(state.candles[state.candles.length - 1].c)}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {screen === 'idle' && (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-10 px-4 text-center">
                <div className="mx-auto grid size-14 place-items-center rounded-full border border-volt/40">
                  <span className="size-2.5 animate-pulse rounded-full bg-cyan" />
                </div>
                <p className="mt-3 text-[11px] font-medium text-fg">{t(ui.scene.phoneConnected)}</p>
                <p className="mt-1 text-[9.5px] text-dim">{t(ui.scene.phoneWaiting)}</p>
              </motion.div>
            )}

            {(screen === 'notify' || screen === 'ticket') && (
              <motion.div key="ticket" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-3">
                {/* push notification */}
                <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mt-3 rounded-xl border border-cyan/40 bg-abyss p-2 shadow-lg">
                  <p className="flex items-center gap-1 text-[9.5px] font-semibold text-cyan">
                    <BellRing size={10} /> {fill(t(ui.scene.phoneNotif), { side: isLong ? 'LONG' : 'SHORT', sym: trade.sym })}
                  </p>
                  <p className="mt-0.5 text-[9px] text-fg/75">{fill(t(ui.scene.phoneNotifBody), { price: price(state.entry) })}</p>
                </motion.div>
                {screen === 'ticket' && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-3 rounded-xl border border-white/10 bg-[#0a1529] p-2.5">
                    <p className="font-mono text-[8.5px] tracking-[0.12em] text-dim uppercase">{t(ui.scene.phoneOrder)}</p>
                    <p className={cn('mt-0.5 text-[12px] font-bold', isLong ? 'text-long' : 'text-short')}>{sideLabel}</p>
                    <div className="mt-1.5 flex justify-between text-[9.5px] text-muted">
                      <span>{t(ui.scene.phoneQty)}</span>
                      <span className="font-mono text-fg">1</span>
                    </div>
                    <div className="mt-0.5 flex justify-between text-[9.5px] text-muted">
                      <span>{t(ui.scene.entry)}</span>
                      <span className="font-mono text-fg">{price(state.entry)}</span>
                    </div>
                    <div className="relative mt-2.5">
                      <motion.div
                        animate={tapping ? { scale: [1, 0.94, 1] } : {}}
                        transition={{ duration: 0.4 }}
                        className={cn('rounded-lg py-2 text-center text-[11px] font-bold text-white', isLong ? 'bg-long shadow-[0_0_24px_-4px_rgb(47_208_142/0.8)]' : 'bg-short shadow-[0_0_24px_-4px_rgb(255_91_110/0.8)]')}
                      >
                        {t(isLong ? ui.scene.buy : ui.scene.sell)} {trade.sym}
                      </motion.div>
                      {tapping && (
                        <motion.span initial={{ opacity: 0, x: 20, y: 24 }} animate={{ opacity: 1, x: 8, y: 6 }} className="absolute top-1/2 left-1/2 text-white drop-shadow-lg">
                          <Hand size={22} />
                        </motion.span>
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {screen === 'filled' && (
              <motion.div key="filled" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="px-3">
                <p className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-long">
                  <CheckCircle2 size={13} /> {t(ui.scene.filled)}
                </p>
                <div className="mt-2 rounded-xl border border-white/10 bg-[#0a1529] p-2.5">
                  <p className={cn('text-[11px] font-bold', isLong ? 'text-long' : 'text-short')}>
                    {sideLabel} · 1 {trade.sym}
                  </p>
                  <p className="mt-1 font-mono text-[9px] text-muted">
                    {t(ui.scene.entry)} {price(state.entry)}
                  </p>
                  <p className="mt-2 font-mono text-[8.5px] tracking-[0.12em] text-dim uppercase">{t(ui.scene.openPnl)}</p>
                  <p className={cn('font-display text-[20px] font-bold tabular-nums', state.openPnl >= 0 ? 'text-long' : 'text-short')}>{money(state.openPnl, true)}</p>
                </div>
                <MiniBars side={trade.side} state={state} />
              </motion.div>
            )}

            {screen === 'closed' && (
              <motion.div key="closed" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="px-3 text-center">
                <p className="mt-6 font-mono text-[9px] tracking-[0.14em] text-dim uppercase">{t(ui.scene.closed)}</p>
                <p className={cn('mt-1 font-display text-[26px] font-bold tabular-nums', state.lastPnl >= 0 ? 'text-long' : 'text-short')}>{money(state.lastPnl, true)}</p>
                <div className="mt-3 rounded-xl border border-white/10 bg-[#0a1529] p-2.5 text-left">
                  <div className="flex justify-between text-[9.5px] text-muted">
                    <span>{t(ui.scene.startBalance)}</span>
                    <span className="font-mono">{money(START_BALANCE)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-[10px] text-fg">
                    <span>{t(ui.scene.balance)}</span>
                    <span className="font-mono font-semibold">{money(state.balance)}</span>
                  </div>
                </div>
                {state.tradeIdx === TRADES.length - 1 && state.step >= 2 && <p className="mt-2 text-[9px] text-cyan">{t(ui.scene.newSession)} →</p>}
              </motion.div>
            )}
          </AnimatePresence>

          {/* home indicator */}
          <span className="absolute bottom-1.5 left-1/2 h-1 w-16 -translate-x-1/2 rounded-full bg-white/30" />
        </div>
      </div>
    </div>
  )
}

/** Tiny P&L sparkline inside the phone while the position is open. */
function MiniBars({ state }: { side: Side; state: SceneState }) {
  if (state.entryIndex < 0) return null
  const pts = state.candles.slice(state.entryIndex).map((c) => c.c)
  if (pts.length < 2) return null
  const lo = Math.min(...pts, state.entry)
  const hi = Math.max(...pts, state.entry)
  const r = Math.max(hi - lo, 0.5)
  const path = pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i / (PHASE_LEN.trade)) * 150} ${50 - ((v - lo) / r) * 44}`).join(' ')
  const ey = 50 - ((state.entry - lo) / r) * 44
  return (
    <svg viewBox="0 0 150 56" className="mt-3 w-full">
      <line x1={0} x2={150} y1={ey} y2={ey} stroke="var(--brand-1)" strokeDasharray="3 3" strokeWidth={0.8} opacity={0.7} />
      <path d={path} fill="none" stroke={state.openPnl >= 0 ? '#2fd08e' : '#ff5b6e'} strokeWidth={1.8} strokeLinejoin="round" />
    </svg>
  )
}
