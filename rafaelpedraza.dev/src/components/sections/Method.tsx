import { AnimatePresence, motion, useMotionValue, useMotionValueEvent, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react'
import { useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { coreEngine, coreNodes, coreProduct } from '@/data/journey'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { useIsDesktop, useReducedMotionPref } from '@/hooks/useMediaQuery'
import { cn, pad } from '@/lib/utils'
import { useT, type L } from '@/i18n'
import { ui } from '@/i18n/ui'

/** Geometry for one layout (desktop or mobile). */
function layout(desktop: boolean) {
  const W = desktop ? 800 : 360
  const xs = desktop ? [150, 400, 650] : [62, 180, 298]
  const y = desktop ? { engine: 56, bus1: 138, top: 240, bottom: 390, bus2: 488, product: 580 } : { engine: 44, bus1: 116, top: 200, bottom: 330, bus2: 416, product: 492 }
  const r = desktop ? 34 : 25
  const H = desktop ? 640 : 548
  return { W, H, xs, y, r }
}

// Activation timeline (scroll progress 0 → 1)
const T = {
  engine: 0.05,
  bus1: [0.1, 0.24] as [number, number],
  top: [0.24, 0.3, 0.36],
  vertical: [0.4, 0.52] as [number, number],
  bottom: [0.52, 0.57, 0.62],
  bus2: [0.66, 0.8] as [number, number],
  product: 0.84,
}
// steps for the description panel
const STEPS = [
  { at: 0, node: coreEngine },
  { at: T.top[0], node: coreNodes[0] },
  { at: T.top[1], node: coreNodes[1] },
  { at: T.top[2], node: coreNodes[2] },
  { at: T.bottom[0], node: coreNodes[3] },
  { at: T.bottom[1], node: coreNodes[4] },
  { at: T.bottom[2], node: coreNodes[5] },
  { at: T.product, node: coreProduct },
]

function Line({ d, p, range, delay = 0 }: { d: string; p: MotionValue<number>; range: [number, number]; delay?: number }) {
  const len = useTransform(p, [range[0] + delay, range[1] + delay], [0, 1])
  const flow = useTransform(p, [range[1] + delay, range[1] + delay + 0.04], [0, 1])
  return (
    <g>
      <path d={d} fill="none" stroke="rgb(120 165 230 / 0.12)" strokeWidth={1} />
      <motion.path d={d} fill="none" stroke="url(#core-line)" strokeWidth={1.6} style={{ pathLength: len }} />
      <motion.path d={d} fill="none" stroke="#bfeaff" strokeWidth={1.4} strokeDasharray="2 14" className="animate-dash" style={{ opacity: flow }} />
    </g>
  )
}

function Node({ x, y, r, label, icon: Icon, p, at, big, active }: { x: number; y: number; r: number; label: L; icon: LucideIcon; p: MotionValue<number>; at: number; big?: boolean; active: boolean }) {
  const on = useTransform(p, [at, at + 0.03], [0, 1])
  const glowOpacity = useTransform(on, [0, 1], [0, 0.9])
  const t = useT()
  const rr = big ? r * 1.25 : r
  const icon = big ? 26 : 20
  return (
    <g>
      <motion.circle cx={x} cy={y} r={rr + 10} fill="url(#core-glow)" style={{ opacity: glowOpacity }} />
      <circle cx={x} cy={y} r={rr} fill="#060b16" stroke="rgb(120 165 230 / 0.25)" strokeWidth={1} />
      <motion.circle cx={x} cy={y} r={rr} fill="rgb(47 140 255 / 0.12)" stroke="#52d3ff" strokeWidth={1.4} style={{ opacity: on }} />
      {active && <circle cx={x} cy={y} r={rr + 6} fill="none" stroke="#52d3ff" strokeOpacity={0.6} strokeDasharray="3 5" className="animate-spin-slow" style={{ transformOrigin: `${x}px ${y}px`, animationDuration: '12s' }} />}
      <motion.g style={{ opacity: useTransform(on, [0, 1], [0.35, 1]) }}>
        <Icon x={x - icon / 2} y={y - icon / 2} width={icon} height={icon} color="#e9eef7" strokeWidth={1.5} />
      </motion.g>
      <motion.text x={x} y={y + rr + 20} textAnchor="middle" className="font-mono text-[11px] tracking-[0.18em]" fill="#e9eef7" style={{ opacity: useTransform(on, [0, 1], [0.35, 1]) }}>
        {t(label)}
      </motion.text>
    </g>
  )
}

function Diagram({ p, step, desktop }: { p: MotionValue<number>; step: number; desktop: boolean }) {
  const { W, H, xs, y, r } = layout(desktop)
  const cx = W / 2
  const activeId = STEPS[step]?.node.id
  const t = useT()
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full max-h-full w-full" role="img" aria-label={t(ui.method.kicker)}>
      <defs>
        <linearGradient id="core-line" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#52d3ff" />
          <stop offset="1" stopColor="#2f8cff" />
        </linearGradient>
        <radialGradient id="core-glow">
          <stop offset="0" stopColor="#2f8cff" stopOpacity="0.55" />
          <stop offset="1" stopColor="#2f8cff" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* engine → bus */}
      <Line d={`M${cx} ${y.engine + r * 1.25} V${y.bus1}`} p={p} range={[T.engine, T.bus1[0]]} />
      <Line d={`M${cx} ${y.bus1} H${xs[0]}`} p={p} range={T.bus1} />
      <Line d={`M${cx} ${y.bus1} H${xs[2]}`} p={p} range={T.bus1} />
      {xs.map((x, i) => (
        <Line key={`d${i}`} d={`M${x} ${y.bus1} V${y.top - r}`} p={p} range={[T.bus1[1] - 0.04, T.top[i]]} />
      ))}
      {/* top → bottom */}
      {xs.map((x, i) => (
        <Line key={`v${i}`} d={`M${x} ${y.top + r + 28} V${y.bottom - r}`} p={p} range={T.vertical} delay={i * 0.03} />
      ))}
      {/* bottom → merge bus → product */}
      {xs.map((x, i) => (
        <Line key={`m${i}`} d={`M${x} ${y.bottom + r + 28} V${y.bus2}`} p={p} range={[T.bottom[2], T.bus2[0]]} />
      ))}
      <Line d={`M${xs[0]} ${y.bus2} H${cx}`} p={p} range={T.bus2} />
      <Line d={`M${xs[2]} ${y.bus2} H${cx}`} p={p} range={T.bus2} />
      <Line d={`M${cx} ${y.bus2} V${y.product - r * 1.25}`} p={p} range={[T.bus2[1] - 0.02, T.product]} />

      <Node x={cx} y={y.engine} r={r} label={coreEngine.label} icon={coreEngine.icon} p={p} at={T.engine} big active={activeId === coreEngine.id} />
      {coreNodes.slice(0, 3).map((n, i) => (
        <Node key={n.id} x={xs[i]} y={y.top} r={r} label={n.label} icon={n.icon} p={p} at={T.top[i]} active={activeId === n.id} />
      ))}
      {coreNodes.slice(3).map((n, i) => (
        <Node key={n.id} x={xs[i]} y={y.bottom} r={r} label={n.label} icon={n.icon} p={p} at={T.bottom[i]} active={activeId === n.id} />
      ))}
      <Node x={cx} y={y.product} r={r} label={coreProduct.label} icon={coreProduct.icon} p={p} at={T.product} big active={activeId === coreProduct.id} />
    </svg>
  )
}

function InfoPanel({ step }: { step: number }) {
  const t = useT()
  const s = STEPS[step]
  return (
    <div className="panel corners p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <span className="hud !text-[9.5px] text-cyan">{t(ui.method.activeNode)}</span>
        <span className="hud !text-[9.5px] text-dim">
          {pad(step + 1)} / {pad(STEPS.length)}
        </span>
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={s.node.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
          <div className="mt-3 font-display text-2xl font-semibold tracking-tight">{t(s.node.label)}</div>
          <p className="mt-2 text-[14.5px] leading-relaxed text-muted">{t(s.node.text)}</p>
        </motion.div>
      </AnimatePresence>
      <div className="mt-5 flex gap-1">
        {STEPS.map((_, i) => (
          <span key={i} className={cn('h-[3px] flex-1 rounded-full transition-colors duration-500', i <= step ? 'bg-cyan' : 'bg-steel')} />
        ))}
      </div>
    </div>
  )
}

export function Method() {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const desktop = useIsDesktop()
  const reduce = useReducedMotionPref()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })
  const smooth = useSpring(scrollYProgress, { stiffness: 110, damping: 28, mass: 0.3 })
  const [step, setStep] = useState(0)
  const fullyLit = useMotionValue(1)
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    let s = 0
    STEPS.forEach((st, i) => v >= st.at && (s = i))
    setStep(s)
  })

  const header = (
    <SectionHeader
      index="05"
      kicker={t(ui.method.kicker)}
      title={t(ui.method.title)}
      description={t(ui.method.description)}
      className="!mb-6 lg:!mb-8"
    />
  )

  if (reduce) {
    // static, fully lit version
    return (
      <section id="method" className="relative py-20">
        <div className="container-x">
          {header}
          <div className="mx-auto max-w-3xl">
            <Diagram p={fullyLit} step={STEPS.length - 1} desktop={desktop} />
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="method" ref={ref} className="relative h-[240vh]">
      <div className="sticky top-0 flex h-svh flex-col overflow-hidden pt-20 pb-6 lg:pt-24">
        <div className="container-x flex min-h-0 flex-1 flex-col">
          {header}
          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_340px] lg:items-center lg:gap-12">
            <div className="relative min-h-0 lg:h-full">
              <Diagram p={smooth} step={step} desktop={desktop} />
            </div>
            <div className="hidden lg:block">
              <InfoPanel step={step} />
              <p className="hud mt-6 !text-[9.5px] leading-relaxed text-dim">{t(ui.method.hint)}</p>
            </div>
            <div className="lg:hidden">
              <InfoPanel step={step} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
