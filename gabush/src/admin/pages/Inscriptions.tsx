import { ChevronDown, MessageCircle, Phone, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { formatDay, todayYMD } from '@/lib/dates'
import { useCan } from '@/lib/calendar'
import { cn } from '@/lib/utils'
import { deleteInscription, newStudentDraft, openStudent, setInscriptionStatus, useAdmin, type Inscription, type InscriptionStatus } from '../store'
import { guardianWhatsapp } from '../logic'
import { PageHead, field } from '../ui'

const STATUS: Record<InscriptionStatus, { label: string; cls: string }> = {
  pendiente: { label: 'Pendiente', cls: 'bg-[#fff4e0] text-[#8a5716]' },
  contactado: { label: 'Contactado', cls: 'bg-[#eeedfb] text-royal' },
  atendido: { label: 'Atendido', cls: 'bg-[#e9f4ee] text-leaf' },
}
type Filter = 'pendientes' | 'todas'

const when = (iso: string) => {
  const d = new Date(iso)
  return `${formatDay(iso.slice(0, 10), 'es', true)} · ${d.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}`
}

function Row({ it }: { it: Inscription }) {
  const [open, setOpen] = useState(it.status === 'pendiente')
  const [note, setNote] = useState(it.note)
  const [confirming, setConfirming] = useState(false)
  const canStudents = useCan('estudiantes')
  const wa = guardianWhatsapp(it.phone, `Hola ${it.parent.split(' ')[0]}, te saluda Gabush Kids. Recibimos la inscripción de ${it.child}. `)

  const toStudent = () => {
    const [firstName, ...rest] = it.child.trim().split(/\s+/)
    openStudent({
      ...newStudentDraft(todayYMD()),
      firstName: firstName ?? '',
      lastName: rest.join(' '),
      age: Number(it.age) || null,
      birthDate: it.birth || null,
      guardianName: it.parent,
      guardianPhone: it.phone,
      notes: [it.program && `Programa: ${it.program}`, it.message].filter(Boolean).join(' · ').slice(0, 300),
      inscriptionId: it.id,
    })
  }

  const fields: [string, string][] = [
    ['Edad', it.age ? `${it.age} años` : ''],
    ['Fecha de nacimiento', it.birth ? formatDay(it.birth, 'es') : ''],
    ['Género', it.gender],
    ['Dirección', it.address],
    ['Acudiente', it.parent],
    ['Teléfono', it.phone],
    ['Correo', it.email],
    ['Programa', it.program],
    ['Observaciones', it.message],
  ]

  return (
    <li className="card overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 p-4 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold text-ink">{it.child}</p>
          <p className="truncate text-sm text-muted first-letter:uppercase">{when(it.createdAt)}</p>
        </div>
        <span className={cn('shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold', STATUS[it.status].cls)}>{STATUS[it.status].label}</span>
        <ChevronDown size={18} className={cn('shrink-0 text-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-line p-4">
          <dl className="grid gap-x-6 gap-y-2 text-[15px] sm:grid-cols-2">
            {fields
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k} className={k === 'Observaciones' || k === 'Dirección' ? 'sm:col-span-2' : ''}>
                  <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{k}</dt>
                  <dd className="break-words text-ink">{v}</dd>
                </div>
              ))}
          </dl>

          <div className="mt-4 flex flex-wrap gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-whatsapp px-3 text-sm font-semibold text-[#06301a]">
                <MessageCircle size={16} /> WhatsApp
              </a>
            )}
            {it.phone && (
              <a href={`tel:${it.phone.replace(/[^\d+]/g, '')}`} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-ink">
                <Phone size={16} /> Llamar
              </a>
            )}
            {canStudents && <button type="button" onClick={toStudent} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-ink hover:border-ink">
              <UserPlus size={16} /> Crear estudiante
            </button>}
          </div>

          <label htmlFor={`note-${it.id}`} className="mt-4 mb-1.5 block text-sm font-semibold text-ink">
            Nota interna
          </label>
          <textarea id={`note-${it.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== it.note && setInscriptionStatus(it.id, it.status, note)} className={cn(field, 'resize-y')} placeholder="Ej.: llamé el martes, viene a conocer el jueves" />

          <div role="group" aria-label="Estado" className="mt-3 flex flex-wrap gap-2">
            {(Object.keys(STATUS) as InscriptionStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={it.status === s}
                onClick={() => setInscriptionStatus(it.id, s, note)}
                className={cn('rounded-lg border px-3 py-2 text-sm font-semibold', it.status === s ? 'border-ink bg-ink text-white' : 'border-line text-ink hover:border-ink')}
              >
                {STATUS[s].label}
              </button>
            ))}
          </div>

          {/* delete (e.g. test submissions) — always asks first */}
          <div className="mt-4 border-t border-line pt-3">
            {confirming ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-berry">¿Eliminar la inscripción de {it.child}? No se puede deshacer.</span>
                <button type="button" onClick={() => deleteInscription(it.id)} className="rounded-md bg-berry px-3 py-1.5 font-semibold text-white">
                  Sí, eliminar
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="rounded-md border border-line px-3 py-1.5 font-medium text-ink">
                  Cancelar
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirming(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-berry">
                <Trash2 size={15} /> Eliminar inscripción
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  )
}

export function Inscriptions() {
  const items = useAdmin((s) => s.inscriptions)
  const [filter, setFilter] = useState<Filter>('pendientes')
  const pending = items.filter((i) => i.status === 'pendiente')
  const list = filter === 'pendientes' ? pending : items
  return (
    <div className="space-y-6">
      <PageHead
        title="Inscripciones"
        sub="Formularios enviados desde la página. Quedan en el histórico; puedes eliminar las de prueba."
        actions={
          <div role="group" className="flex rounded-lg border border-line bg-white p-1">
            {(['pendientes', 'todas'] as Filter[]).map((f) => (
              <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={cn('rounded-md px-3 py-1.5 text-sm font-semibold capitalize', filter === f ? 'bg-ink text-white' : 'text-muted hover:text-ink')}>
                {f} ({f === 'pendientes' ? pending.length : items.length})
              </button>
            ))}
          </div>
        }
      />
      {list.length ? (
        <ul className="space-y-3">
          {list.map((it) => (
            <Row key={it.id} it={it} />
          ))}
        </ul>
      ) : (
        <p className="card p-6 text-muted">{filter === 'pendientes' ? 'No tienes inscripciones pendientes. 🎉' : 'Aún no ha llegado ninguna inscripción.'}</p>
      )}
    </div>
  )
}
