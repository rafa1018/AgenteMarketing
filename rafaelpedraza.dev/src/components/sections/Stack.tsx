import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { techCategories, techCount, type CategoryId, type TechCategory, type Technology } from '@/data/technologies'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { FadeIn } from '@/components/animations'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { EASE_OUT, cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'

type Focus = { cat: CategoryId; tech?: Technology } | null

const left = techCategories.slice(0, 3)
const right = techCategories.slice(3)

function TechItem({ tech, onFocus, focused }: { tech: Technology; onFocus: (t: Technology | null) => void; focused: boolean }) {
  const t = useT()
  const Icon = tech.icon
  return (
    <li>
      <button
        type="button"
        onPointerEnter={() => onFocus(tech)}
        onPointerLeave={() => onFocus(null)}
        onFocus={() => onFocus(tech)}
        onBlur={() => onFocus(null)}
        className={cn(
          'group w-full rounded-lg border px-3 py-2.5 text-left transition-all duration-300',
          focused ? 'border-cyan/50 bg-cyan/[0.06] shadow-[0_0_28px_-8px_rgb(82_211_255/0.6)]' : 'border-transparent hover:border-line',
        )}
      >
        <span className="flex items-center gap-3">
          <span className={cn('grid size-8 shrink-0 place-items-center rounded-md border transition-colors duration-300', focused ? 'border-cyan/50 text-cyan' : 'border-line text-muted')}>
            <Icon size={15} strokeWidth={1.6} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium text-fg">{tech.name}</span>
            {/* space is reserved so hovering never shifts the layout */}
            <span className={cn('block truncate font-mono text-[10.5px] transition-[opacity,transform] duration-300', focused ? 'translate-y-0 text-cyan/80 opacity-100' : '-translate-y-0.5 text-dim opacity-60')}>
              {t(tech.note)}
            </span>
          </span>
        </span>
      </button>
    </li>
  )
}

function CategoryPanel({ cat, focus, setFocus, side, panelRef }: { cat: TechCategory; focus: Focus; setFocus: (f: Focus) => void; side: 'left' | 'right'; panelRef?: (el: HTMLDivElement | null) => void }) {
  const t = useT()
  const Icon = cat.icon
  const on = focus?.cat === cat.id
  return (
    <div
      ref={panelRef}
      data-active={on}
      className={cn('glow-border panel p-4 transition-colors duration-300', on && 'border-line-strong')}
      onPointerEnter={() => setFocus({ cat: cat.id })}
      onPointerLeave={() => setFocus(null)}
    >
      <div className={cn('mb-2 flex items-center gap-3 px-1', side === 'right' && 'lg:flex-row-reverse lg:text-right')}>
        <Icon size={16} className={cn('transition-colors', on ? 'text-cyan' : 'text-volt')} strokeWidth={1.6} />
        <h3 className="flex-1 font-display text-[15px] font-semibold tracking-tight">{t(cat.label)}</h3>
        <span className="hud !text-[9px] text-dim">{cat.code}·{String(cat.items.length).padStart(2, '0')}</span>
      </div>
      <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2 lg:grid-cols-2">
        {cat.items.map((item) => (
          <TechItem key={item.name} tech={item} focused={focus?.tech?.name === item.name} onFocus={(tech) => setFocus(tech ? { cat: cat.id, tech } : { cat: cat.id })} />
        ))}
      </ul>
    </div>
  )
}

/** Central SVG core: six sectors (one per category) that light up with the focused category. */
function Core({ focus }: { focus: Focus }) {
  const t = useT()
  const idx = focus ? techCategories.findIndex((c) => c.id === focus.cat) : -1
  const sector = (i: number) => {
    const a0 = (i / 6) * Math.PI * 2 - Math.PI / 2 + 0.06
    const a1 = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2 - 0.06
    const r = 92
    return `M${100 + Math.cos(a0) * r} ${100 + Math.sin(a0) * r} A${r} ${r} 0 0 1 ${100 + Math.cos(a1) * r} ${100 + Math.sin(a1) * r}`
  }
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[300px]">
      <div aria-hidden className={cn('absolute inset-[10%] rounded-full bg-[radial-gradient(closest-side,rgb(47_140_255/0.35),transparent)] transition-opacity duration-500', focus ? 'opacity-100' : 'opacity-60')} />
      <svg viewBox="0 0 200 200" className="absolute inset-0 h-full w-full" aria-hidden>
        <circle cx="100" cy="100" r="98" fill="none" stroke="rgb(120 165 230 / 0.12)" strokeWidth="0.5" />
        {techCategories.map((c, i) => (
          <path key={c.id} d={sector(i)} fill="none" strokeWidth={idx === i ? 3 : 1.4} strokeLinecap="round"
            stroke={idx === i ? '#52d3ff' : 'rgb(47 140 255 / 0.35)'} style={{ transition: 'stroke 0.4s, stroke-width 0.4s' }} />
        ))}
        <g className="animate-spin-slow" style={{ transformOrigin: '100px 100px' }}>
          <circle cx="100" cy="100" r="78" fill="none" stroke="rgb(82 211 255 / 0.3)" strokeWidth="0.6" strokeDasharray="1 5" />
        </g>
        <circle cx="100" cy="100" r="62" fill="rgb(6 11 22 / 0.9)" stroke="rgb(47 140 255 / 0.4)" strokeWidth="0.6" />
        <circle cx="100" cy="100" r="62" fill="none" stroke="#52d3ff" strokeWidth="1" strokeDasharray="12 378" className="animate-spin-slower" style={{ transformOrigin: '100px 100px' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <AnimatePresence mode="wait">
          <motion.div key={focus?.tech?.name ?? focus?.cat ?? 'idle'} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2 }} className="max-w-[44%]">
            {focus?.tech ? (
              <>
                <div className="hud !text-[8.5px] text-cyan">{t(techCategories[idx].label)}</div>
                <div className="mt-1 font-display text-lg leading-tight font-semibold">{focus.tech.name}</div>
              </>
            ) : focus ? (
              <>
                <div className="hud !text-[8.5px] text-cyan">{t(ui.stack.module)}</div>
                <div className="mt-1 font-display text-lg leading-tight font-semibold">{t(techCategories[idx].label)}</div>
              </>
            ) : (
              <>
                <div className="hud !text-[8.5px] text-cyan">{t(ui.stack.core)}</div>
                <div className="mt-1 font-display text-3xl font-semibold">{techCount}</div>
                <div className="hud !text-[8.5px] text-dim">{t(ui.stack.technologies)}</div>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/** Measured connector lines from each panel to the core (desktop). */
function Connectors({ container, panels, core, focus }: { container: HTMLDivElement | null; panels: Record<string, HTMLDivElement | null>; core: HTMLDivElement | null; focus: Focus }) {
  const [paths, setPaths] = useState<{ id: string; d: string }[]>([])
  const [size, setSize] = useState({ w: 0, h: 0 })

  const measure = useCallback(() => {
    if (!container || !core) return
    const cr = container.getBoundingClientRect()
    const k = core.getBoundingClientRect()
    const cx = k.left + k.width / 2 - cr.left
    const cy = k.top + k.height / 2 - cr.top
    const r = k.width / 2 - 6
    const out = techCategories.map((c) => {
      const el = panels[c.id]
      if (!el) return { id: c.id, d: '' }
      const p = el.getBoundingClientRect()
      const isLeft = p.left + p.width / 2 - cr.left < cx
      const sx = isLeft ? p.right - cr.left : p.left - cr.left
      const sy = p.top + p.height / 2 - cr.top
      const ang = Math.atan2(sy - cy, sx - cx)
      const ex = cx + Math.cos(ang) * r
      const ey = cy + Math.sin(ang) * r
      const mx = (sx + ex) / 2
      return { id: c.id, d: `M${sx} ${sy} C${mx} ${sy} ${mx} ${ey} ${ex} ${ey}` }
    })
    setSize({ w: cr.width, h: cr.height })
    setPaths(out)
  }, [container, core, panels])

  useLayoutEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (container) ro.observe(container)
    Object.values(panels).forEach((el) => el && ro.observe(el))
    // panels slide in with FadeIn, so re-measure once their entrance settles
    const timers: number[] = []
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) [0, 500, 1000, 1600].forEach((ms) => timers.push(window.setTimeout(measure, ms)))
    })
    if (container) io.observe(container)
    return () => {
      ro.disconnect()
      io.disconnect()
      timers.forEach(clearTimeout)
    }
  }, [measure, container, panels])

  return (
    <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={size.w} height={size.h}>
      {paths.map((p, i) => {
        const on = focus?.cat === p.id
        return (
          <g key={p.id}>
            <motion.path d={p.d} fill="none" stroke="rgb(120 165 230 / 0.18)" strokeWidth={1}
              initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.2, delay: 0.3 + i * 0.1, ease: EASE_OUT }} />
            <path d={p.d} fill="none" stroke="#52d3ff" strokeWidth={1.5} style={{ opacity: on ? 1 : 0, transition: 'opacity .35s' }} />
            {on && <path d={p.d} fill="none" stroke="#fff" strokeWidth={2} strokeDasharray="6 400" strokeLinecap="round" className="animate-dash" style={{ animationDuration: '0.9s', strokeDashoffset: 0 }} />}
          </g>
        )
      })}
    </svg>
  )
}

export function Stack() {
  const t = useT()
  const desktop = useIsDesktop()
  const [focus, setFocus] = useState<Focus>(null)
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [core, setCore] = useState<HTMLDivElement | null>(null)
  const panels = useRef<Record<string, HTMLDivElement | null>>({})
  // stable ref callbacks (one per category)
  const refs = useMemo(
    () => Object.fromEntries(techCategories.map((c) => [c.id, (el: HTMLDivElement | null) => void (panels.current[c.id] = el)])),
    [],
  )

  return (
    <section id="stack" className="relative py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader
          index="04"
          kicker={t(ui.stack.kicker)}
          title={t(ui.stack.title)}
          description={t(ui.stack.description)}
        />

        <div ref={setContainer} className="relative grid gap-5 lg:grid-cols-[1fr_300px_1fr] lg:items-center lg:gap-8">
          {desktop && <Connectors container={container} panels={panels.current} core={core} focus={focus} />}

          <div className="order-2 space-y-5 lg:order-1">
            {left.map((c, i) => (
              <FadeIn key={c.id} delay={i * 0.08} direction="right">
                <CategoryPanel cat={c} focus={focus} setFocus={setFocus} side="left" panelRef={refs[c.id]} />
              </FadeIn>
            ))}
          </div>

          <FadeIn className="order-1 lg:order-2" direction="none">
            <div ref={setCore} className="mx-auto w-[min(72vw,300px)] lg:w-full">
              <Core focus={focus} />
            </div>
          </FadeIn>

          <div className="order-3 space-y-5">
            {right.map((c, i) => (
              <FadeIn key={c.id} delay={i * 0.08} direction="left">
                <CategoryPanel cat={c} focus={focus} setFocus={setFocus} side="right" panelRef={refs[c.id]} />
              </FadeIn>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
