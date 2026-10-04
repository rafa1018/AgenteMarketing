import { motion, useTransform, type MotionValue } from 'motion/react'
import { Check, CircleDot, FileCode2, FolderOpen, GitBranch, LayoutDashboard, Package, Search, Settings, Users } from 'lucide-react'
import { extraFiles, files, highlight } from './code'
import { useT } from '@/i18n'
import { cn } from '@/lib/utils'

/* All screens are laid out at 1000 × 625 and scaled to fit the laptop display. */
export const SCREEN_W = 1000
export const SCREEN_H = 625

const totalLines = files.reduce((n, f) => n + f.lines.length, 0)
export const TOTAL_LINES = totalLines

function Badge({ text, color }: { text: string; color: string }) {
  return (
    <span className="grid h-[15px] min-w-[22px] place-items-center rounded-[3px] px-1 text-[8.5px] font-bold text-white" style={{ background: color }}>
      {text}
    </span>
  )
}

/* ───────────── 1. EDITOR ───────────── */
export function EditorScreen({ typed, docked }: { typed: number; docked: number }) {
  // which file is being typed
  let acc = 0
  let active = 0
  for (let i = 0; i < files.length; i++) {
    if (typed < acc + files[i].lines.length || i === files.length - 1) {
      active = i
      break
    }
    acc += files[i].lines.length
  }
  const file = files[active]
  const local = Math.max(0, Math.min(file.lines.length, typed - acc))
  const fullLines = Math.floor(local)
  const partial = local - fullLines
  const opened = files.slice(0, active + 1)
  // explorer entries appear as technologies dock
  const visibleFiles = Math.min(files.length + extraFiles.length, [0, 1, 1, 2, 2, 3, 3, 4, 5][docked] ?? 5)

  return (
    <div className="flex h-full w-full bg-[#1e1f24] font-mono text-[13px] text-[#e6edf3]">
      {/* activity bar */}
      <div className="flex w-[46px] flex-col items-center gap-5 border-r border-white/5 bg-[#18191d] pt-4 text-[#6b7280]">
        <FileCode2 size={19} className="text-[#e6edf3]" />
        <Search size={18} />
        <GitBranch size={18} />
        <Package size={18} />
        <div className="flex-1" />
        <Settings size={18} className="mb-4" />
      </div>
      {/* explorer */}
      <div className="w-[240px] border-r border-white/5 bg-[#1a1b20] px-3 pt-3">
        <div className="mb-3 text-[10px] tracking-[0.18em] text-[#8a93a3]">EXPLORER</div>
        <div className="flex items-center gap-1.5 text-[12px] text-[#c9d1d9]">
          <FolderOpen size={14} className="text-[#5dd8ff]" /> orders-system
        </div>
        <ul className="mt-2 space-y-1 pl-3">
          {[...files.map((f) => ({ name: f.name, badge: f.badge, color: f.color })), ...extraFiles].map((f, i) => (
            <li
              key={f.name}
              className={cn('flex items-center gap-2 rounded px-1.5 py-[3px] text-[12px] transition-all duration-500', i === active && 'bg-white/[0.06]')}
              style={{ opacity: i < visibleFiles ? 1 : 0, transform: `translateX(${i < visibleFiles ? 0 : -10}px)` }}
            >
              <Badge text={f.badge} color={f.color} />
              <span className="truncate">{f.name}</span>
            </li>
          ))}
        </ul>
      </div>
      {/* editor */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[36px] items-end gap-px bg-[#18191d]">
          {opened.map((f, i) => (
            <div key={f.name} className={cn('flex h-full items-center gap-2 border-t-2 px-4 text-[12px]', i === active ? 'border-[#5dd8ff] bg-[#1e1f24] text-white' : 'border-transparent text-[#8a93a3]')}>
              <Badge text={f.badge} color={f.color} />
              {f.name}
            </div>
          ))}
        </div>
        <div className="relative flex-1 overflow-hidden px-2 pt-3 leading-[22px]">
          {file.lines.map((line, i) => {
            if (i > fullLines) return null
            const shown = i < fullLines ? line : line.slice(0, Math.round(line.length * partial))
            return (
              <div key={i} className="flex whitespace-pre">
                <span className="w-9 shrink-0 pr-3 text-right text-[#4b5563]">{i + 1}</span>
                <span>
                  {highlight(shown, file.lang).map((tk, j) => (
                    <span key={j} style={{ color: tk.color }}>{tk.text}</span>
                  ))}
                  {i === fullLines && <span className="ml-px inline-block h-[16px] w-[2px] translate-y-[3px] bg-[#5dd8ff] animate-blink" />}
                </span>
              </div>
            )
          })}
        </div>
        {/* status bar */}
        <div className="flex h-[24px] items-center gap-4 bg-[#2f6feb] px-3 text-[11px] text-white">
          <span className="flex items-center gap-1"><GitBranch size={12} /> main</span>
          <span>{file.lang === 'csharp' ? 'C#' : file.lang === 'ts' ? 'TypeScript' : 'PL/SQL'}</span>
          <span className="ml-auto">Ln {Math.min(fullLines + 1, file.lines.length)}, UTF-8</span>
        </div>
      </div>
    </div>
  )
}

/* ───────────── 2. BUILD / ARCHITECTURE ───────────── */
const LAYERS = [
  { name: 'Frontend', tech: 'Angular · React · TypeScript', color: '#e23237' },
  { name: 'API', tech: 'ASP.NET · C#', color: '#a179dc' },
  { name: 'Lógica de negocio', nameEn: 'Business logic', tech: '.NET · Clean Architecture', color: '#5dd8ff' },
  { name: 'Datos', nameEn: 'Data', tech: 'Oracle · SQL Server · PL/SQL', color: '#f29111' },
]
const TERMINAL = [
  { cmd: 'dotnet build -c Release', ok: 'Build succeeded · 0 errors' },
  { cmd: 'ng build --configuration production', ok: 'Application bundle generated' },
  { cmd: 'dotnet test', ok: 'Passed: 128 · Failed: 0' },
  { cmd: 'docker build -t orders-system .', ok: 'Image built' },
  { cmd: 'az pipelines run --name deploy', ok: 'Deployed to production' },
]

function Layer({ i, p }: { i: number; p: MotionValue<number> }) {
  const t = useT()
  const l = LAYERS[i]
  const start = 0.05 + i * 0.13
  const y = useTransform(p, [start, start + 0.18], [-90, 0])
  const opacity = useTransform(p, [start, start + 0.1], [0, 1])
  const glow = useTransform(p, [start + 0.15, start + 0.22, start + 0.4], [0, 1, 0.25])
  return (
    <motion.div style={{ y, opacity }} className="relative">
      <div className="relative flex items-center justify-between rounded-xl border border-white/10 bg-gradient-to-r from-white/[0.07] to-white/[0.02] px-5 py-4">
        <motion.div className="pointer-events-none absolute inset-0 rounded-xl" style={{ opacity: glow, boxShadow: `0 0 0 1px ${l.color}, 0 0 40px -6px ${l.color}` }} />
        <div className="flex items-center gap-3">
          <span className="size-2.5 rounded-full" style={{ background: l.color, boxShadow: `0 0 12px ${l.color}` }} />
          <span className="font-sans text-[17px] font-semibold text-white">{t({ es: l.name, en: l.nameEn ?? l.name })}</span>
        </div>
        <span className="font-mono text-[12px] text-[#9aa4b2]">{l.tech}</span>
      </div>
    </motion.div>
  )
}

export function BuildScreen({ p, termLines }: { p: MotionValue<number>; termLines: number }) {
  const bar = useTransform(p, [0.05, 0.95], ['0%', '100%'])
  return (
    <div className="grid h-full w-full grid-cols-[1.25fr_1fr] gap-6 bg-[radial-gradient(ellipse_at_30%_20%,#132544,#0b0e14_70%)] p-8">
      <div className="flex flex-col">
        <div className="mb-5 flex items-center justify-between">
          <span className="font-mono text-[11px] tracking-[0.25em] text-[#8a93a3]">ARCHITECTURE</span>
          <span className="font-mono text-[11px] text-[#5dd8ff]">orders-system</span>
        </div>
        <div className="relative flex flex-1 flex-col justify-center gap-3.5">
          {LAYERS.map((_, i) => (
            <Layer key={i} i={i} p={p} />
          ))}
        </div>
      </div>
      <div className="flex flex-col rounded-xl border border-white/10 bg-black/50 font-mono text-[12.5px]">
        <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
          <span className="ml-3 text-[11px] text-[#8a93a3]">terminal — zsh</span>
        </div>
        <div className="flex-1 space-y-3 p-4">
          {TERMINAL.slice(0, termLines).map((l) => (
            <div key={l.cmd}>
              <div className="text-[#e6edf3]">
                <span className="text-[#67b7a4]">❯</span> {l.cmd}
              </div>
              <div className="mt-1 flex items-center gap-1.5 text-[#4ade9a]">
                <Check size={13} /> {l.ok}
              </div>
            </div>
          ))}
          {termLines < TERMINAL.length && (
            <div className="text-[#e6edf3]">
              <span className="text-[#67b7a4]">❯</span> <span className="inline-block h-[14px] w-[8px] translate-y-[2px] bg-[#e6edf3] animate-blink" />
            </div>
          )}
        </div>
        <div className="m-4 mt-0 h-1.5 overflow-hidden rounded-full bg-white/10">
          <motion.div className="h-full rounded-full bg-gradient-to-r from-[#2f8cff] to-[#4ade9a]" style={{ width: bar }} />
        </div>
      </div>
    </div>
  )
}
export const TERMINAL_LINES = TERMINAL.length

/* ───────────── 4. MOBILE (same product, phone layout 390 × 844) ───────────── */
export const PHONE_W = 390
export const PHONE_H = 844

export function MobileScreen({ p }: { p: MotionValue<number> }) {
  const t = useT()
  const chart = useTransform(p, [0.2, 0.7], [0, 1])
  const items = [
    ['#10482', 'Cundinamarca', { es: 'Aprobada', en: 'Approved' }, '#16a34a'],
    ['#10481', 'Bogotá D.C.', { es: 'En proceso', en: 'In progress' }, '#2563eb'],
    ['#10480', 'Valledupar', { es: 'Aprobada', en: 'Approved' }, '#16a34a'],
  ] as const
  return (
    <div className="flex h-full w-full flex-col bg-[#f5f6f8] font-sans text-[#0b1220]">
      <div className="h-[54px]" />
      <div className="px-6">
        <div className="text-[13px] font-medium text-[#6b7280]">{t({ es: 'Hola, equipo', en: 'Hi, team' })}</div>
        <div className="text-[30px] font-semibold tracking-tight">{t({ es: 'Órdenes', en: 'Orders' })}</div>
      </div>
      <div className="mx-5 mt-5 rounded-3xl bg-gradient-to-br from-[#2f8cff] to-[#1f5fd0] p-5 text-white shadow-[0_18px_40px_-16px_rgb(47_140_255/0.7)]">
        <div className="text-[13px] text-white/75">{t({ es: 'Esta semana', en: 'This week' })}</div>
        <div className="mt-1 text-[38px] font-semibold tracking-tight">1.284</div>
        <svg viewBox="0 0 300 70" className="mt-2 h-[70px] w-full">
          <motion.path d="M0 60 C40 55 60 30 100 36 S170 14 210 22 S270 6 300 10" fill="none" stroke="white" strokeWidth={3.5} strokeLinecap="round" style={{ pathLength: chart }} />
        </svg>
      </div>
      <div className="mt-6 px-6 text-[15px] font-semibold">{t({ es: 'Recientes', en: 'Recent' })}</div>
      <ul className="mt-3 space-y-3 px-5">
        {items.map(([id, city, status, color]) => (
          <li key={id} className="flex items-center justify-between rounded-2xl bg-white px-4 py-3.5 shadow-[0_6px_18px_-10px_rgb(0_0_0/0.15)]">
            <div>
              <div className="text-[15px] font-medium">{city}</div>
              <div className="font-mono text-[12px] text-[#6b7280]">{id}</div>
            </div>
            <span className="rounded-full px-2.5 py-1 text-[12px] font-medium" style={{ color, background: `${color}14` }}>{t(status)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-auto flex h-[84px] items-start justify-around border-t border-black/5 bg-white/90 pt-3 text-[#9ca3af]">
        <LayoutDashboard size={24} className="text-[#2f8cff]" />
        <Package size={24} />
        <Users size={24} />
        <Settings size={24} />
      </div>
    </div>
  )
}

/* ───────────── 3. PRODUCT ───────────── */
const KPIS = [
  { label: { es: 'Órdenes', en: 'Orders' }, to: 1284, fmt: (v: number) => Math.round(v).toLocaleString('es-CO') },
  { label: { es: 'Respuesta API', en: 'API response' }, to: 120, fmt: (v: number) => `${Math.round(v)} ms` },
  { label: { es: 'Disponibilidad', en: 'Uptime' }, to: 99.9, fmt: (v: number) => `${v.toFixed(1)}%` },
  { label: { es: 'Pruebas', en: 'Tests' }, to: 128, fmt: (v: number) => `${Math.round(v)} ✓` },
]
const CHART = 'M0 120 C60 110 90 70 140 80 S230 40 280 52 S370 20 420 30 S520 8 560 14'

function Kpi({ k, p, i }: { k: (typeof KPIS)[number]; p: MotionValue<number>; i: number }) {
  const t = useT()
  const v = useTransform(p, [0.1 + i * 0.05, 0.55 + i * 0.05], [0, k.to], { clamp: true })
  const text = useTransform(v, k.fmt)
  const opacity = useTransform(p, [0.02 + i * 0.05, 0.12 + i * 0.05], [0, 1])
  const y = useTransform(p, [0.02 + i * 0.05, 0.16 + i * 0.05], [18, 0])
  return (
    <motion.div style={{ opacity, y }} className="rounded-xl border border-black/5 bg-white p-4 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.12)]">
      <div className="text-[11px] font-medium text-[#6b7280]">{t(k.label)}</div>
      <motion.div className="mt-1 text-[24px] font-semibold tracking-tight text-[#0b1220]">{text}</motion.div>
    </motion.div>
  )
}

export function ProductScreen({ p }: { p: MotionValue<number> }) {
  const t = useT()
  const chart = useTransform(p, [0.25, 0.75], [0, 1])
  const area = useTransform(p, [0.55, 0.8], [0, 1])
  const toastY = useTransform(p, [0.78, 0.9], [30, 0])
  const toastO = useTransform(p, [0.78, 0.88], [0, 1])
  const rowsO = [0, 1, 2, 3].map((i) => useTransform(p, [0.35 + i * 0.07, 0.45 + i * 0.07], [0, 1])) // eslint-disable-line react-hooks/rules-of-hooks
  const rows = [
    ['#10482', 'Cundinamarca', { es: 'Aprobada', en: 'Approved' }, '#16a34a'],
    ['#10481', 'Bogotá D.C.', { es: 'En proceso', en: 'In progress' }, '#2563eb'],
    ['#10480', 'Valledupar', { es: 'Aprobada', en: 'Approved' }, '#16a34a'],
    ['#10479', 'Medellín', { es: 'Revisión', en: 'Review' }, '#d97706'],
  ] as const

  return (
    <div className="relative flex h-full w-full bg-[#f5f6f8] font-sans text-[#0b1220]">
      <aside className="flex w-[190px] flex-col gap-1 border-r border-black/5 bg-white px-3 pt-5">
        <div className="mb-5 flex items-center gap-2 px-2">
          <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-[#2f8cff] to-[#1f6fe0] text-[11px] font-bold text-white">RP</span>
          <span className="text-[13px] font-semibold">Orders</span>
        </div>
        {[
          [LayoutDashboard, { es: 'Panel', en: 'Dashboard' }],
          [Package, { es: 'Órdenes', en: 'Orders' }],
          [Users, { es: 'Clientes', en: 'Customers' }],
          [Settings, { es: 'Ajustes', en: 'Settings' }],
        ].map(([Icon, label], i) => {
          const I = Icon as typeof LayoutDashboard
          return (
            <div key={i} className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px]', i === 0 ? 'bg-[#eef4ff] font-medium text-[#1f6fe0]' : 'text-[#4b5563]')}>
              <I size={15} /> {t(label as { es: string; en: string })}
            </div>
          )
        })}
      </aside>
      <main className="flex-1 p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[19px] font-semibold tracking-tight">{t({ es: 'Panel de órdenes', en: 'Orders dashboard' })}</div>
            <div className="text-[11.5px] text-[#6b7280]">{t({ es: 'Vista previa · datos de demostración', en: 'Preview · demo data' })}</div>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-[#ecfdf3] px-3 py-1 text-[11px] font-medium text-[#16a34a]">
            <CircleDot size={11} /> {t({ es: 'En producción', en: 'In production' })}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {KPIS.map((k, i) => (
            <Kpi key={i} k={k} p={p} i={i} />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-[1.4fr_1fr] gap-3">
          <div className="rounded-xl border border-black/5 bg-white p-4 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.12)]">
            <div className="mb-2 text-[12px] font-medium text-[#4b5563]">{t({ es: 'Órdenes por semana', en: 'Orders per week' })}</div>
            <svg viewBox="0 0 560 140" className="h-[150px] w-full">
              <defs>
                <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#2f8cff" stopOpacity="0.28" />
                  <stop offset="1" stopColor="#2f8cff" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[30, 65, 100].map((y) => <line key={y} x1="0" x2="560" y1={y} y2={y} stroke="#eef0f3" />)}
              <motion.path d={`${CHART} L560 140 L0 140 Z`} fill="url(#pg)" style={{ opacity: area }} />
              <motion.path d={CHART} fill="none" stroke="#2f8cff" strokeWidth={3} strokeLinecap="round" style={{ pathLength: chart }} />
            </svg>
          </div>
          <div className="rounded-xl border border-black/5 bg-white p-4 shadow-[0_8px_24px_-12px_rgb(0_0_0/0.12)]">
            <div className="mb-2 text-[12px] font-medium text-[#4b5563]">{t({ es: 'Recientes', en: 'Recent' })}</div>
            <ul className="space-y-2">
              {rows.map(([id, city, status, color], i) => (
                <motion.li key={id} style={{ opacity: rowsO[i] }} className="flex items-center justify-between border-b border-black/5 pb-2 text-[12px] last:border-0">
                  <span className="font-mono text-[#6b7280]">{id}</span>
                  <span className="text-[#111827]">{city}</span>
                  <span className="rounded-full px-2 py-0.5 text-[10.5px] font-medium" style={{ color, background: `${color}14` }}>{t(status)}</span>
                </motion.li>
              ))}
            </ul>
          </div>
        </div>
      </main>
      {/* deploy toast */}
      <motion.div style={{ y: toastY, opacity: toastO }} className="absolute bottom-6 left-[214px] flex items-center gap-3 rounded-2xl bg-[#0b1220] px-4 py-3 text-white shadow-2xl">
        <span className="grid size-7 place-items-center rounded-full bg-[#16a34a]"><Check size={15} /></span>
        <div>
          <div className="text-[12.5px] font-semibold">{t({ es: 'Despliegue completado', en: 'Deployment complete' })}</div>
          <div className="text-[11px] text-white/60">v2.4.0 · {t({ es: 'producción', en: 'production' })}</div>
        </div>
      </motion.div>
    </div>
  )
}

