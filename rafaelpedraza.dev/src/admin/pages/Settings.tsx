import { Download, ExternalLink, FileText, Gauge, HardDriveDownload, LogOut, RotateCcw, Save, Smartphone } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { api, logout, toast, type Settings, type Stats } from '../api'
import { Card, CardTitle, Confirm, PageHead, Toggle, btnDanger, btnGhost, btnPrimary, field, label } from '../ui'
import { Notifications } from './Notifications'
import { TelegramCard } from './Telegram'

/* Chrome's "install app" prompt (Android / desktop) */
type InstallEvent = Event & { prompt: () => Promise<void> }
let deferred: InstallEvent | null = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as InstallEvent
})

export function SettingsPage({ tick }: { tick: number }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [count, setCount] = useState('')
  const [busy, setBusy] = useState(false)
  const [ask, setAsk] = useState<'' | 'resetVisits' | 'resetDownloads'>('')
  const [clearUnique, setClearUnique] = useState(true)
  const [clearLog, setClearLog] = useState(false)
  const [canInstall, setCanInstall] = useState(Boolean(deferred))
  const standalone = window.matchMedia('(display-mode: standalone)').matches

  useEffect(() => {
    api.get<{ settings: Settings }>('settings.php').then(({ data }) => data?.ok && setSettings(data.settings))
    api.get<Stats>('stats.php').then(({ data }) => {
      if (!data?.ok) return
      setStats(data)
      setCount(String(data.visits.count))
    })
  }, [tick])
  useEffect(() => {
    const on = () => setCanInstall(true)
    window.addEventListener('beforeinstallprompt', on)
    return () => window.removeEventListener('beforeinstallprompt', on)
  }, [])

  const setCv = async (enabled: boolean) => {
    setBusy(true)
    const { data } = await api.post<{ settings: Settings }>('settings.php', { action: 'cv', enabled })
    setBusy(false)
    if (!data?.ok) return toast('No se pudo guardar.')
    setSettings(data.settings)
    toast(enabled ? 'El botón "Descargar CV" ya se muestra en el sitio.' : 'El botón "Descargar CV" quedó oculto en todo el sitio.')
  }

  const saveCount = async (e: FormEvent) => {
    e.preventDefault()
    const n = Number(count)
    if (!Number.isInteger(n) || n < 0) return toast('Escribe un número entero (0 o más).')
    setBusy(true)
    const { data } = await api.post('stats.php', { action: 'setVisits', count: n })
    setBusy(false)
    if (!data?.ok) return toast('No se pudo guardar.')
    setStats((s) => (s ? { ...s, visits: { ...s.visits, count: n } } : s))
    toast(`El contador quedó en ${n.toLocaleString('es-CO')}.`)
  }

  const resetVisits = async () => {
    const { data } = await api.post('stats.php', { action: 'resetVisits', clearUnique, clearLog })
    if (!data?.ok) return toast('No se pudo reiniciar.')
    setCount('0')
    setStats((s) => (s ? { ...s, visits: { count: 0, unique: clearUnique ? 0 : s.visits.unique }, visitLog: clearLog ? [] : s.visitLog } : s))
    toast('Contador de visitas reiniciado.')
  }

  const resetDownloads = async () => {
    const { data } = await api.post('stats.php', { action: 'resetDownloads', clearLog: true })
    if (!data?.ok) return toast('No se pudo reiniciar.')
    setStats((s) => (s ? { ...s, downloads: { count: 0, log: [] } } : s))
    toast('Contador de descargas reiniciado.')
  }

  return (
    <>
      <PageHead title="Ajustes" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <CardTitle icon={FileText} sub={settings?.cvEnabled === false ? 'Oculto: nadie ve el botón y el enlace de descarga no funciona.' : 'Visible en el menú, la portada y la sección de contacto.'}>
              Botón "Descargar CV"
            </CardTitle>
            <Toggle on={settings?.cvEnabled ?? false} onChange={setCv} disabled={!settings || busy} label="Mostrar botón Descargar CV" />
          </div>
          <p className="text-sm text-muted">
            Descargas registradas: <b className="text-fg tabular-nums">{stats?.downloads.count ?? '—'}</b>
          </p>
          <button type="button" className={`${btnGhost} mt-4`} onClick={() => setAsk('resetDownloads')} disabled={!stats}>
            <RotateCcw size={16} /> Reiniciar contador de descargas
          </button>
        </Card>

        <Card>
          <CardTitle icon={Gauge} sub="Suma una vez por IP. Tus visitas con la sesión del panel abierta no cuentan.">
            Contador de visitas
          </CardTitle>
          <form onSubmit={saveCount} className="flex items-end gap-2">
            <label className="flex-1">
              <span className={label}>Valor que se muestra en el sitio</span>
              <input className={field} inputMode="numeric" pattern="[0-9]*" value={count} onChange={(e) => setCount(e.target.value.replace(/\D/g, ''))} disabled={!stats} />
            </label>
            <button type="submit" className={btnPrimary} disabled={busy || !stats || count === String(stats?.visits.count)}>
              <Save size={16} /> Guardar
            </button>
          </form>
          <p className="mt-2 text-xs text-dim">IPs registradas: {stats?.visits.unique ?? '—'} (las que ya no vuelven a sumar).</p>
          <button type="button" className={`${btnDanger} mt-4`} onClick={() => setAsk('resetVisits')} disabled={!stats}>
            <RotateCcw size={16} /> Reiniciar a 0
          </button>
        </Card>

        <Notifications />

        <TelegramCard settings={settings} onChange={setSettings} />

        <div className="space-y-4">
          <Card>
            <CardTitle icon={HardDriveDownload}>Copia de seguridad</CardTitle>
            <p className="text-sm leading-relaxed text-muted">
              Tus datos (experiencia, stack, mensajes, visitas, descargas y ajustes) se guardan en el servidor, fuera de la carpeta de la página: publicar una nueva versión no los borra. Además se hace una copia
              automática cada día (se guardan los últimos 14 días). Si quieres una copia en tu celular o computador, descárgala aquí.
            </p>
            <a href="/api/backup.php" className={`${btnGhost} mt-4`}>
              <HardDriveDownload size={16} /> Descargar copia de seguridad
            </a>
          </Card>

          <Card>
            <CardTitle icon={Smartphone}>App en el celular</CardTitle>
            {standalone ? (
              <p className="text-sm text-muted">Estás usando la app instalada. ✔</p>
            ) : canInstall ? (
              <button
                type="button"
                onClick={async () => {
                  await deferred?.prompt()
                  deferred = null
                  setCanInstall(false)
                }}
                className={btnPrimary}
              >
                <Download size={16} /> Instalar app
              </button>
            ) : (
              <p className="text-sm leading-relaxed text-muted">
                En Chrome (Android): menú <b className="text-fg">⋮</b> → <b className="text-fg">Instalar app</b> o <b className="text-fg">Agregar a la pantalla principal</b>. En iPhone (Safari): botón{' '}
                <b className="text-fg">Compartir</b> → <b className="text-fg">Agregar a inicio</b>.
              </p>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <a href="/" target="_blank" rel="noopener" className={btnGhost}>
          <ExternalLink size={16} /> Ver el sitio
        </a>
        <button type="button" onClick={logout} className={btnDanger}>
          <LogOut size={16} /> Cerrar sesión
        </button>
      </div>

      <Confirm
        open={ask === 'resetVisits'}
        title="¿Reiniciar el contador de visitas a 0?"
        body={
          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" className="mt-1 size-4 accent-[#2f8cff]" checked={clearUnique} onChange={(e) => setClearUnique(e.target.checked)} />
              <span>Olvidar las IPs registradas (quienes ya visitaron vuelven a sumar).</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input type="checkbox" className="mt-1 size-4 accent-[#2f8cff]" checked={clearLog} onChange={(e) => setClearLog(e.target.checked)} />
              <span>Borrar también el historial de visitas.</span>
            </label>
          </div>
        }
        confirm="Reiniciar"
        danger
        onClose={() => setAsk('')}
        onConfirm={resetVisits}
      />
      <Confirm open={ask === 'resetDownloads'} title="¿Reiniciar el contador de descargas?" body="Se borra el contador y el historial de descargas del CV." confirm="Reiniciar" danger onClose={() => setAsk('')} onConfirm={resetDownloads} />
    </>
  )
}
