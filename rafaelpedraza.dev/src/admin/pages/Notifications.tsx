import { BellOff, BellRing, Loader2, Send } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api, toast } from '../api'
import { Card, CardTitle, Toggle, btnGhost, btnPrimary } from '../ui'

type Prefs = { mensajes: boolean; descargas: boolean; visitas: boolean }
const DEFAULT_PREFS: Prefs = { mensajes: true, descargas: true, visitas: false }
const TYPES: { id: keyof Prefs; label: string; detail: string }[] = [
  { id: 'mensajes', label: 'Mensajes nuevos', detail: 'Al instante, cuando alguien te escribe desde el formulario.' },
  { id: 'descargas', label: 'Descargas de tu CV', detail: 'Cada vez que alguien descarga tu hoja de vida.' },
  { id: 'visitas', label: 'Visitantes nuevos', detail: 'Cuando entra alguien desde una IP nueva (puede ser frecuente).' },
]

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

  useEffect(() => {
    if (!supported()) return setReady(true)
    ;(async () => {
      const { data } = await api.get('push.php')
      const reg = await navigator.serviceWorker.getRegistration('/admin/')
      const current = (await reg?.pushManager.getSubscription()) ?? null
      if (data?.ok) {
        setPublicKey(data.publicKey)
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

  const enable = async () => {
    setBusy(true)
    try {
      const p = await Notification.requestPermission()
      setPerm(p)
      if (p !== 'granted') return
      const reg = (await navigator.serviceWorker.getRegistration('/admin/')) ?? (await navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }))
      await navigator.serviceWorker.ready
      const s = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) })
      const { data } = await api.post('push.php', { action: 'subscribe', subscription: s.toJSON(), prefs, device: deviceName() })
      if (!data?.ok) throw new Error('subscribe')
      setSub(s)
      setDevices((n) => n + 1)
      await api.post('push.php', { action: 'test', endpoint: s.endpoint })
      toast('Notificaciones activadas. Te enviamos una de prueba.')
    } catch {
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
      <CardTitle icon={BellRing} sub="Avisos como los de WhatsApp, aunque el panel esté cerrado. Actívalas en cada celular donde quieras recibirlas.">
        Notificaciones en el celular
      </CardTitle>

      {!ready ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 size={16} className="animate-spin" /> Revisando…
        </p>
      ) : !supported() ? (
        <p className="rounded-lg border border-warn/30 bg-warn/10 px-4 py-3 text-sm text-warn">
          {isIOS() && !standalone()
            ? 'En iPhone primero instala el panel en la pantalla de inicio (Safari → Compartir → Agregar a inicio), ábrelo desde ese ícono y vuelve aquí.'
            : 'Este navegador no permite notificaciones. Usa Chrome en Android o la app instalada.'}
        </p>
      ) : perm === 'denied' ? (
        <p className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
          Las notificaciones están bloqueadas para este sitio. Actívalas en los permisos del navegador (ícono del candado → Notificaciones → Permitir) y recarga.
        </p>
      ) : sub ? (
        <>
          <p className="inline-flex items-center gap-2 rounded-full bg-ok/10 px-3 py-1.5 text-sm text-ok">● Activadas en este {deviceName().toLowerCase()}</p>
          <ul className="mt-4 divide-y divide-line">
            {TYPES.map((tp) => (
              <li key={tp.id} className="flex items-center justify-between gap-4 py-3">
                <span>
                  <span className="block text-[15px] text-fg">{tp.label}</span>
                  <span className="block text-sm text-muted">{tp.detail}</span>
                </span>
                <Toggle on={prefs[tp.id]} onChange={() => toggle(tp.id)} label={tp.label} />
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={test} className={btnGhost}>
              <Send size={16} /> Enviar prueba
            </button>
            <button type="button" disabled={busy} onClick={disable} className={btnGhost}>
              <BellOff size={16} /> Desactivar aquí
            </button>
          </div>
        </>
      ) : (
        <>
          <ul className="space-y-1.5 text-sm text-muted">
            {TYPES.map((tp) => (
              <li key={tp.id}>
                <b className="font-medium text-fg">{tp.label}:</b> {tp.detail}
              </li>
            ))}
          </ul>
          <button type="button" disabled={busy || !publicKey} onClick={enable} className={`${btnPrimary} mt-5`}>
            {busy ? <Loader2 size={17} className="animate-spin" /> : <BellRing size={17} />} Activar notificaciones aquí
          </button>
        </>
      )}
      {devices > 0 && <p className="mt-4 text-xs text-dim">{devices === 1 ? '1 dispositivo recibe notificaciones.' : `${devices} dispositivos reciben notificaciones.`}</p>}
    </Card>
  )
}
