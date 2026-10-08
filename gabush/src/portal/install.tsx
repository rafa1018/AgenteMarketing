import { Download, Share, Smartphone } from 'lucide-react'
import { useState, useSyncExternalStore } from 'react'

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

export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

/** "Instala la app": the family portal only (its manifest is /familia/), never the staff panel. */
export function InstallBox({ highlight = false }: { highlight?: boolean }) {
  const ev = useInstallEvent()
  const [installed] = useState(isStandalone)
  if (installed) return null
  return (
    <div className={'rounded-2xl p-4 ' + (highlight ? 'bg-white ring-2 ring-pink' : 'bg-white')}>
      <p className="flex items-center gap-2 font-semibold text-ink">
        <Smartphone size={20} className="text-royal" /> Instala la app de familias
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
          <li>Abre Gabush Familias desde el nuevo ícono.</li>
        </ol>
      ) : (
        <p className="mt-1 text-sm text-muted">En el menú del navegador (⋮) elige «Instalar app» o «Agregar a la pantalla principal».</p>
      )}
    </div>
  )
}
