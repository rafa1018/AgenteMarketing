import { Download, ExternalLink, HardDriveDownload, LogOut, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { logout, newDraft, openEditor } from '@/lib/calendar'
import { todayYMD } from '@/lib/dates'
import { Calendar } from '@/components/sections/Calendar'
import { AdminSettings } from '@/components/admin/AdminSettings'
import { EventList } from '@/components/admin/AdminUI'
import { Card, PageHead } from '../ui'

export function CalendarPage() {
  return (
    <div className="space-y-6">
      <PageHead
        title="Calendario"
        sub="Lo que publiques aquí lo ven las familias en la página."
        actions={
          <button type="button" onClick={() => openEditor(newDraft(todayYMD()))} className="btn btn-gold !min-h-11">
            <Plus size={18} /> Nuevo evento
          </button>
        }
      />
      <Calendar embedded />
      <Card>
        <EventList />
      </Card>
    </div>
  )
}

/* Chrome's "install app" prompt (Android / desktop) */
type InstallEvent = Event & { prompt: () => Promise<void> }
let deferred: InstallEvent | null = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  deferred = e as InstallEvent
})

export function Settings() {
  const [canInstall, setCanInstall] = useState(Boolean(deferred))
  useEffect(() => {
    const on = () => setCanInstall(true)
    window.addEventListener('beforeinstallprompt', on)
    return () => window.removeEventListener('beforeinstallprompt', on)
  }, [])

  const standalone = window.matchMedia('(display-mode: standalone)').matches

  return (
    <div className="space-y-6">
      <PageHead title="Ajustes" />

      <Card>
        <h2 className="text-xl">Planes, precios y mensualidades</h2>
        <p className="mt-1 text-[15px] text-muted">Ahora están en <b>Cartera → Planes</b> (mensual o por día) y <b>Cartera → Precios y mora</b>. El plan y el descuento de cada estudiante se eligen en su matrícula.</p>
        <a href="#/cartera" className="btn btn-primary mt-4 !min-h-11">
          <ExternalLink size={17} /> Ir a Cartera
        </a>
      </Card>

      <Card>
        <h2 className="text-xl">Horario y festivos</h2>
        <AdminSettings />
      </Card>

      <Card>
        <h2 className="text-xl">Copia de seguridad</h2>
        <p className="mt-1 text-[15px] text-muted">
          Tus datos se guardan en el servidor, fuera de la carpeta de la página: publicar una nueva versión no los borra. Además se hace una copia automática cada día (se guardan
          los últimos 14 días). Si quieres una copia en tu celular o computador, descárgala aquí.
        </p>
        <a href="/api/backup.php" className="btn btn-ghost mt-4 !min-h-11">
          <HardDriveDownload size={17} /> Descargar copia de seguridad
        </a>
      </Card>

      <Card>
        <h2 className="text-xl">App en el celular</h2>
        {standalone ? (
          <p className="mt-1 text-[15px] text-muted">Estás usando la app instalada. ✔</p>
        ) : canInstall ? (
          <button
            type="button"
            onClick={async () => {
              await deferred?.prompt()
              deferred = null
              setCanInstall(false)
            }}
            className="btn btn-gold mt-3 !min-h-11"
          >
            <Download size={17} /> Instalar app
          </button>
        ) : (
          <p className="mt-1 text-[15px] text-muted">
            En Chrome (Android): menú <b>⋮</b> → <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>. En iPhone (Safari): botón <b>Compartir</b> → <b>Agregar a inicio</b>. Se abrirá directo en Asistencia.
          </p>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">
        <a href="/" className="btn btn-ghost !min-h-11">
          <ExternalLink size={17} /> Ver la página pública
        </a>
        <button type="button" onClick={logout} className="btn btn-ghost !min-h-11 text-berry">
          <LogOut size={17} /> Cerrar sesión
        </button>
      </div>
    </div>
  )
}
