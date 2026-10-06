import { Check, KeyRound, Loader2, Palette, Save } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { applyTheme, type Theme } from '@/lib/theme'
import { cn } from '@/lib/utils'
import { api, markPasswordChanged, toast } from './api'
import { btnPrimary } from './AdminApp'

const THEMES: { id: Theme; name: string; note: string }[] = [
  { id: 'blue', name: 'Azul', note: 'Tema por defecto · azul eléctrico, velas azules' },
  { id: 'gold', name: 'Dorado', note: 'Como el logo · dorado metálico, velas verde/rojo' },
]

const field = 'h-12 w-full rounded-xl border border-line-strong bg-ink/60 px-3.5 text-[15px] text-fg placeholder:text-dim focus:border-cyan/70 focus:outline-none'

export function SettingsPage() {
  const [theme, setTheme] = useState<Theme | null>(null)
  const [saving, setSaving] = useState<Theme | null>(null)

  useEffect(() => {
    api.get<{ settings: { theme: Theme } }>('settings.php').then(({ data }) => data?.ok && setTheme(data.settings.theme))
  }, [])

  const choose = async (id: Theme) => {
    if (id === theme || saving) return
    setSaving(id)
    const { data } = await api.post<{ settings: { theme: Theme } }>('settings.php', { action: 'theme', theme: id })
    setSaving(null)
    if (!data?.ok) return toast('No se pudo guardar el tema.')
    setTheme(data.settings.theme)
    applyTheme(data.settings.theme) // the panel itself switches right away
    toast(`Tema ${id === 'blue' ? 'azul' : 'dorado'} aplicado en todo el sitio.`)
  }

  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-tight">Ajustes</h1>
      <p className="mt-1 text-sm text-muted">Configuración general del sitio de MiMatt PRO.</p>

      {/* ── theme ── */}
      <section className="panel mt-6 p-5 sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Palette size={19} className="text-cyan" /> Color principal
        </h2>
        <p className="mt-1 text-sm text-muted">Cambia el color de botones, títulos, gráficos, el robot y el preloader en todo el sitio (inicio, login y este panel).</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {THEMES.map((tm) => {
            const active = theme === tm.id
            return (
              <button
                key={tm.id}
                type="button"
                onClick={() => choose(tm.id)}
                disabled={!theme || saving !== null}
                aria-pressed={active}
                data-theme={tm.id}
                className={cn(
                  'group relative overflow-hidden rounded-2xl border p-4 text-left transition-[border-color,box-shadow] disabled:cursor-wait',
                  active ? 'border-[var(--brand-2)] shadow-[0_0_0_1px_var(--brand-2),0_14px_40px_-16px_rgb(var(--brand-rgb)/0.8)]' : 'border-line hover:border-[var(--brand-line)]',
                )}
                style={{ background: 'linear-gradient(180deg, #0d1c3a, #060f22)' }}
              >
                <ThemePreview />
                <div className="mt-4 flex items-center gap-3">
                  <span className="flex -space-x-1.5">
                    {['--brand-1', '--brand-2', '--brand-3'].map((v) => (
                      <span key={v} className="size-5 rounded-full border-2 border-[#060f22]" style={{ background: `var(${v})` }} />
                    ))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[16px] font-semibold text-fg">{tm.name}</span>
                    <span className="block truncate text-[12.5px] text-muted">{tm.note}</span>
                  </span>
                  <span className={cn('grid size-7 shrink-0 place-items-center rounded-full border', active ? 'border-transparent' : 'border-line')} style={active ? { background: 'var(--brand-2)', color: 'var(--on-brand)' } : {}}>
                    {saving === tm.id ? <Loader2 size={14} className="animate-spin text-fg" /> : active ? <Check size={15} /> : null}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </section>

      <PasswordCard />
    </>
  )
}

/** Mini mock of the site drawn with the theme of the surrounding [data-theme] element. */
function ThemePreview() {
  const candles = [
    [30, 18, 1],
    [26, 14, 1],
    [34, 12, 0],
    [22, 20, 1],
    [18, 16, 1],
    [24, 10, 0],
    [14, 18, 1],
    [10, 14, 1],
    [16, 8, 0],
    [6, 16, 1],
  ]
  return (
    <div className="rounded-xl border border-white/10 bg-[#050c1b] p-3">
      <div className="flex items-center justify-between">
        <span className="font-display text-[13px] font-semibold text-fg">
          MiMatt <span style={{ color: 'var(--brand-1)' }}>PRO</span>
        </span>
        <span className="rounded-md px-2 py-0.5 font-mono text-[9px] font-bold" style={{ background: 'linear-gradient(180deg, var(--brand-btn), var(--brand-3))', color: 'var(--on-brand)' }}>
          EMPEZAR
        </span>
      </div>
      <svg viewBox="0 0 120 52" className="mt-2 h-16 w-full" aria-hidden>
        {candles.map(([y, h, up], i) => (
          <g key={i}>
            <line x1={6 + i * 11.5} x2={6 + i * 11.5} y1={y - 4} y2={y + h + 4} stroke={up ? 'var(--candle-up)' : 'var(--candle-down)'} strokeWidth={1} />
            <rect x={2.5 + i * 11.5} y={y} width={7} height={h} rx={1} fill={up ? 'var(--candle-up)' : 'var(--candle-down)'} />
          </g>
        ))}
      </svg>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full w-2/3 rounded-full" style={{ background: 'linear-gradient(90deg, var(--brand-3), var(--brand-1))' }} />
      </div>
    </div>
  )
}

/* ── change password ── */

const ERRORS: Record<string, string> = {
  current: 'La contraseña actual no es correcta.',
  length: 'La nueva contraseña debe tener al menos 10 caracteres.',
  weak: 'Elige una contraseña distinta a "admin" y a la actual.',
}

function PasswordCard() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const mismatch = confirm.length > 0 && confirm !== next
  const strength = next.length === 0 ? 0 : next.length < 10 ? 1 : /[A-Z]/.test(next) && /\d/.test(next) && /[^A-Za-z0-9]/.test(next) && next.length >= 12 ? 3 : 2

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (mismatch) return
    setBusy(true)
    setError('')
    const { data } = await api.post('settings.php', { action: 'password', current, next })
    setBusy(false)
    if (!data?.ok) return setError(ERRORS[data?.error ?? ''] ?? 'No se pudo cambiar la contraseña.')
    setCurrent('')
    setNext('')
    setConfirm('')
    markPasswordChanged()
    toast('Contraseña actualizada.')
  }

  return (
    <section id="seguridad" className="panel mt-5 scroll-mt-24 p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
        <KeyRound size={19} className="text-cyan" /> Seguridad
      </h2>
      <p className="mt-1 text-sm text-muted">Cambia la contraseña del panel. Se guarda cifrada en el servidor, fuera de la carpeta pública.</p>
      <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-3">
        <input type="text" name="username" autoComplete="username" value="admin" readOnly hidden />
        <label className="block">
          <span className="hud !text-[10px] text-muted">Actual</span>
          <input className={cn(field, 'mt-2')} type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </label>
        <label className="block">
          <span className="hud !text-[10px] text-muted">Nueva</span>
          <input className={cn(field, 'mt-2')} type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={10} required />
          <span className="mt-2 flex gap-1" aria-hidden>
            {[1, 2, 3].map((n) => (
              <span key={n} className={cn('h-1 flex-1 rounded-full', strength >= n ? (strength === 1 ? 'bg-danger' : strength === 2 ? 'bg-[#f5c77e]' : 'bg-long') : 'bg-white/10')} />
            ))}
          </span>
        </label>
        <label className="block">
          <span className="hud !text-[10px] text-muted">Confirmar</span>
          <input className={cn(field, 'mt-2', mismatch && '!border-danger/70')} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
          {mismatch && <span className="mt-1.5 block text-[12.5px] text-danger">No coincide.</span>}
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <button type="submit" disabled={busy || mismatch || !current || next.length < 10} className={btnPrimary}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Cambiar contraseña
          </button>
          <span className="text-[12.5px] text-dim">Mínimo 10 caracteres. Mejor si mezcla mayúsculas, números y símbolos.</span>
          {error && <span className="w-full text-[13px] text-danger">{error}</span>}
        </div>
      </form>
    </section>
  )
}
