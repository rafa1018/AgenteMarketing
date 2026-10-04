import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpRight, Building2, CalendarRange, CheckCircle2, Target, UserCog, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { projects, type Project } from '@/data/projects'
import { SectionHeader } from '@/components/ui/SectionHeader'
import { RevealItem, ScrollReveal, TiltCard } from '@/components/animations'
import { EASE_OUT, cn } from '@/lib/utils'
import { useT } from '@/i18n'
import { ui } from '@/i18n/ui'

const ACCENT = { blue: '#2f8cff', cyan: '#52d3ff', violet: '#8f83ff' }

/** Deterministic "system signature" graphic per project — generated, not a stock image. */
function Signature({ project, className }: { project: Project; className?: string }) {
  const seed = [...project.id].reduce((a, c) => a + c.charCodeAt(0), 0)
  const rand = (i: number) => {
    const x = Math.sin(seed * 9301 + i * 49297) * 233280
    return x - Math.floor(x)
  }
  const nodes = Array.from({ length: 9 }, (_, i) => ({ x: 40 + rand(i) * 320, y: 30 + rand(i + 50) * 140 }))
  const color = ACCENT[project.accent]
  return (
    <svg viewBox="0 0 400 200" className={className} aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id={`sg-${project.id}`} cx="70%" cy="30%" r="80%">
          <stop offset="0" stopColor={color} stopOpacity="0.35" />
          <stop offset="1" stopColor="#03060c" stopOpacity="0" />
        </radialGradient>
        <pattern id={`sp-${project.id}`} width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="rgb(120 165 230 / 0.08)" />
        </pattern>
      </defs>
      <rect width="400" height="200" fill={`url(#sp-${project.id})`} />
      <rect width="400" height="200" fill={`url(#sg-${project.id})`} />
      {nodes.map((n, i) =>
        nodes.slice(i + 1, i + 3).map((m, j) => (
          <path key={`${i}-${j}`} d={`M${n.x} ${n.y} H${(n.x + m.x) / 2} V${m.y} H${m.x}`} fill="none" stroke={color} strokeOpacity={0.35} strokeWidth={1} />
        )),
      )}
      {nodes.map((n, i) => (
        <g key={i}>
          <rect x={n.x - 4} y={n.y - 4} width={8} height={8} fill="#03060c" stroke={color} strokeWidth={1.2} transform={`rotate(45 ${n.x} ${n.y})`} />
          {i % 3 === 0 && <circle cx={n.x} cy={n.y} r={14} fill="none" stroke={color} strokeOpacity={0.25} />}
        </g>
      ))}
    </svg>
  )
}

function ProjectCard({ project, onOpen }: { project: Project; onOpen: () => void }) {
  const t = useT()
  return (
    <TiltCard max={3} className="h-full">
      <motion.button
        type="button"
        layoutId={`card-${project.id}`}
        onClick={onOpen}
        className="glow-border panel group flex h-full w-full flex-col overflow-hidden text-left transition-[transform,box-shadow,border-color] duration-500 hover:-translate-y-1.5 hover:border-line-strong hover:shadow-[0_30px_70px_-30px_rgb(47_140_255/0.55)]"
        aria-label={`${t(ui.projects.open)} ${project.name}`}
      >
        <div className="relative aspect-[2/1] overflow-hidden border-b border-line">
          <Signature project={project} className="h-full w-full transition-transform duration-700 ease-[cubic-bezier(.22,1,.36,1)] group-hover:scale-[1.06]" />
          <span className="hud absolute top-4 left-4 !text-[9.5px] text-cyan">{project.code}</span>
          <span className="absolute top-3 right-3 grid size-9 place-items-center rounded-full border border-line bg-ink/70 text-fg backdrop-blur transition-all duration-500 group-hover:rotate-45 group-hover:border-cyan/60 group-hover:text-cyan">
            <ArrowUpRight size={16} />
          </span>
        </div>
        <div className="flex flex-1 flex-col p-6">
          <h3 className="font-display text-2xl font-semibold tracking-tight">{project.name}</h3>
          <p className="mt-1 text-[13px] text-cyan/80">{project.client}</p>
          <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{t(project.summary)}</p>
          <div className="grid grid-rows-[0fr] opacity-0 transition-all duration-500 group-hover:grid-rows-[1fr] group-hover:opacity-100 group-focus-visible:grid-rows-[1fr] group-focus-visible:opacity-100">
            <div className="overflow-hidden">
              <p className="pt-3 font-mono text-[11px] tracking-[0.06em] text-fg/70">{t(ui.projects.role).toUpperCase()} · {t(project.role)}</p>
            </div>
          </div>
          <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
            {project.technologies.slice(0, 5).map((tech) => (
              <span key={tech} className="chip !px-2 !py-0.5 !text-[10.5px]">{tech}</span>
            ))}
            {project.technologies.length > 5 && <span className="chip !px-2 !py-0.5 !text-[10.5px] text-dim">+{project.technologies.length - 5}</span>}
          </div>
        </div>
      </motion.button>
    </TiltCard>
  )
}

function ProjectModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const t = useT()
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    document.documentElement.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.documentElement.style.overflow = ''
      window.removeEventListener('keydown', onKey)
      prev?.focus()
    }
  }, [onClose])

  const meta = [
    { icon: Building2, label: t(ui.projects.client), value: project.client },
    { icon: UserCog, label: t(ui.projects.role), value: t(project.role) },
    { icon: CalendarRange, label: t(ui.projects.period), value: t(project.period) },
  ]

  return (
    <motion.div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="absolute inset-0 bg-ink/80 backdrop-blur-md" onClick={onClose} />
      <motion.div
        layoutId={`card-${project.id}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`pm-${project.id}`}
        className="panel relative max-h-[92svh] w-full max-w-3xl overflow-y-auto overscroll-contain !rounded-b-none bg-abyss sm:!rounded-2xl"
        transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      >
        <div className="relative aspect-[3/1] overflow-hidden border-b border-line">
          <Signature project={project} className="h-full w-full" />
          <button ref={closeRef} type="button" onClick={onClose} className="absolute top-3 right-3 grid size-10 place-items-center rounded-full border border-line bg-ink/80 text-fg backdrop-blur transition-colors hover:border-cyan/60 hover:text-cyan" aria-label={t(ui.projects.close)}>
            <X size={18} />
          </button>
        </div>
        <motion.div className="p-6 sm:p-8" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.4, ease: EASE_OUT }}>
          <span className="hud !text-[10px] text-cyan">{project.code} · {t(ui.projects.detail)}</span>
          <h3 id={`pm-${project.id}`} className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{project.name}</h3>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">{t(project.summary)}</p>

          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            {meta.map((m) => (
              <div key={m.label} className="rounded-lg border border-line bg-navy/30 p-3">
                <dt className="hud flex items-center gap-1.5 !text-[9px] text-dim"><m.icon size={12} /> {m.label}</dt>
                <dd className="mt-1.5 text-[13px] leading-snug text-fg/90">{m.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-8 grid gap-8 sm:grid-cols-2">
            <div>
              <h4 className="hud flex items-center gap-2 !text-[10px] text-cyan"><Target size={13} /> {t(ui.projects.problem)}</h4>
              <p className="mt-3 text-[14.5px] leading-relaxed text-fg/85">{t(project.problem)}</p>
            </div>
            <div>
              <h4 className="hud flex items-center gap-2 !text-[10px] text-cyan"><CheckCircle2 size={13} /> {t(ui.projects.solution)}</h4>
              <ul className="mt-3 space-y-2">
                {project.solution.map((s) => (
                  <li key={s.en} className="flex gap-2.5 text-[14.5px] leading-relaxed text-fg/85">
                    <span className="mt-[10px] h-px w-3 shrink-0 bg-volt" /> {t(s)}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {project.results && project.results.length > 0 && (
            <div className="mt-8">
              <h4 className="hud !text-[10px] text-cyan">{t(ui.projects.results)}</h4>
              <ul className="mt-3 space-y-2">
                {project.results.map((r) => <li key={r.en} className="text-[14.5px] text-fg/85">{t(r)}</li>)}
              </ul>
            </div>
          )}

          <div className="mt-8">
            <h4 className="hud !text-[10px] text-dim">{t(ui.projects.technologies)}</h4>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {project.technologies.map((tech) => <span key={tech} className="chip">{tech}</span>)}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  )
}

export function Projects() {
  const t = useT()
  const [open, setOpen] = useState<Project | null>(null)
  return (
    <section id="projects" className="relative py-20 sm:py-28">
      <div className="container-x">
        <SectionHeader
          index="06"
          kicker={t(ui.projects.kicker)}
          title={t(ui.projects.title)}
        />
        <ScrollReveal className="grid gap-5 md:grid-cols-2" stagger={0.1}>
          {projects.map((p, i) => (
            <RevealItem key={p.id} className={cn(i === 0 && 'md:col-span-1')}>
              <ProjectCard project={p} onOpen={() => setOpen(p)} />
            </RevealItem>
          ))}
        </ScrollReveal>
      </div>
      <AnimatePresence>{open && <ProjectModal key={open.id} project={open} onClose={() => setOpen(null)} />}</AnimatePresence>
    </section>
  )
}
