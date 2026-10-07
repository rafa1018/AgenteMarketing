import { Download, ExternalLink, HardDriveDownload, LogOut, Plus, Save, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { logout, newDraft, openEditor } from '@/lib/calendar'
import { todayYMD } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { Calendar } from '@/components/sections/Calendar'
import { AdminSettings } from '@/components/admin/AdminSettings'
import { EventList } from '@/components/admin/AdminUI'
import { saveMonthlyMode, savePlans, useAdmin, type Plan } from '../store'
import { money } from '../logic'
import { Card, PageHead, field } from '../ui'
import { ReminderTemplateCard } from './Reminder'

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
  const plans = useAdmin((s) => s.plans)
  const monthlyMode = useAdmin((s) => s.monthlyMode)
  const [draft, setDraft] = useState<Plan[]>(plans)
  const [busy, setBusy] = useState(false)
  const [canInstall, setCanInstall] = useState(Boolean(deferred))
  useEffect(() => setDraft(plans), [plans])
  useEffect(() => {
    const on = () => setCanInstall(true)
    window.addEventListener('beforeinstallprompt', on)
    return () => window.removeEventListener('beforeinstallprompt', on)
  }, [])

  const up = (i: number, p: Partial<Plan>) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const dirty = JSON.stringify(draft) !== JSON.stringify(plans)
  const standalone = window.matchMedia('(display-mode: standalone)').matches

  return (
    <div className="space-y-6">
      <PageHead title="Ajustes" />

      <Card>
        <h2 className="text-xl">Planes y precios</h2>
        <p className="mt-1 text-[15px] text-muted">El precio del plan se usa por defecto; en cada estudiante puedes poner otro valor.</p>
        <ul className="mt-4 space-y-3">
          {draft.map((p, i) => (
            <li key={p.id} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[1.6fr_1fr_1fr_1fr_auto] sm:items-center">
              <input aria-label="Nombre del plan" className={field} value={p.name} onChange={(e) => up(i, { name: e.target.value })} />
              <select aria-label="Tipo" className={field} value={p.type} onChange={(e) => up(i, { type: e.target.value as Plan['type'] })}>
                <option value="mensual">Mensual</option>
                <option value="dia">Por día</option>
              </select>
              <select aria-label="Jornada" className={field} value={p.shift} onChange={(e) => up(i, { shift: e.target.value as Plan['shift'] })}>
                <option value="manana">Mañana</option>
                <option value="tarde">Tarde</option>
              </select>
              <input aria-label="Precio" type="number" inputMode="numeric" min={0} step={1000} className={field} value={p.price} onChange={(e) => up(i, { price: Number(e.target.value) || 0 })} />
              <button type="button" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} aria-label={`Quitar ${p.name}`} className="grid size-11 place-items-center rounded-lg text-muted hover:bg-paper hover:text-berry">
                <Trash2 size={17} />
              </button>
              <p className="text-xs text-muted sm:col-span-5">
                {money(p.price)} {p.type === 'mensual' ? 'al mes' : 'por día asistido'}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDraft((d) => [...d, { id: `plan-${Date.now().toString(36)}`, name: 'Nuevo plan', type: 'mensual', shift: 'manana', price: 0 }])}
            className="btn btn-ghost !min-h-11"
          >
            <Plus size={17} /> Agregar plan
          </button>
          <button
            type="button"
            disabled={!dirty || busy || !draft.length}
            onClick={async () => {
              setBusy(true)
              await savePlans(draft)
              setBusy(false)
            }}
            className={cn('btn btn-primary !min-h-11', (!dirty || !draft.length) && 'opacity-50')}
          >
            <Save size={17} /> Guardar planes
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl">¿Cuándo se cobra la mensualidad?</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(
            [
              ['vencido', 'Al cumplir cada mes', 'Ingresó el 18 de septiembre → paga el 18 de octubre, el 18 de noviembre…'],
              ['anticipado', 'Por adelantado', 'Paga el día que ingresa (18 de septiembre) y después cada 18 de mes.'],
            ] as const
          ).map(([id, title, detail]) => (
            <label key={id} className={cn('flex cursor-pointer gap-3 rounded-xl border p-4', monthlyMode === id ? 'border-ink bg-[#eeedfb]' : 'border-line')}>
              <input type="radio" name="monthly-mode" checked={monthlyMode === id} onChange={() => saveMonthlyMode(id)} className="mt-1 size-4 accent-[#3a36a8]" />
              <span>
                <span className="block font-semibold text-ink">{title}</span>
                <span className="block text-sm text-muted">{detail}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">Los planes por día no cambian: se cobran según los días asistidos.</p>
      </Card>

      <ReminderTemplateCard />

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
