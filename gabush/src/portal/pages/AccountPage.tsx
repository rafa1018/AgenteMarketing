import { BellOff, BellRing, Download, Loader2, LogOut, Share, Smartphone, Users } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import { fullName } from '@/shared/format'
import { api, logout, toast, useSession } from '../session'
import { Card, Title } from '../ui'
import { ChangePassword } from './Auth'

/* ───────── install (Android/desktop prompt; iPhone needs "Agregar a inicio") ───────── */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
let installEvent: InstallEvent | null = null
const installListeners = new Set<() => void>()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installEvent = e as InstallEvent
    installListeners.forEach((l) => l())
  })
  window.addEventListener('appinstalled', () => {
    installEvent = null
    installListeners.forEach((l) => l())
  })
}
const useInstallEvent = () =>
  useSyncExternalStore(
    (l) => {
      installListeners.add(l)
      return () => installListeners.delete(l)
    },
    () => installEvent,
  )

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/* ───────── push ───────── */
type PushState = 'loading' | 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

function b64ToBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function usePush() {
  const { me } = useSession()
  const [state, setState] = useState<PushState>('loading')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setState(isIOS() && !isStandalone() ? 'needs-install' : 'unsupported')
      return
    }
    if (Notification.permission === 'denied') return setState('denied')
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        setState(sub ? 'on' : 'off')
        // keep the server in sync (the subscription may have been created on another login)
        if (sub) api.post('/portal/push', sub.toJSON()).catch(() => null)
      })
      .catch(() => setState('unsupported'))
  }, [])
  const enable = async () => {
    if (!me?.vapidKey) return toast('Las notificaciones aún no están configuradas en el jardín.')
    setBusy(true)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setState(perm === 'denied' ? 'denied' : 'off')
        return
      }
      const reg = await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(me.vapidKey) }))
      await api.post('/portal/push', sub.toJSON())
      setState('on')
      toast('¡Listo! Te avisaremos de pagos y novedades.')
    } catch {
      toast('No se pudieron activar las notificaciones.')
    } finally {
      setBusy(false)
    }
  }
  const disable = async () => {
    setBusy(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await api.del('/portal/push', { endpoint: sub.endpoint }).catch(() => null)
        await sub.unsubscribe()
      }
      setState('off')
    } finally {
      setBusy(false)
    }
  }
  return { state, busy, enable, disable }
}

/** Invitation to turn on notifications (home shows the compact version only while they are off). */
export function PushCard({ compact = false }: { compact?: boolean }) {
  const p = usePush()
  if (compact && p.state !== 'off' && p.state !== 'needs-install') return null
  return (
    <Card className={compact ? 'border-l-4 border-l-[#5b54c9]' : ''}>
      <p className="flex items-center gap-2 font-semibold text-ink">
        <BellRing size={20} className="text-royal" /> Notificaciones en el celular
      </p>
      {p.state === 'loading' && <p className="mt-1 text-sm text-muted">Revisando…</p>}
      {p.state === 'on' && (
        <>
          <p className="mt-1 text-sm text-leaf">Activas en este dispositivo. Te avisamos de pensiones por pagar, pagos aprobados, mensajes y novedades.</p>
          {!compact && (
            <button type="button" onClick={p.disable} disabled={p.busy} className="btn btn-ghost mt-3 w-full">
              <BellOff size={18} /> Desactivar en este dispositivo
            </button>
          )}
        </>
      )}
      {p.state === 'off' && (
        <>
          <p className="mt-1 text-sm text-muted">Recibe un aviso cuando haya una pensión por pagar, un mensaje del jardín o cualquier novedad de tu hijo o hija.</p>
          <button type="button" onClick={p.enable} disabled={p.busy} className="btn btn-primary mt-3 w-full">
            {p.busy ? <Loader2 size={18} className="animate-spin" /> : <BellRing size={18} />} Activar notificaciones
          </button>
        </>
      )}
      {p.state === 'needs-install' && <p className="mt-1 text-sm text-muted">En iPhone, primero instala el portal en tu pantalla de inicio (abajo te explicamos cómo) y ábrelo desde ese ícono; ahí podrás activar las notificaciones.</p>}
      {p.state === 'denied' && <p className="mt-1 text-sm text-berry">Bloqueaste las notificaciones. Para activarlas, ve a los ajustes del navegador o del celular → Notificaciones → permite «Gabush».</p>}
      {p.state === 'unsupported' && <p className="mt-1 text-sm text-muted">Este navegador no permite notificaciones. Instala el portal o ábrelo en Chrome o Safari actualizados.</p>}
    </Card>
  )
}

function InstallCard() {
  const ev = useInstallEvent()
  const [installed] = useState(isStandalone)
  if (installed) return null
  return (
    <Card>
      <p className="flex items-center gap-2 font-semibold text-ink">
        <Smartphone size={20} className="text-royal" /> Instala la app del jardín
      </p>
      {ev ? (
        <>
          <p className="mt-1 text-sm text-muted">Queda como una app en tu celular, con el ícono del león Gabush.</p>
          <button
            type="button"
            onClick={async () => {
              await ev.prompt()
              await ev.userChoice
              installEvent = null
              installListeners.forEach((l) => l())
            }}
            className="btn btn-primary mt-3 w-full"
          >
            <Download size={18} /> Instalar
          </button>
        </>
      ) : isIOS() ? (
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-text">
          <li>Abre esta página en <b>Safari</b>.</li>
          <li>
            Toca el botón <b>Compartir</b> <Share size={14} className="inline align-[-2px]" />.
          </li>
          <li>
            Elige <b>«Agregar a inicio»</b> y luego <b>Agregar</b>.
          </li>
          <li>Abre Gabush desde el nuevo ícono y activa las notificaciones.</li>
        </ol>
      ) : (
        <p className="mt-1 text-sm text-muted">En el menú del navegador (⋮) elige «Instalar app» o «Agregar a la pantalla principal».</p>
      )}
    </Card>
  )
}

export function AccountPage() {
  const { me } = useSession()
  if (!me) return null
  return (
    <div className="space-y-4">
      <Title sub={`Usuario: ${me.student.code}`}>Mi cuenta</Title>
      <Card>
        <p className="text-[12px] font-bold tracking-wide text-muted uppercase">Estudiante</p>
        <p className="font-semibold text-ink">{fullName(me.student)}</p>
        <p className="text-sm text-muted">
          {me.student.course ?? 'Sin curso asignado'}
          {me.student.director && ` · ${me.student.director}`}
        </p>
        {me.guardians.length > 0 && (
          <>
            <p className="mt-3 flex items-center gap-1.5 text-[12px] font-bold tracking-wide text-muted uppercase">
              <Users size={14} /> Acudientes
            </p>
            <ul className="text-[15px]">
              {me.guardians.map((g, i) => (
                <li key={i}>
                  {g.name} <span className="text-muted">· {g.relationship}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[12px] text-muted">¿Algún dato cambió? Avísale al jardín para actualizarlo.</p>
          </>
        )}
      </Card>
      <PushCard />
      <InstallCard />
      <Card>
        <ChangePassword />
      </Card>
      <button type="button" onClick={logout} className="btn btn-ghost w-full text-berry">
        <LogOut size={18} /> Cerrar sesión
      </button>
    </div>
  )
}
