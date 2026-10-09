import { Clock, LogOut } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { logout, logoutIdle } from '@/lib/calendar'

/** Minutes without touching the panel before the warning, and seconds the warning lasts before closing. */
const IDLE_MINUTES = 15
const WARN_SECONDS = 60
/** While the person is active, refresh the server session every few minutes (it expires after 30 min idle). */
const HEARTBEAT_MS = 5 * 60_000
const KEY = 'gb-panel-activity'

const now = () => Date.now()
const readShared = () => {
  try {
    return Number(localStorage.getItem(KEY)) || 0
  } catch {
    return 0
  }
}
const writeShared = (t: number) => {
  try {
    localStorage.setItem(KEY, String(t))
  } catch {
    /* private mode: this tab only */
  }
}

/**
 * Inactivity guard of the staff panel: after IDLE_MINUTES without mouse, keyboard, touch or scroll it shows
 * "Tu sesión está por terminar" with a countdown; "Seguir conectado" keeps the session, "Cerrar sesión" (or the
 * countdown reaching 0) signs out. Activity is shared between tabs, so working in one tab keeps the others open.
 */
export function IdleGuard() {
  const last = useRef(Math.max(now(), readShared()))
  const lastBeat = useRef(now())
  const [left, setLeft] = useState<number | null>(null) // seconds left while warning
  const warning = left !== null

  // record activity (throttled), shared with the other tabs
  useEffect(() => {
    let mark = 0
    const onActivity = () => {
      if (warning) return // during the warning only the buttons count
      const t = now()
      if (t - mark < 1000) return
      mark = t
      last.current = t
      writeShared(t)
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY && e.newValue) {
        last.current = Math.max(last.current, Number(e.newValue))
        if (warning && now() - last.current < 5000) setLeft(null) // another tab said "seguir"
      }
    }
    const events = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true, capture: true }))
    window.addEventListener('storage', onStorage)
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onActivity, { capture: true }))
      window.removeEventListener('storage', onStorage)
    }
  }, [warning])

  // clock: warning, countdown, heartbeat
  useEffect(() => {
    const id = window.setInterval(() => {
      last.current = Math.max(last.current, readShared())
      const idle = now() - last.current
      const total = IDLE_MINUTES * 60_000
      if (idle >= total + WARN_SECONDS * 1000) {
        window.clearInterval(id)
        void logoutIdle()
        return
      }
      if (idle >= total) {
        setLeft(Math.ceil((total + WARN_SECONDS * 1000 - idle) / 1000))
        return
      }
      setLeft(null)
      // active recently: keep the server session alive
      if (idle < HEARTBEAT_MS && now() - lastBeat.current >= HEARTBEAT_MS) {
        lastBeat.current = now()
        void fetch('/api/auth.php', { credentials: 'same-origin', cache: 'no-store' }).catch(() => undefined)
      }
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  const stay = () => {
    const t = now()
    last.current = t
    lastBeat.current = t
    writeShared(t)
    setLeft(null)
    void fetch('/api/auth.php', { credentials: 'same-origin', cache: 'no-store' }).catch(() => undefined)
  }

  const pct = warning ? (left! / WARN_SECONDS) * 100 : 100
  return (
    <Modal open={warning} onClose={stay} label="Tu sesión está por terminar" closeLabel="Seguir conectado" className="sm:!max-w-md">
      <div className="space-y-5 p-6 text-center sm:p-8">
        <div className="relative mx-auto size-28">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            <circle cx="50" cy="50" r="44" fill="none" stroke="#eef0f8" strokeWidth="9" />
            <circle cx="50" cy="50" r="44" fill="none" stroke={left !== null && left <= 10 ? '#d92d20' : '#3a36a8'} strokeWidth="9" strokeLinecap="round" strokeDasharray={2 * Math.PI * 44} strokeDashoffset={(2 * Math.PI * 44 * (100 - pct)) / 100} className="transition-[stroke-dashoffset] duration-1000 ease-linear" />
          </svg>
          <span className="absolute inset-0 grid place-items-center font-serif text-[2.2rem] font-semibold text-ink tabular-nums" aria-live="polite">
            {left}
          </span>
        </div>
        <div>
          <h2 className="flex items-center justify-center gap-2 text-[1.5rem]">
            <Clock size={22} className="text-royal" /> Tu sesión está por terminar
          </h2>
          <p className="mt-2 text-[15px] text-muted">
            No hemos visto actividad en los últimos {IDLE_MINUTES} minutos. Por seguridad cerraremos la sesión en <b className="text-ink">{left} segundos</b>.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <button type="button" onClick={() => void logout()} className="btn btn-ghost flex-1">
            <LogOut size={17} /> Cerrar sesión
          </button>
          <button type="button" onClick={stay} className="btn btn-primary flex-1">
            Seguir conectado
          </button>
        </div>
      </div>
    </Modal>
  )
}
