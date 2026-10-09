import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { Bell, BookOpenCheck, Calendar, Camera, CloudSun, FileDown, Home, Image, Mail, MapPin, Menu, MessageCircle, Music, Pause, Play, Wallet } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/*
 * Animated tour of the family app inside the iPhone frame (public/images/phone-17.png): the phone's home
 * screen → tap on "Gabush" → splash → sign in → Inicio, Mensajes, Pagos and Notas. Everything is drawn here
 * with sample data (no real child), at a 360 px wide "virtual phone" scaled to the frame.
 * Plays by itself; the step dots and the app's bottom bar let the visitor explore. Reduced motion: no autoplay.
 */

const VW = 360 // virtual screen width (px); height follows the frame's screen ratio
const VH = 783
// transparent screen area of phone-17.png (389 × 800): x 17–371, y 14–785
const SCREEN = { left: `${(17 / 389) * 100}%`, top: `${(14 / 800) * 100}%`, width: `${(355 / 389) * 100}%`, height: `${(772 / 800) * 100}%` }

type SceneId = 'phone' | 'splash' | 'login' | 'inicio' | 'mensajes' | 'pagos' | 'notas' | 'asistencia' | 'aviso' | 'mas'
const SCENES: { id: SceneId; label: string; ms: number; tap?: { at: number; x: number; y: number } }[] = [
  { id: 'phone', label: 'Abrir la app', ms: 2600, tap: { at: 1700, x: 303, y: 231 } },
  { id: 'splash', label: 'Cargando', ms: 2000 },
  { id: 'login', label: 'Ingresar', ms: 4300, tap: { at: 3300, x: 180, y: 556 } },
  { id: 'inicio', label: 'Inicio', ms: 3600, tap: { at: 2900, x: 108, y: 745 } },
  { id: 'mensajes', label: 'Mensajes', ms: 3400, tap: { at: 2700, x: 180, y: 745 } },
  { id: 'pagos', label: 'Pagos', ms: 3600, tap: { at: 2900, x: 252, y: 745 } },
  { id: 'notas', label: 'Notas', ms: 4400, tap: { at: 3700, x: 324, y: 745 } },
  { id: 'asistencia', label: 'Asistencia', ms: 4200 },
  { id: 'aviso', label: 'Avisos', ms: 5600 },
]
const APP_TABS: { id: SceneId; label: string; icon: typeof Home }[] = [
  { id: 'inicio', label: 'Inicio', icon: Home },
  { id: 'mensajes', label: 'Mensajes', icon: Mail },
  { id: 'pagos', label: 'Pagos', icon: Wallet },
  { id: 'notas', label: 'Notas', icon: BookOpenCheck },
]

const DOC = '1012345678'
const LION = '/images/opt/leon-asomado-160.webp'

export function PhoneDemo() {
  const reduce = useReducedMotion()
  const [step, setStep] = useState(reduce ? 3 : 0)
  const [playing, setPlaying] = useState(!reduce)
  const [elapsed, setElapsed] = useState(0)
  const [inView, setInView] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.8)

  // fit the 360 px virtual screen into the frame's screen area
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setScale(((el.clientWidth * 355) / 389) / VW)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // only animate while visible
  useEffect(() => {
    const el = box.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  // scene clock
  useEffect(() => {
    if (!playing || !inView) return
    const started = performance.now() - elapsed
    let raf = 0
    const tick = (now: number) => {
      const t = now - started
      if (t >= SCENES[step].ms) {
        setElapsed(0)
        setStep((s) => (s + 1) % SCENES.length)
        return
      }
      setElapsed(t)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, inView, step])

  const go = (i: number) => {
    setStep(i)
    setElapsed(0)
    setPlaying(false)
  }
  const scene = SCENES[step]
  // static (paused) scenes show their "finished" state
  const t = playing ? elapsed : scene.ms
  const tap = scene.tap && playing && elapsed >= scene.tap.at && elapsed < scene.tap.at + 700 ? scene.tap : null

  // entrance while scrolling: the phone stays put and just fades in
  const stage = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: stage, offset: ['start end', 'center center'] })
  const opacity = useTransform(scrollYProgress, [0, 0.6], [0, 1])

  return (
    <div ref={stage} className="mx-auto w-full max-w-[320px]">
      <motion.div ref={box} className="relative w-full" style={reduce ? { aspectRatio: '389 / 800' } : { aspectRatio: '389 / 800', opacity }}>
        {/* screen (under the frame) */}
        <div className="absolute overflow-hidden bg-white" style={{ ...SCREEN, borderRadius: `${(48 / 355) * 100}% / ${(48 / 772) * 100}%` }}>
          <div className="absolute top-0 left-0 origin-top-left" style={{ width: VW, height: VH, transform: `scale(${scale})` }}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={scene.id}
                className="absolute inset-0"
                initial={scene.id === 'splash' ? { opacity: 0, scale: 0.6, borderRadius: 60 } : scene.id === 'aviso' ? { opacity: 0, scale: 1.12 } : { opacity: 0, x: scene.id === 'phone' ? 0 : 40 }}
                animate={{ opacity: 1, x: 0, scale: 1, borderRadius: 0 }}
                exit={scene.id === 'asistencia' ? { opacity: 0, scale: 0.55, borderRadius: 60 } : { opacity: 0, x: -30 }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                {scene.id === 'phone' && <PhoneHome t={t} />}
                {scene.id === 'splash' && <Splash />}
                {scene.id === 'login' && <Login t={t} />}
                {scene.id === 'inicio' && <AppShell tab="inicio" onTab={(id) => go(SCENES.findIndex((s) => s.id === id))}><Inicio /></AppShell>}
                {scene.id === 'mensajes' && <AppShell tab="mensajes" onTab={(id) => go(SCENES.findIndex((s) => s.id === id))}><Mensajes /></AppShell>}
                {scene.id === 'pagos' && <AppShell tab="pagos" onTab={(id) => go(SCENES.findIndex((s) => s.id === id))}><Pagos /></AppShell>}
                {scene.id === 'notas' && <AppShell tab="notas" onTab={(id) => go(SCENES.findIndex((s) => s.id === id))}><Notas /></AppShell>}
                {scene.id === 'asistencia' && <AppShell tab="mas" onTab={(id) => go(SCENES.findIndex((s) => s.id === id))}><Asistencia /></AppShell>}
                {scene.id === 'aviso' && <LockScreen t={t} />}
              </motion.div>
            </AnimatePresence>
            <StatusBar dark={scene.id === 'phone' || scene.id === 'aviso'} />
            {/* finger tap */}
            <AnimatePresence>
              {tap && (
                <motion.span
                  key={`${scene.id}-tap`}
                  className="pointer-events-none absolute z-30 size-14 rounded-full border-4 border-white/90 bg-white/40 shadow-[0_0_0_6px_rgba(35,32,107,0.15)]"
                  style={{ left: tap.x - 28, top: tap.y - 28 }}
                  initial={{ scale: 1.6, opacity: 0 }}
                  animate={{ scale: [1.6, 0.8, 1], opacity: [0, 1, 0.9] }}
                  exit={{ opacity: 0, scale: 1.4 }}
                  transition={{ duration: 0.5 }}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
        <img src="/images/phone-17.png" alt="" width={389} height={800} className="pointer-events-none absolute inset-0 size-full select-none" draggable={false} />
      </motion.div>

      {/* steps */}
      <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5">
        <button type="button" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pausar recorrido' : 'Reproducir recorrido'} className="grid size-8 place-items-center rounded-full bg-ink text-white">
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        {SCENES.filter((s) => s.id !== 'splash').map((s) => {
          const i = SCENES.indexOf(s)
          const on = i === step || (s.id === 'phone' && step === 1)
          return (
            <button key={s.id} type="button" onClick={() => go(i)} aria-current={on} className={cn('rounded-full px-2.5 py-1 text-[12px] font-bold transition-colors', on ? 'bg-pink text-white' : 'bg-white text-muted ring-1 ring-line hover:text-ink')}>
              {s.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ───────── iOS-like bits ───────── */
/** The visitor's current time ("9:41" style, 12 h like an iPhone) and date ("jueves, 8 de octubre"), kept up to date. */
function useClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])
  const time = `${now.getHours() % 12 || 12}:${String(now.getMinutes()).padStart(2, '0')}`
  const date = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)
  return { time, date }
}

function StatusBar({ dark }: { dark: boolean }) {
  const { time } = useClock()
  return (
    <div className={cn('pointer-events-none absolute inset-x-0 top-0 z-20 flex h-[54px] items-center justify-between px-9 pt-2 text-[15px] font-semibold', dark ? 'text-white' : 'text-ink')}>
      <span>{time}</span>
      <span className="flex items-center gap-1.5">
        <span className="flex items-end gap-[2px]">
          {[5, 7, 9, 11].map((h) => <i key={h} className="block w-[3px] rounded-sm bg-current" style={{ height: h }} />)}
        </span>
        <span className="ml-1 inline-block h-[11px] w-[22px] rounded-[3px] border-[1.5px] border-current p-[1.5px]"><i className="block h-full w-[75%] rounded-[1px] bg-current" /></span>
      </span>
    </div>
  )
}

const HOME_APPS: { name: string; bg: string; icon?: typeof Home; img?: string }[] = [
  { name: 'Mensajes', bg: 'linear-gradient(#65e06b,#29b83a)', icon: MessageCircle },
  { name: 'Calendario', bg: '#fff', icon: Calendar },
  { name: 'Fotos', bg: '#fff', icon: Image },
  { name: 'Cámara', bg: 'linear-gradient(#9ea3a9,#5d6268)', icon: Camera },
  { name: 'Clima', bg: 'linear-gradient(#4aa7ff,#1d63d6)', icon: CloudSun },
  { name: 'Mapas', bg: 'linear-gradient(#b6e3a4,#7ac46a)', icon: MapPin },
  { name: 'Música', bg: 'linear-gradient(#ff6a80,#f2334f)', icon: Music },
  { name: 'Gabush', bg: '#bfe8ff', img: LION },
]

function PhoneHome({ t }: { t: number }) {
  const pressed = t > 1700
  return (
    <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 80% at 20% 10%, #ff9a5c 0%, #e5197e 45%, #3a36a8 100%)' }}>
      <div className="grid grid-cols-4 gap-x-4 gap-y-6 px-6 pt-[92px]">
        {HOME_APPS.map((a, i) => (
          <div key={a.name} className="flex flex-col items-center gap-1.5">
            <motion.span
              className="grid size-[62px] place-items-center overflow-hidden rounded-[16px] shadow-[0_4px_10px_rgba(0,0,0,0.18)]"
              style={{ background: a.bg }}
              animate={a.name === 'Gabush' && pressed ? { scale: [1, 0.86, 1.08] } : { scale: 1 }}
              transition={{ duration: 0.35 }}
            >
              {a.img ? <img src={a.img} alt="" className="size-[54px] object-contain" /> : a.icon && <a.icon size={30} className={a.bg === '#fff' ? 'text-[#f2334f]' : 'text-white'} strokeWidth={2.2} />}
            </motion.span>
            <span className={cn('text-[12px] text-white drop-shadow', i === 7 && 'font-semibold')}>{a.name === 'Gabush' ? 'Gabush' : a.name}</span>
          </div>
        ))}
      </div>
      {/* hint bubble */}
      <motion.div className="absolute top-[300px] right-5 rounded-2xl bg-white px-3 py-2 text-[13px] font-bold text-ink shadow-lg" initial={{ opacity: 0, y: 8 }} animate={{ opacity: t > 500 ? 1 : 0, y: t > 500 ? 0 : 8 }}>
        La app de familias 👆
      </motion.div>
      {/* dock */}
      <div className="absolute inset-x-4 bottom-6 flex justify-around rounded-[28px] bg-white/25 px-3 py-3 backdrop-blur">
        {[MessageCircle, Mail, Image, Music].map((I, i) => (
          <span key={i} className="grid size-[58px] place-items-center rounded-[15px] bg-white/90">
            <I size={28} className="text-[#3a36a8]" />
          </span>
        ))}
      </div>
    </div>
  )
}

/** Out of the app: the lock screen, and the school's notices arrive like a WhatsApp message. */
const NOTICES = [
  { at: 700, title: 'Boletín del Periodo 3 📘', body: 'Ya puedes ver y descargar el boletín de Rafael.' },
  { at: 2300, title: 'Mensaje del jardín ✉️', body: 'Mañana es la salida pedagógica: enviar gorra y protector solar.' },
  { at: 3800, title: 'Recordatorio de pago 💳', body: 'La pensión de noviembre vence el 5 nov. Págala en línea desde la app.' },
]
function LockScreen({ t }: { t: number }) {
  const shown = NOTICES.filter((n) => t >= n.at)
  const { time, date } = useClock()
  return (
    <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 80% at 20% 10%, #ff9a5c 0%, #e5197e 45%, #3a36a8 100%)' }}>
      <div className="pt-[78px] text-center text-white">
        <p className="text-[17px] font-semibold opacity-90">{date}</p>
        <p className="font-serif text-[84px] leading-none font-semibold tracking-tight">{time}</p>
      </div>
      <div className="mt-6 space-y-2.5 px-3.5">
        <AnimatePresence initial={false}>
          {[...shown].reverse().map((n) => (
            <motion.div
              key={n.title}
              layout
              initial={{ y: -140, opacity: 0, scale: 0.92 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="flex items-start gap-3 rounded-[22px] bg-white/80 p-3 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md"
            >
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-[11px] bg-[#bfe8ff]">
                <img src={LION} alt="" className="size-9 object-contain" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] font-bold tracking-wide text-[#3d3a52] uppercase">Gabush Familias</span>
                  <span className="text-[11px] text-[#6b6880]">ahora</span>
                </span>
                <span className="block text-[14px] font-bold text-ink">{n.title}</span>
                <span className="block text-[13px] leading-snug text-[#2a2850]">{n.body}</span>
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <div className="absolute inset-x-0 bottom-3 flex justify-center">
        <span className="h-[5px] w-32 rounded-full bg-white/80" />
      </div>
    </div>
  )
}

function Splash() {
  const letters: [string, string][] = [['G', '#e5197e'], ['A', '#f8c21c'], ['B', '#23206b'], ['U', '#f8c21c'], ['S', '#5cb531'], ['H', '#f26b1d']]
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-[linear-gradient(180deg,#bfe8ff_0%,#f2f8ff_70%)]">
      <motion.img src="/images/opt/leon-asomado-400.webp" alt="" className="h-36 w-auto" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.5 }} />
      <div className="mt-3 flex gap-1.5">
        {letters.map(([l, c], i) => (
          <motion.span key={i} className="grid size-11 place-items-center rounded-lg border-2 border-white font-serif text-[26px] font-bold text-white shadow" style={{ background: c }} initial={{ y: -40, opacity: 0, rotate: -10 }} animate={{ y: 0, opacity: 1, rotate: [-4, 3, -2, 4, -3, 2][i] }} transition={{ delay: 0.25 + i * 0.08, type: 'spring', stiffness: 300, damping: 14 }}>
            {l}
          </motion.span>
        ))}
      </div>
      <p className="mt-4 font-serif text-lg font-semibold text-ink">Portal de familias</p>
      <div className="mt-6 flex gap-2">
        {[0, 1, 2].map((i) => (
          <motion.span key={i} className="size-2.5 rounded-full bg-pink" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.2 }} />
        ))}
      </div>
    </div>
  )
}

function Login({ t }: { t: number }) {
  const user = DOC.slice(0, Math.max(0, Math.min(DOC.length, Math.floor((t - 400) / 110))))
  const pass = Math.max(0, Math.min(DOC.length, Math.floor((t - 1700) / 100)))
  const pressing = t > 3300
  return (
    <div className="absolute inset-0 bg-[linear-gradient(180deg,#bfe8ff_0%,#f2f8ff_55%)] px-5 pt-[70px]">
      <div className="flex flex-col items-center">
        <img src="/images/opt/leon-asomado-400.webp" alt="" className="h-24 w-auto" />
        <img src="/images/opt/logo-240.webp" alt="Gabush Kids" className="mt-1 h-12 w-auto" />
        <p className="mt-2 font-serif text-[17px] font-semibold text-ink">Portal de familias</p>
      </div>
      <div className="mt-4 rounded-[22px] bg-white p-5 shadow-[0_18px_40px_-24px_rgba(35,32,107,0.6)]">
        <p className="font-serif text-[22px] font-semibold text-ink">Entrar</p>
        <p className="mt-3 text-[13px] font-semibold text-ink">Usuario</p>
        <div className={cn('mt-1 flex h-11 items-center rounded-xl border bg-[#eef3fe] px-3 text-[15px] text-ink', t > 400 && t < 1700 ? 'border-royal' : 'border-[#d6d8ec]')}>
          {user}
          {t > 400 && t < 1700 && <span className="ml-0.5 h-5 w-[2px] animate-pulse bg-ink" />}
        </div>
        <p className="mt-1 text-[11px] text-muted">El número de documento de tu hijo o hija.</p>
        <p className="mt-3 text-[13px] font-semibold text-ink">Contraseña</p>
        <div className={cn('mt-1 flex h-11 items-center rounded-xl border bg-[#eef3fe] px-3 text-[18px] tracking-[0.2em] text-ink', t > 1700 && t < 3100 ? 'border-royal' : 'border-[#d6d8ec]')}>{'•'.repeat(pass)}</div>
        <motion.div className="mt-4 grid h-12 place-items-center rounded-full bg-ink text-[15px] font-bold text-white" animate={pressing ? { scale: [1, 0.95, 1] } : { scale: 1 }}>
          {t > 3500 ? '…' : 'Entrar'}
        </motion.div>
        <p className="mt-3 text-center text-[13px] font-semibold text-royal">¿Olvidaste tu contraseña?</p>
      </div>
    </div>
  )
}

/* ───────── the family app ───────── */
function AppShell({ tab, onTab, children }: { tab: SceneId; onTab: (id: SceneId) => void; children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col bg-[#f2f8ff]">
      <header className="flex items-center gap-3 bg-white px-4 pt-[56px] pb-3 shadow-[0_1px_0_#e3e5f3]">
        <span className="grid size-11 place-items-center overflow-hidden rounded-full bg-[#ffe9c7] ring-2 ring-white">
          <img src={LION} alt="" className="size-10 object-contain" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block font-serif text-[16px] font-semibold text-ink">Rafael P.</span>
          <span className="block text-[11px] font-bold tracking-wide text-muted uppercase">Jardín A · 2026</span>
        </span>
        <span className="relative">
          <Bell size={22} className="text-ink" />
          <i className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-pink ring-2 ring-white" />
        </span>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden px-4 pt-4">{children}</div>
      <nav className="grid grid-cols-5 border-t border-[#e3e5f3] bg-white px-1 pt-2 pb-6">
        {[...APP_TABS, { id: 'mas' as SceneId, label: 'Más', icon: Menu }].map((x) => (
          <button key={x.label} type="button" onClick={() => onTab(x.id === 'mas' ? 'asistencia' : x.id)} className="flex flex-col items-center gap-0.5 text-[11px] font-semibold text-muted">
            <span className={cn('grid h-8 w-12 place-items-center rounded-full', tab === x.id && 'bg-[#e8e7fb] text-royal')}>
              <x.icon size={20} className={tab === x.id ? 'text-royal' : ''} />
            </span>
            <span className={tab === x.id ? 'text-ink' : ''}>{x.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}

const card = 'rounded-[20px] bg-white p-4 shadow-[0_10px_28px_-22px_rgba(35,32,107,0.7)] ring-1 ring-[#e9ebf7]'
const Stagger = ({ children, i }: { children: ReactNode; i: number }) => (
  <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.1, duration: 0.4 }}>
    {children}
  </motion.div>
)

function Inicio() {
  return (
    <div className="space-y-3">
      <Stagger i={0}>
        <h3 className="font-serif text-[22px] font-semibold text-ink">¡Hola, familia de Rafael! 👋</h3>
      </Stagger>
      <Stagger i={1}>
        <div className={card}>
          <p className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-muted uppercase"><Wallet size={14} /> Pagos</p>
          <p className="mt-1 font-serif text-[24px] font-semibold text-leaf">¡Estás al día! 🎉</p>
          <p className="mt-2 rounded-xl bg-[#f2f8ff] px-3 py-2 text-[12px] text-text">Próximo: <b>Pensión noviembre</b> · vence 5 nov</p>
        </div>
      </Stagger>
      <Stagger i={2}>
        <div className="grid grid-cols-2 gap-3">
          <div className={card}>
            <Mail size={18} className="text-royal" />
            <p className="mt-1 font-semibold text-ink">Mensajes</p>
            <p className="text-[12px] font-bold text-pink">1 nuevo</p>
          </div>
          <div className={card}>
            <Bell size={18} className="text-royal" />
            <p className="mt-1 font-semibold text-ink">Novedades</p>
            <p className="text-[12px] font-bold text-pink">Boletín listo</p>
          </div>
        </div>
      </Stagger>
      <Stagger i={3}>
        <div className={card}>
          <p className="text-[11px] font-bold tracking-wide text-muted uppercase">Asistencia de octubre</p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[#eef0f8]">
            <motion.div className="h-full rounded-full bg-leaf" initial={{ width: 0 }} animate={{ width: '96%' }} transition={{ delay: 0.6, duration: 0.9 }} />
          </div>
          <p className="mt-1.5 text-[12px] text-muted">19 de 20 días · 96%</p>
        </div>
      </Stagger>
      <Stagger i={4}>
        <div className={cn(card, 'flex items-center gap-3')}>
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#fff3c4] text-center leading-none">
            <span>
              <b className="block font-serif text-[17px] text-ink">31</b>
              <span className="text-[9px] font-bold text-[#8a5716] uppercase">oct</span>
            </span>
          </span>
          <span>
            <span className="block text-[14px] font-semibold text-ink">Fiesta de disfraces 🎃</span>
            <span className="block text-[12px] text-muted">Próximo evento del calendario</span>
          </span>
        </div>
      </Stagger>
    </div>
  )
}

function Mensajes() {
  const items = [
    { title: 'Salida pedagógica al Parque de la Leyenda', from: 'Rectoría', when: 'Hoy', unread: true, color: '#e5197e' },
    { title: 'Reunión de padres · viernes 7:30 a. m.', from: 'Directora de grupo', when: 'Ayer', color: '#1fa3dd' },
    { title: 'Día de la familia: trae una foto en familia', from: 'Jardín Gabush', when: '28 oct', color: '#5cb531' },
    { title: 'Menú de la semana', from: 'Coordinación', when: '27 oct', color: '#f26b1d' },
  ]
  return (
    <div className="space-y-3">
      <Stagger i={0}><h3 className="font-serif text-[22px] font-semibold text-ink">Mensajes</h3></Stagger>
      {items.map((m, i) => (
        <Stagger key={m.title} i={i + 1}>
          <div className={cn(card, 'flex items-start gap-3 !p-3.5')}>
            <span className="mt-1 size-3 shrink-0 rounded-full" style={{ background: m.unread ? m.color : '#d6d8ec' }} />
            <span className="min-w-0 flex-1">
              <span className={cn('block text-[14px] leading-snug text-ink', m.unread && 'font-bold')}>{m.title}</span>
              <span className="block text-[12px] text-muted">{m.from} · {m.when}</span>
            </span>
          </div>
        </Stagger>
      ))}
    </div>
  )
}

function Pagos() {
  const paid = [
    ['Pensión octubre', '$ 350.000', '3 oct'],
    ['Pensión septiembre', '$ 350.000', '4 sep'],
    ['Pensión agosto', '$ 350.000', '5 ago'],
  ]
  return (
    <div className="space-y-3">
      <Stagger i={0}><h3 className="font-serif text-[22px] font-semibold text-ink">Pagos</h3></Stagger>
      <Stagger i={1}>
        <div className={card}>
          <p className="text-[11px] font-bold tracking-wide text-muted uppercase">Por pagar</p>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-semibold text-ink">Pensión noviembre</span>
            <span className="font-serif text-[20px] font-semibold text-ink">$ 350.000</span>
          </div>
          <p className="text-[12px] text-muted">Vence el 5 de noviembre</p>
          <motion.div className="mt-3 grid h-11 place-items-center rounded-full bg-pink text-[14px] font-bold text-white" animate={{ scale: [1, 1.03, 1] }} transition={{ repeat: Infinity, duration: 1.6 }}>
            Pagar en línea
          </motion.div>
        </div>
      </Stagger>
      <Stagger i={2}><p className="pt-1 text-[11px] font-bold tracking-wide text-muted uppercase">Pagado</p></Stagger>
      {paid.map(([what, value, when], i) => (
        <Stagger key={what} i={i + 3}>
          <div className={cn(card, 'flex items-center gap-3 !p-3')}>
            <span className="grid size-8 place-items-center rounded-full bg-[#e9f4ee] text-[14px] text-leaf">✓</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold text-ink">{what}</span>
              <span className="block text-[12px] text-muted">Pagado el {when} · {value}</span>
            </span>
            <FileDown size={18} className="text-royal" />
          </div>
        </Stagger>
      ))}
    </div>
  )
}

function Asistencia() {
  // October 2026 starts on a Thursday; weekends empty; a late arrival and one absence
  const marks: Record<number, 'P' | 'T' | 'F'> = {}
  for (let d = 1; d <= 30; d++) {
    const dow = (d + 2) % 7 // 0 = Monday … 6 = Sunday (Oct 1 = Thursday)
    if (dow < 5) marks[d] = 'P'
  }
  marks[14] = 'T'
  marks[22] = 'F'
  const style = { P: 'bg-[#e6f6dd] text-[#2f7d12]', T: 'bg-butter text-[#8a5716]', F: 'bg-[#fde4e3] text-berry' }
  return (
    <div className="space-y-3">
      <Stagger i={0}><h3 className="font-serif text-[22px] font-semibold text-ink">Asistencia</h3></Stagger>
      <Stagger i={1}>
        <div className="grid grid-cols-3 gap-2">
          {[['19', 'Asistió', 'text-leaf'], ['1', 'Tarde', 'text-[#8a5716]'], ['1', 'Faltó', 'text-berry']].map(([n, l, c]) => (
            <div key={l} className={cn(card, '!p-3 text-center')}>
              <p className={cn('font-serif text-[22px] font-semibold', c)}>{n}</p>
              <p className="text-[11px] font-bold text-muted uppercase">{l}</p>
            </div>
          ))}
        </div>
      </Stagger>
      <Stagger i={2}>
        <div className={card}>
          <p className="mb-2 font-semibold text-ink">Octubre 2026</p>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-muted">
            {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i}>{d}</span>)}
            {[0, 1, 2].map((i) => <span key={`e${i}`} />)}
            {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
              <motion.span key={d} className={cn('grid aspect-square place-items-center rounded-lg text-[11px]', marks[d] ? style[marks[d]] : 'text-[#c9cbe0]')} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3 + d * 0.025 }}>
                {d}
              </motion.span>
            ))}
          </div>
        </div>
      </Stagger>
      <Stagger i={3}>
        <div className={cn(card, '!p-3 text-[12px] text-text')}>
          <b className="text-berry">22 oct · Faltó</b> — Cita médica (justificada por la familia).
        </div>
      </Stagger>
    </div>
  )
}

function Notas() {
  const dims = [
    { name: 'Dimensión Cognitiva', color: '#e5197e', subjects: [['Pensamiento lógico', 'Excelente'], ['Exploración del medio', 'Bueno']] },
    { name: 'Dimensión Comunicativa', color: '#1fa3dd', subjects: [['Lenguaje y comunicación', 'Excelente'], ['Inglés', 'Excelente']] },
    { name: 'Dimensión Estética', color: '#8e44c9', subjects: [['Artes plásticas', 'Excelente']] },
  ]
  const chip: Record<string, string> = { Excelente: 'bg-[#e6f6dd] text-[#2f7d12]', Bueno: 'bg-[#e3f3fb] text-[#145f8c]' }
  return (
    <div className="space-y-3">
      <Stagger i={0}><h3 className="font-serif text-[22px] font-semibold text-ink">Notas</h3></Stagger>
      <Stagger i={1}>
        <div className={cn(card, 'flex items-center gap-3 !p-3.5 ring-pink/40')} style={{ borderLeft: '4px solid #e5197e' }}>
          <FileDown size={20} className="text-pink" />
          <span>
            <span className="block text-[14px] font-semibold text-ink">Ver y descargar el boletín</span>
            <span className="block text-[12px] text-muted">Periodo 3 en PDF</span>
          </span>
        </div>
      </Stagger>
      <Stagger i={2}>
        <div className="flex gap-1.5">
          {['P1', 'P2', 'P3', 'Final'].map((p) => (
            <span key={p} className={cn('rounded-full px-3 py-1 text-[12px] font-bold', p === 'P3' ? 'bg-ink text-white' : 'bg-white text-muted ring-1 ring-line')}>{p}</span>
          ))}
        </div>
      </Stagger>
      {dims.map((d, i) => (
        <Stagger key={d.name} i={i + 3}>
          <div className="overflow-hidden rounded-[18px] bg-white ring-1 ring-[#e9ebf7]">
            <p className="px-3.5 py-1.5 text-[11px] font-bold tracking-wide text-white uppercase" style={{ background: d.color }}>{d.name}</p>
            {d.subjects.map(([s, l]) => (
              <div key={s} className="flex items-center justify-between border-t border-[#eef0f8] px-3.5 py-2 first:border-0">
                <span className="text-[14px] font-semibold text-ink">{s}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold', chip[l])}>{l}</span>
              </div>
            ))}
          </div>
        </Stagger>
      ))}
    </div>
  )
}
