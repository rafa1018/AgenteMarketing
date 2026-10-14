import { CalendarClock, ClipboardCheck, FileWarning, GraduationCap, HandCoins, MessageSquarePlus, UserPlus, Users, Wallet } from 'lucide-react'
import { can, useCalendar } from '@/lib/calendar'
import { useQuery } from '@/shared/useQuery'
import { money } from '@/shared/format'
import { PageHead } from '../../ui'
import { api2, qs, useSetup } from '../../v2/api'
import { Spinner, Stat } from '../../v2/kit'
import type { StudentRow } from '../students/types'

/** Dashboard: the numbers of the working year and shortcuts to the daily tasks. */
export function HomeV2() {
  const name = useCalendar((s) => s.name)
  const { setup, year } = useSetup()
  const students = useQuery(year ? `home-st:${year}` : null, () => api2.get<{ students: StudentRow[] }>('/students' + qs({ year })))
  const billing = useQuery(year && can('pagos') ? `home-bill:${year}` : null, () => api2.get<{ pending: number; overdue: number; debtors: number; pendingActive: number; debtorsActive: number; collected: { month: string; amount: number }[]; today: { amount: number; n: number } }>('/billing/overview' + qs({ year })))
  const rows = students.data?.students ?? []
  const active = rows.filter((s) => s.status === 'activo').length
  const pre = rows.filter((s) => s.status === 'prematricula').length
  const docs = rows.filter((s) => s.docsPending > 0 && s.status !== 'retirado').length
  const month = new Date().toISOString().slice(0, 7)
  const collectedMonth = billing.data?.collected.find((c) => c.month === month)?.amount ?? 0
  const capacity = setup?.courses.reduce((a, c) => a + c.capacity, 0) ?? 0
  const hello = new Date().getHours() < 12 ? 'Buenos días' : new Date().getHours() < 19 ? 'Buenas tardes' : 'Buenas noches'

  const shortcuts = [
    { href: '#/asistencia', label: 'Tomar asistencia', icon: ClipboardCheck, perm: 'asistencia' },
    { href: '#/cartera?tab=deudores', label: 'Ver deudores', icon: Wallet, perm: 'pagos' },
    { href: '#/estudiantes', label: 'Registrar estudiante', icon: UserPlus, perm: 'estudiantes' },
    { href: '#/calificaciones', label: 'Calificar', icon: GraduationCap, perm: 'calificaciones' },
    { href: '#/mensajes', label: 'Enviar mensaje', icon: MessageSquarePlus, perm: 'mensajes' },
    { href: '#/matriculas?tab=documentos', label: 'Documentos pendientes', icon: FileWarning, perm: 'matriculas' },
  ] as const

  return (
    <div className="space-y-6">
      <PageHead title={`${hello}${name ? `, ${name.split(' ')[0]}` : ''}`} sub={`Año académico ${year ?? ''}`} />
      {students.loading && !students.data ? (
        <Spinner />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Estudiantes activos" value={active} hint={`${pre ? `${pre} en prematrícula · ` : ''}${Math.max(0, capacity - active - pre)} cupos libres`} icon={<Users size={18} />} />
          {can('pagos') && <Stat label="Recaudado este mes" value={money(collectedMonth)} hint={billing.data ? `hoy ${money(billing.data.today.amount)}` : undefined} tone="green" icon={<HandCoins size={18} />} />}
          {can('pagos') && (
            // what the current families owe is the day-to-day figure; old debts of withdrawn / former students apart
            <Stat
              label="Por cobrar (activos)"
              value={money(billing.data?.pendingActive ?? 0)}
              hint={
                billing.data
                  ? `${billing.data.debtorsActive} ${billing.data.debtorsActive === 1 ? 'familia' : 'familias'}${billing.data.pending > billing.data.pendingActive ? ` · retirados y antiguos: ${money(billing.data.pending - billing.data.pendingActive)} (${billing.data.debtors - billing.data.debtorsActive})` : ''}`
                  : undefined
              }
              tone="red"
              icon={<Wallet size={18} />}
            />
          )}
          <Stat label="Documentos pendientes" value={docs} hint="estudiantes con documentos por entregar" tone={docs ? 'pink' : 'ink'} icon={<FileWarning size={18} />} />
        </div>
      )}
      <section>
        <h2 className="mb-3 text-xl">Accesos rápidos</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {shortcuts
            .filter((s) => can(s.perm))
            .map((s) => (
              <li key={s.href}>
                <a href={s.href} className="card flex items-center gap-3 p-4 font-semibold text-ink transition-shadow hover:shadow-md">
                  <span className="grid size-10 place-items-center rounded-xl bg-paper text-royal">
                    <s.icon size={19} />
                  </span>
                  {s.label}
                </a>
              </li>
            ))}
        </ul>
      </section>
      {setup && (
        <section className="card p-4 sm:p-5">
          <h2 className="flex items-center gap-2 text-lg">
            <CalendarClock size={19} className="text-pink" /> Periodos {year}
          </h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-4">
            {setup.periods.map((p) => (
              <li key={p.id} className="rounded-xl bg-paper px-3 py-2">
                <p className="font-semibold text-ink">{p.name}</p>
                <p className="text-[13px] text-muted">{p.published ? 'Boletín publicado' : p.gradingOpen ? 'Calificando' : 'Cerrado'}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
