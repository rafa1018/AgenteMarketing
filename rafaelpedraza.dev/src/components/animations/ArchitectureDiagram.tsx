import { motion, useScroll, useSpring, useTransform, type MotionValue } from 'motion/react'
import { useRef } from 'react'
import type { Diagram, DiagramNode } from '@/data/architecture'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { cn } from '@/lib/utils'
import { useT, type Text } from '@/i18n'

const NODE_W = 216
const NODE_H = 62

const TONES: Record<NonNullable<DiagramNode['tone']>, { stroke: string; fill: string; text: string }> = {
  blue: { stroke: '#2f8cff', fill: 'rgb(47 140 255 / 0.10)', text: '#e9eef7' },
  cyan: { stroke: '#52d3ff', fill: 'rgb(82 211 255 / 0.08)', text: '#e9eef7' },
  violet: { stroke: '#8f83ff', fill: 'rgb(143 131 255 / 0.10)', text: '#e9eef7' },
  muted: { stroke: 'rgb(135 151 176 / 0.55)', fill: 'rgb(19 33 58 / 0.55)', text: '#b8c6dc' },
}

/** Orthogonal connector between the closest edges of two nodes. */
function edgePath(a: DiagramNode, b: DiagramNode) {
  const aw = (a.w ?? NODE_W) / 2
  const bw = (b.w ?? NODE_W) / 2
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (Math.abs(dx) < 4) {
    const s = Math.sign(dy)
    return `M${a.x} ${a.y + s * NODE_H / 2} V${b.y - s * NODE_H / 2}`
  }
  if (Math.abs(dy) < 4) {
    const s = Math.sign(dx)
    return `M${a.x + s * aw} ${a.y} H${b.x - s * bw}`
  }
  // horizontal out, vertical in
  const sx = Math.sign(dx)
  const sy = Math.sign(dy)
  const startX = a.x + sx * aw
  return `M${startX} ${a.y} H${b.x - sx * 14} Q${b.x} ${a.y} ${b.x} ${a.y + sy * 14} V${b.y - sy * NODE_H / 2}`
}

function Edge({ d, progress, range, dashed, label, mid }: { d: string; progress: MotionValue<number>; range: [number, number]; dashed?: boolean; label?: Text; mid: { x: number; y: number } }) {
  const len = useTransform(progress, range, [0, 1])
  const op = useTransform(progress, [range[0], range[0] + 0.02], [0, 1])
  const done = useTransform(progress, [range[1] - 0.04, range[1]], [0, 1])
  const t = useT()
  return (
    <g>
      <motion.path
        d={d}
        fill="none"
        stroke={dashed ? 'rgb(143 131 255 / 0.25)' : 'url(#arch-edge)'}
        strokeWidth={1.5}
        markerEnd="url(#arch-arrow)"
        style={{ pathLength: len, opacity: op }}
      />
      {dashed && (
        <motion.path d={d} fill="none" stroke="rgb(143 131 255 / 0.55)" strokeWidth={1.2} strokeDasharray="4 6" className="animate-dash" style={{ opacity: done }} />
      )}
      {label && (
        <motion.text x={mid.x + 8} y={mid.y - 6} className="fill-muted font-mono text-[11px] tracking-[0.15em] uppercase" style={{ opacity: done }}>
          {t(label)}
        </motion.text>
      )}
    </g>
  )
}

function Node({ n, progress, at }: { n: DiagramNode; progress: MotionValue<number>; at: number }) {
  const t = useT()
  const tone = TONES[n.tone ?? 'blue']
  const w = n.w ?? NODE_W
  const op = useTransform(progress, [at, at + 0.06], [0, 1])
  const scale = useTransform(progress, [at, at + 0.08], [0.85, 1])
  return (
    <motion.g style={{ opacity: op, scale, transformOrigin: `${n.x}px ${n.y}px`, transformBox: 'view-box' }}>
      <rect x={n.x - w / 2} y={n.y - NODE_H / 2} width={w} height={NODE_H} rx={10} fill={tone.fill} stroke={tone.stroke} strokeOpacity={0.7} />
      <rect x={n.x - w / 2} y={n.y - NODE_H / 2 + 14} width={2} height={NODE_H - 28} fill={tone.stroke} />
      <text x={n.x} y={n.y - 3} textAnchor="middle" fill={tone.text} className="font-display text-[15px] font-semibold">
        {t(n.label)}
      </text>
      {n.sub && (
        <text x={n.x} y={n.y + 16} textAnchor="middle" className="fill-muted font-mono text-[10.5px]">
          {t(n.sub)}
        </text>
      )}
    </motion.g>
  )
}

/** Scroll-driven, data-driven architecture diagram. Connections draw while the user scrolls. */
export function ArchitectureDiagram({ diagram, className }: { diagram: Diagram; className?: string }) {
  const desktop = useIsDesktop()
  return desktop ? <DiagramDesktop diagram={diagram} className={className} /> : <DiagramMobile diagram={diagram} className={className} />
}

function DiagramDesktop({ diagram, className }: { diagram: Diagram; className?: string }) {
  const t = useT()
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.75'] })
  const progress = useSpring(scrollYProgress, { stiffness: 90, damping: 26, mass: 0.4 })
  const byId = Object.fromEntries(diagram.nodes.map((n) => [n.id, n]))
  const n = diagram.edges.length

  return (
    <div ref={ref} className={cn('relative', className)}>
      <svg viewBox={`0 0 1000 ${diagram.height}`} className="h-auto w-full overflow-visible" role="img" aria-label={t(diagram.title)}>
        <defs>
          <linearGradient id="arch-edge" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#2f8cff" />
            <stop offset="1" stopColor="#52d3ff" />
          </linearGradient>
          <marker id="arch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill="#52d3ff" />
          </marker>
        </defs>
        {diagram.edges.map((e, i) => {
          const a = byId[e.from]
          const b = byId[e.to]
          const start = 0.1 + (i / n) * 0.7
          return (
            <Edge
              key={`${e.from}-${e.to}`}
              d={edgePath(a, b)}
              progress={progress}
              range={[start, start + 0.16]}
              dashed={e.dashed}
              label={e.label}
              mid={{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }}
            />
          )
        })}
        {diagram.nodes.map((node, i) => (
          <Node key={node.id} n={node} progress={progress} at={(i / diagram.nodes.length) * 0.55} />
        ))}
      </svg>
    </div>
  )
}

/** Mobile: the same graph re-flowed as a vertical pipeline (readable at 360px). */
function DiagramMobile({ diagram, className }: { diagram: Diagram; className?: string }) {
  const t = useT()
  const byId = Object.fromEntries(diagram.nodes.map((n) => [n.id, n]))
  return (
    <ol className={cn('relative space-y-3 pl-6', className)}>
      <motion.span
        aria-hidden
        className="absolute top-2 bottom-2 left-[7px] w-px origin-top bg-gradient-to-b from-volt via-cyan to-transparent"
        initial={{ scaleY: 0 }}
        whileInView={{ scaleY: 1 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1] }}
      />
      {diagram.nodes.map((node, i) => {
        const out = diagram.edges.filter((e) => e.from === node.id)
        const tone = TONES[node.tone ?? 'blue']
        return (
          <motion.li
            key={node.id}
            className="relative"
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, amount: 0.6 }}
            transition={{ duration: 0.5, delay: i * 0.04 }}
          >
            <span className="absolute top-4 -left-[22px] size-2.5 rotate-45 border bg-ink" style={{ borderColor: tone.stroke }} />
            <div className="panel px-4 py-3" style={{ borderColor: `${tone.stroke}55` }}>
              <div className="font-display text-[15px] font-semibold">{t(node.label)}</div>
              {node.sub && <div className="font-mono text-[11px] text-muted">{t(node.sub)}</div>}
              {out.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {out.map((e) => (
                    <span key={e.to} className="chip !py-0.5 !text-[10px]">
                      → {t(byId[e.to].label)}
                      {e.label ? ` · ${t(e.label)}` : ''}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </motion.li>
        )
      })}
    </ol>
  )
}
