import { BellOff, BellRing, Loader2, Send, Smartphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useCalendar, type Perm } from '@/lib/calendar'
import { api, toast } from '../store'
import { Card, PageHead } from '../ui'

export type Prefs = { inscripciones: boolean; pagos: boolean; asistencia: boolean; cumpleanos: boolean; eventos: boolean }
const DEFAULT_PREFS: Prefs = { inscripciones: true, pagos: true, asistencia: true, cumpleanos: true, eventos: true }
export const PUSH_TYPES: { id: keyof Prefs; label: string; detail: string }[] = [
  { id: 'inscripciones', label: 'Inscripciones nuevas', detail: 'Al instante, cuando alguien llena el formulario de la página.' },
  { id: 'pagos', label: 'Pagos pendientes', detail: 'Cada mañana (7:00 a. m.) si hay cobros vencidos o para hoy.' },
  { id: 'asistencia', label: 'Asistencia sin marcar', detail: 'A las 11:30 a. m. (jornada mañana) y 5:15 p. m. si el jardín abrió y faltan niños por marcar.' },
  { id: 'cumpleanos', label: 'Cumpleaños', detail: 'A las 7:00 a. m. el día que un estudiante cumple años.' },
  { id: 'eventos', label: 'Eventos del día', detail: 'A las 7:00 a. m. si hoy hay un evento (públicos y privados 🔒).' },
]

/** Who may receive each type (same rule as the server). */
export const TYPE_PERMS: Record<keyof Prefs, Perm[]> = {
  inscripciones: ['inscripciones'],
  pagos: ['pagos'],
  asistencia: ['asistencia'],
  cumpleanos: ['asistencia', 'estudiantes'],
  eventos: ['calendario', 'asistencia', 'estudiantes'],
}

const supported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const standalone = () => window.matchMedia('(display-mode: standalone)').matches
const deviceName = () => {
  const ua = navigator.userAgent
  if (/iphone/i.test(ua)) return 'iPhone'
  if (/ipad/i.test(ua)) return 'iPad'
  if (/android/i.test(ua)) return 'Celular Android'
  if (/windows/i.test(ua)) return 'Computador Windows'
  if (/mac/i.test(ua)) return 'Mac'
  return 'Dispositivo'
}
const keyBytes = (b64u: string) => {
  const raw = atob(b64u.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64u.length % 4)) % 4))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/** Push notifications on this device (Ajustes). */
export function Notifications() {
  const [publicKey, setPublicKey] = useState('')
  const [devices, setDevices] = useState(0)
  const [sub, setSub] = useState<PushSubscription | null>(null)
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS)
  const [perm, setPerm] = useState<NotificationPermission>(supported() ? Notification.permission : 'denied')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const perms = useCalendar((s) => s.perms)
  // what the administrator allowed for this user (Usuarios); null = everything the permissions allow
  const [allowed, setAllowed] = useState<string[] | null>(null)
  const types = PUSH_TYPES.filter((tp) => TYPE_PERMS[tp.id].some((p) => perms.includes(p)) && (allowed === null || allowed.includes(tp.id)))

  useEffect(() => {
    if (!supported()) return setReady(true)
    ;(async () => {
      const { data } = await api.get('push.php')
      const reg = await navigator.serviceWorker.getRegistration('/admin/')
      const current = (await reg?.pushManager.getSubscription()) ?? null
      if (data?.ok) {
        setPublicKey(data.publicKey)
        setAllowed(Array.isArray(data.allowed) ? data.allowed : null)
        setDevices(data.subs.length)
        const mine = current && data.subs.find((s: { endpoint: string }) => s.endpoint === current.endpoint)
        if (mine) setPrefs({ ...DEFAULT_PREFS, ...mine.prefs })
        // subscribed in the browser but unknown to the server (e.g. data reset) → register again
        if (current && !mine) await api.post('push.php', { action: 'subscribe', subscription: current.toJSON(), prefs: DEFAULT_PREFS, device: deviceName() })
      }
      setSub(current)
      setReady(true)
    })()
  }, [])

  // a failed attempt is reported (who, device, why) so the school can see it in Auditoría → Notificaciones
  const report = (error: string) => api.post('push.php', { action: 'report', device: deviceName(), error: `${error} · ${navigator.userAgent.slice(0, 140)}` }).catch(() => null)

  const enable = async () => {
    setBusy(true)
    let stage = 'pidiendo permiso'
    try {
      const p = await Notification.requestPermission()
      setPerm(p)
      if (p !== 'granted') {
        await report(p === 'denied' ? 'El celular bloqueó el permiso de notificaciones' : 'No aceptó el permiso de notificaciones')
        return
      }
      stage = 'preparando la app'
      const reg = (await navigator.serviceWorker.getRegistration('/admin/')) ?? (await navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }))
      await navigator.serviceWorker.ready
      stage = 'suscribiendo el celular'
      const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) })
      stage = 'guardando en el servidor'
      const { data } = await api.post('push.php', { action: 'subscribe', subscription: s.toJSON(), prefs, device: deviceName() })
      if (!data?.ok) throw new Error(data?.error ?? 'el servidor no lo aceptó')
      setSub(s)
      setDevices((n) => n + 1)
      await api.post('push.php', { action: 'test', endpoint: s.endpoint })
      toast('Notificaciones activadas. Te enviamos una de prueba.')
    } catch (e) {
      await report(`Falló ${stage}: ${e instanceof Error ? e.message : String(e)}`)
      toast('No se pudieron activar las notificaciones en este dispositivo.')
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    if (!sub) return
    setBusy(true)
    await api.post('push.php', { action: 'unsubscribe', endpoint: sub.endpoint })
    await sub.unsubscribe().catch(() => {})
    setSub(null)
    setDevices((n) => Math.max(0, n - 1))
    setBusy(false)
    toast('Notificaciones desactivadas en este dispositivo.')
  }

  const toggle = async (id: keyof Prefs) => {
    const next = { ...prefs, [id]: !prefs[id] }
    setPrefs(next)
    if (sub) await api.post('push.php', { action: 'prefs', endpoint: sub.endpoint, prefs: next })
  }

  const test = async () => {
    if (!sub) return
    const { data } = await api.post('push.php', { action: 'test', endpoint: sub.endpoint })
    toast(data?.ok ? 'Notificación de prueba enviada.' : 'No se pudo enviar la prueba.')
  }

  return (
    <Card>
      <h2 className="flex items-center gap-2 text-xl">
        <BellRing size={20} className="text-royal" /> Notificaciones en el celular
      </h2>
      <p className="mt-1 text-[15px] text-muted">Avisos como los de WhatsApp, aunque la app esté cerrada. Actívalas en cada celular donde quieras recibirlas.</p>

      {!ready ? (
        <p className="mt-4 flex items-center gap-2 text-muted">
          <Loader2 size={16} className="animate-spin" /> Revisando…
        </p>
      ) : !supported() ? (
        <p className="mt-4 rounded-lg bg-[#fff4e0] px-4 py-3 text-sm text-[#8a5716]">
          {isIOS() && !standalone()
            ? 'En iPhone primero agrega la app a la pantalla de inicio (Safari → Compartir → Agregar a inicio), ábrela desde ese ícono y vuelve aquí.'
            : 'Este navegador no permite notificaciones. Usa Chrome en Android o la app instalada.'}
        </p>
      ) : perm === 'denied' ? (
        <p className="mt-4 rounded-lg bg-[#fdf0ef] px-4 py-3 text-sm text-berry">Las notificaciones están bloqueadas para este sitio. Actívalas en los permisos del navegador (ícono del candado → Notificaciones → Permitir) y recarga.</p>
      ) : sub ? (
        <>
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#e9f4ee] px-3 py-1.5 text-sm font-semibold text-leaf">● Activadas en este {deviceName().toLowerCase()}</p>
          <ul className="mt-4 space-y-3">
            {types.map((tp) => (
              <li key={tp.id}>
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={prefs[tp.id]} onChange={() => toggle(tp.id)} className="mt-1 size-5 shrink-0 accent-[#3a36a8]" />
                  <span>
                    <span className="block font-semibold text-ink">{tp.label}</span>
                    <span className="block text-sm text-muted">{tp.detail}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={test} className="btn btn-ghost !min-h-11">
              <Send size={16} /> Enviar prueba
            </button>
            <button type="button" disabled={busy} onClick={disable} className="btn btn-ghost !min-h-11 text-berry">
              <BellOff size={16} /> Desactivar aquí
            </button>
          </div>
        </>
      ) : (
        <>
          <ul className="mt-4 space-y-2 text-sm text-muted">
            {types.map((tp) => (
              <li key={tp.id}>
                <b className="text-ink">{tp.label}:</b> {tp.detail}
              </li>
            ))}
          </ul>
          <button type="button" disabled={busy || !publicKey} onClick={enable} className={cn('btn btn-gold mt-5 !min-h-11', (busy || !publicKey) && 'opacity-70')}>
            {busy ? <Loader2 size={17} className="animate-spin" /> : <BellRing size={17} />} Activar notificaciones aquí
          </button>
        </>
      )}
      {devices > 0 && <p className="mt-4 text-xs text-muted">{devices === 1 ? 'Recibes notificaciones en 1 dispositivo.' : `Recibes notificaciones en ${devices} dispositivos.`}</p>}
    </Card>
  )
}

/** How to install the panel as an app on the phone. */
function InstallCard() {
  const ios = isIOS()
  if (standalone()) {
    return (
      <Card>
        <h2 className="flex items-center gap-2 text-xl">
          <Smartphone size={20} className="text-royal" /> App instalada
        </h2>
        <p className="mt-1 text-[15px] text-muted">Estás usando el panel como app. Ábrelo siempre desde el ícono del león en tu pantalla de inicio.</p>
      </Card>
    )
  }
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-xl">
        <Smartphone size={20} className="text-royal" /> Instala el panel en tu celular
      </h2>
      <p className="mt-1 text-[15px] text-muted">Queda como una app con el ícono del león: abre directo, a pantalla completa y recibe notificaciones.</p>
      <ol className="mt-4 space-y-2 text-[15px]">
        {(ios
          ? ['Abre esta página en Safari.', 'Toca Compartir (cuadro con flecha hacia arriba).', 'Elige “Agregar a pantalla de inicio”.', 'Abre la app desde el ícono y activa las notificaciones aquí.']
          : ['Abre esta página en Chrome.', 'Toca el menú ⋮ (arriba a la derecha).', 'Elige “Instalar app” o “Agregar a pantalla principal”.', 'Abre la app desde el ícono y activa las notificaciones aquí.']
        ).map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#eeedfb] text-sm font-bold text-royal">{i + 1}</span>
            <span className="pt-0.5">{step}</span>
          </li>
        ))}
      </ol>
    </Card>
  )
}

export function NotificationsPage() {
  return (
    <div className="space-y-6">
      <PageHead title="Notificaciones" sub="Recibe avisos en tu celular aunque la app esté cerrada: inscripciones nuevas, asistencia, cumpleaños y más, según lo que manejas." />
      <InstallCard />
      <Notifications />
    </div>
  )
}
