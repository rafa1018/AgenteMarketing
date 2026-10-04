import { motion, useMotionValue, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react'
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { flyingTech } from './code'
import { BuildScreen, EditorScreen, MobileScreen, PHONE_H, PHONE_W, ProductScreen, SCREEN_H, SCREEN_W, TERMINAL_LINES, TOTAL_LINES } from './Screens'
import { useReducedMotionPref } from '@/hooks/useMediaQuery'
import { useT, type L } from '@/i18n'
import { ui } from '@/i18n/ui'

/* ── Scroll timeline (0 → 1 across the pinned section) ── */
const T = {
  open: [0.02, 0.15] as const,
  type: [0.16, 0.46] as const,
  toBuild: [0.47, 0.52] as const,
  build: [0.5, 0.73] as const,
  toProduct: [0.73, 0.78] as const,
  product: [0.76, 0.95] as const,
  phone: [0.83, 0.93] as const,
}
// flight window of each technology chip
const chipWindow = (i: number): [number, number] => (i < 6 ? [0.15 + i * 0.045, 0.26 + i * 0.045] : [0.47 + (i - 6) * 0.05, 0.58 + (i - 6) * 0.05])

/** Renders fixed-size screen content (default 1000×625) scaled to the real display size (crisp at any width). */
function ScaledScreen({ children, w = SCREEN_W, h = SCREEN_H }: { children: ReactNode; w?: number; h?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(el.clientWidth / w))
    ro.observe(el)
    return () => ro.disconnect()
  }, [w])
  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden">
      <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: '0 0' }}>{children}</div>
    </div>
  )
}

/** Phone that swings in next to the laptop in the "ready to ship" phase: same product, mobile build. */
function Phone({ p, reduce }: { p: MotionValue<number>; reduce: boolean }) {
  const [a, b] = T.phone
  const x = useTransform(p, [a, b], ['55%', '0%'])
  const y = useTransform(p, [a, b], ['12%', '0%'])
  const rotateY = useTransform(p, [a, b, 1], [-62, -18, -8])
  const rotateZ = useTransform(p, [a, b], [8, 0])
  const opacity = useTransform(p, [a, a + 0.03], [0, 1])
  const local = useTransform(p, [b - 0.02, 1], [0, 1])
  const chipO = useTransform(p, [b, b + 0.03], [0, 1])
  return (
    <motion.div
      className="absolute right-[1%] bottom-[-4%] z-30 w-[22%] sm:w-[20%]"
      style={reduce ? undefined : { x, y, rotateY, rotateZ, opacity, transformPerspective: 1400 }}
    >
      <div className="relative rounded-[18%/8.5%] border border-white/15 bg-gradient-to-b from-[#2a2e36] to-[#121418] p-[4.5%] shadow-[0_40px_80px_-24px_rgba(0,0,0,0.9),0_0_60px_-20px_rgba(47,140,255,0.45)]">
        <div className="relative aspect-[390/844] overflow-hidden rounded-[15%/7%] bg-black">
          <ScaledScreen w={PHONE_W} h={PHONE_H}>
            <MobileScreen p={reduce ? p : local} />
          </ScaledScreen>
          {/* camera pill */}
          <span className="absolute top-[1.8%] left-1/2 h-[3.2%] w-[30%] -translate-x-1/2 rounded-full bg-black" />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.06] to-transparent" />
        </div>
      </div>
      <motion.div style={reduce ? undefined : { opacity: chipO }} className="mt-3 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap text-white backdrop-blur-xl sm:text-[11px]">
          <span className="size-1.5 rounded-full bg-cyan" /> Ionic · React Native
        </span>
      </motion.div>
    </motion.div>
  )
}

function Chip({ i, p }: { i: number; p: MotionValue<number> }) {
  const c = flyingTech[i]
  const [a, b] = chipWindow(i)
  const x = useTransform(p, [a, b], [`${c.from[0]}vw`, '0vw'])
  const y = useTransform(p, [a, b], [`${c.from[1]}vh`, '0vh'])
  const scale = useTransform(p, [a, b], [1.15, 0.5])
  const opacity = useTransform(p, [a, a + 0.02, b - 0.02, b], [0, 1, 1, 0])
  const blur = useTransform(p, [a, a + 0.03], ['blur(6px)', 'blur(0px)'])
  // dock target: the explorer column of the editor
  const top = i < 6 ? 24 + i * 5 : 54 + (i - 6) * 5
  return (
    <motion.div className="absolute" style={{ left: '17%', top: `${top}%`, x, y, scale, opacity, filter: blur }}>
      <span
        className="flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[13px] font-semibold whitespace-nowrap text-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl sm:text-[15px]"
      >
        <span className="size-2.5 rounded-full" style={{ background: c.color, boxShadow: `0 0 14px ${c.color}` }} />
        {c.label}
      </span>
    </motion.div>
  )
}

function Caption({ p, range, title, sub }: { p: MotionValue<number>; range: [number, number, number, number]; title: L; sub: L }) {
  const t = useT()
  const opacity = useTransform(p, range, [0, 1, 1, 0])
  const y = useTransform(p, range, [24, 0, 0, -24])
  return (
    <motion.div style={{ opacity, y }} className="absolute inset-x-0 top-0 text-center">
      <h3 className="font-display text-[clamp(1.6rem,3.6vw,2.8rem)] leading-tight font-semibold tracking-[-0.035em] text-white">{t(title)}</h3>
      <p className="mx-auto mt-2 max-w-xl text-[15px] text-muted sm:text-[17px]">{t(sub)}</p>
    </motion.div>
  )
}

function Laptop({ p, children, screenOn }: { p: MotionValue<number>; children: ReactNode; screenOn: MotionValue<number> }) {
  const lid = useTransform(p, [T.open[0], T.open[1]], [78, 0])
  const glare = useTransform(p, [0, 1], ['-30%', '130%'])
  return (
    <div className="relative w-full" style={{ perspective: '2200px' }}>
      {/* lid / display */}
      <motion.div className="relative mx-auto w-[88%]" style={{ rotateX: lid, transformOrigin: '50% 100%', transformStyle: 'preserve-3d' }}>
        <div className="relative rounded-[18px] border border-white/10 bg-[#0a0b0e] p-[1.6%] shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_50px_120px_-30px_rgba(47,140,255,0.35)] sm:rounded-[24px]">
          {/* camera */}
          <span className="absolute top-[0.65%] left-1/2 size-[5px] -translate-x-1/2 rounded-full bg-[#1c1f26] ring-1 ring-white/5" />
          <div className="relative aspect-[16/10] overflow-hidden rounded-[8px] bg-black sm:rounded-[10px]">
            {children}
            {/* power-on fade */}
            <motion.div className="pointer-events-none absolute inset-0 bg-black" style={{ opacity: useTransform(screenOn, [0, 1], [1, 0]) }} />
            {/* glass glare */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute inset-y-0 w-[40%] -skew-x-12 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent"
              style={{ left: glare }}
            />
          </div>
        </div>
      </motion.div>
      {/* base */}
      <div className="relative mx-auto h-[clamp(10px,1.6vw,18px)] w-full rounded-b-[18px] bg-gradient-to-b from-[#3a3f48] via-[#24272e] to-[#121418] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.9)]">
        <span className="absolute top-0 left-1/2 h-[40%] w-[14%] -translate-x-1/2 rounded-b-[10px] bg-[#16181d]" />
        <span className="absolute inset-x-[2%] top-0 h-px bg-white/25" />
      </div>
      <div className="mx-auto mt-2 h-6 w-[80%] rounded-[50%] bg-black/60 blur-xl" />
    </div>
  )
}

export function BuildScene() {
  const t = useT()
  const reduce = useReducedMotionPref()
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const p = useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.35 })
  const staticP = useMotionValue(1)
  const P = reduce ? staticP : p

  // discrete state for the editor/terminal (re-renders only when a character/line changes)
  const [typed, setTyped] = useState(0)
  const [docked, setDocked] = useState(0)
  const [termLines, setTermLines] = useState(0)
  useMotionValueEvent(P, 'change', (v) => {
    const k = Math.min(1, Math.max(0, (v - T.type[0]) / (T.type[1] - T.type[0])))
    setTyped(Math.round(k * TOTAL_LINES * 20) / 20)
    setDocked(flyingTech.filter((_, i) => v >= chipWindow(i)[1]).length)
    const b = Math.min(1, Math.max(0, (v - T.build[0]) / (T.build[1] - T.build[0])))
    setTermLines(Math.floor(b * (TERMINAL_LINES + 0.5)))
  })

  const stageScale = useTransform(P, [0, T.open[1]], [0.84, 1])
  const stageY = useTransform(P, [0, T.open[1]], [70, 0])
  const screenOn = useTransform(P, [T.open[0] + 0.05, T.open[1] + 0.01], [0, 1])
  const headlineO = useTransform(P, [0, 0.06, 0.12], [1, 1, 0])
  const headlineY = useTransform(P, [0, 0.12], [0, -40])
  const editorO = useTransform(P, [T.toBuild[0], T.toBuild[1]], [1, 0])
  const buildO = useTransform(P, [T.toBuild[0], T.toBuild[1], T.toProduct[0], T.toProduct[1]], [0, 1, 1, 0])
  const productO = useTransform(P, [T.toProduct[0], T.toProduct[1]], [0, 1])
  const buildLocal = useTransform(P, [T.build[0], T.build[1]], [0, 1])
  const productLocal = useTransform(P, [T.product[0], T.product[1]], [0, 1])
  // make room for the phone: the laptop eases left and slightly back
  const laptopX = useTransform(P, [T.phone[0], T.phone[1]], ['0%', '-9%'])
  const laptopScale = useTransform(P, [T.phone[0], T.phone[1]], [1, 0.9])
  const glow = useTransform(P, [0, 0.15, 0.5, 0.95], [0.2, 0.7, 0.9, 1])

  const finalTyped = reduce ? TOTAL_LINES : typed

  return (
    <section id="build" ref={ref} aria-label={t(ui.build.kicker)} className={reduce ? 'relative py-24' : 'relative h-[520vh]'}>
      <div className={reduce ? 'relative' : 'sticky top-0 flex h-svh flex-col items-center justify-center overflow-hidden'}>
        {/* ambient light */}
        <motion.div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 h-[80vh] w-[110vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-[radial-gradient(closest-side,rgba(47,140,255,0.22),transparent)]" style={{ opacity: glow }} />

        {/* intro headline */}
        <motion.div style={{ opacity: headlineO, y: headlineY }} className="pointer-events-none absolute inset-x-0 top-[9vh] z-10 px-4 text-center sm:top-[11vh]">
          <p className="hud text-cyan">{t(ui.build.kicker)}</p>
          <h2 className="mt-3 font-display text-[clamp(2.2rem,6.5vw,5rem)] leading-[1] font-semibold tracking-[-0.045em] text-gradient">{t(ui.build.title)}</h2>
        </motion.div>

        {/* stage */}
        <motion.div
          style={{ scale: stageScale, y: stageY }}
          className="relative w-[min(980px,94vw,calc((100svh-240px)*1.5))] max-sm:mt-[-6vh]"
        >
          <motion.div style={{ x: laptopX, scale: laptopScale, transformOrigin: '20% 60%' }}>
          <Laptop p={P} screenOn={screenOn}>
            <motion.div className="absolute inset-0" style={{ opacity: editorO }}>
              <ScaledScreen>
                <EditorScreen typed={finalTyped} docked={reduce ? flyingTech.length : docked} />
              </ScaledScreen>
            </motion.div>
            <motion.div className="absolute inset-0" style={{ opacity: buildO }}>
              <ScaledScreen>
                <BuildScreen p={reduce ? staticP : buildLocal} termLines={reduce ? TERMINAL_LINES : termLines} />
              </ScaledScreen>
            </motion.div>
            <motion.div className="absolute inset-0" style={{ opacity: productO }}>
              <ScaledScreen>
                <ProductScreen p={reduce ? staticP : productLocal} />
              </ScaledScreen>
            </motion.div>
          </Laptop>
          </motion.div>

          {/* the same product, mobile build */}
          <Phone p={P} reduce={reduce} />

          {/* technologies flying into the editor */}
          {!reduce && (
            <div aria-hidden className="pointer-events-none absolute inset-0 z-20">
              {flyingTech.map((_, i) => (
                <Chip key={i} i={i} p={P} />
              ))}
            </div>
          )}
        </motion.div>

        {/* captions */}
        {!reduce && (
          <div className="relative mt-6 h-[110px] w-full max-w-3xl px-4 sm:mt-10">
            <Caption p={P} range={[0.13, 0.18, 0.44, 0.49]} title={ui.build.c1} sub={ui.build.c1s} />
            <Caption p={P} range={[0.49, 0.53, 0.71, 0.75]} title={ui.build.c2} sub={ui.build.c2s} />
            <Caption p={P} range={[0.75, 0.8, 0.98, 1.01]} title={ui.build.c3} sub={ui.build.c3s} />
          </div>
        )}
      </div>
    </section>
  )
}
