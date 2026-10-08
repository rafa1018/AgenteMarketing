import { Mail, MapPin, Pencil, Phone, Plus, Star, Trash2, Wallet } from 'lucide-react'
import { useState } from 'react'
import { can } from '@/lib/calendar'
import { Modal } from '@/components/ui/Modal'
import { useMutation } from '@/shared/useQuery'
import { toast } from '../../store'
import { ConfirmModal } from '../../ui'
import { api2 } from '../../v2/api'
import { Badge, ErrorBox } from '../../v2/kit'
import { GuardianForm, emptyGuardian, type GuardianFormValue } from './GuardianForm'
import { openStudent } from './openStudent'
import type { Guardian, StudentDetail } from './types'

/** Family group: guardians (contact, who pays), siblings in the school. */
export function FamilyTab({ detail, onChanged }: { detail: StudentDetail; onChanged: () => void }) {
  const [editing, setEditing] = useState<{ id: number | null; value: GuardianFormValue } | null>(null)
  const [removing, setRemoving] = useState<Guardian | null>(null)
  const m = useMutation()
  const editable = can('estudiantes') || can('matriculas')
  const familyId = detail.family?.id

  const save = async () => {
    if (!editing) return
    const r = await m.run(() => (editing.id ? api2.put(`/guardians/${editing.id}`, editing.value) : api2.post(`/families/${familyId}/guardians`, editing.value)))
    if (r) {
      toast('Acudiente guardado')
      setEditing(null)
      onChanged()
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[15px] text-muted">{detail.family?.name ?? 'Sin grupo familiar'}</p>
        {editable && familyId && (
          <button type="button" onClick={() => setEditing({ id: null, value: emptyGuardian('Acudiente') })} className="btn btn-ghost !min-h-10 !px-4 !text-sm">
            <Plus size={16} /> Acudiente
          </button>
        )}
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {detail.guardians.map((g) => (
          <li key={g.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-ink">{g.name}</p>
                <p className="text-sm text-muted">
                  {g.relationship}
                  {g.docNumber && ` · ${g.docType ?? ''} ${g.docNumber}`}
                </p>
              </div>
              {editable && (
                <div className="flex gap-1">
                  <button type="button" aria-label="Editar" onClick={() => setEditing({ id: g.id, value: { name: g.name, relationship: g.relationship, docType: g.docType ?? 'CC', docNumber: g.docNumber ?? '', phone: g.phone ?? '', phone2: g.phone2 ?? '', email: g.email ?? '', address: g.address ?? '', occupation: g.occupation ?? '', isPrimary: Boolean(g.isPrimary), isBilling: Boolean(g.isBilling) } })} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink">
                    <Pencil size={16} />
                  </button>
                  <button type="button" aria-label="Quitar" onClick={() => setRemoving(g)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-[#fdf0ef] hover:text-berry">
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {g.isPrimary > 0 && (
                <Badge tone="violet">
                  <Star size={12} /> Principal
                </Badge>
              )}
              {g.isBilling > 0 && (
                <Badge tone="green">
                  <Wallet size={12} /> Paga
                </Badge>
              )}
            </div>
            <div className="mt-2 space-y-1 text-[14px]">
              {g.phone && (
                <a href={`https://wa.me/57${g.phone.replace(/\D/g, '').slice(-10)}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-text hover:text-royal">
                  <Phone size={14} className="text-muted" /> {g.phone}
                  {g.phone2 && ` · ${g.phone2}`}
                </a>
              )}
              {g.email && (
                <a href={`mailto:${g.email}`} className="flex items-center gap-2 break-all text-text hover:text-royal">
                  <Mail size={14} className="shrink-0 text-muted" /> {g.email}
                </a>
              )}
              {g.address && (
                <p className="flex items-center gap-2 text-text">
                  <MapPin size={14} className="shrink-0 text-muted" /> {g.address}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {detail.siblings.length > 0 && (
        <div className="card p-4">
          <p className="mb-2 font-semibold text-ink">Hermanos en el jardín</p>
          <ul className="flex flex-wrap gap-2">
            {detail.siblings.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => openStudent(b.id)} className="rounded-full bg-paper px-3 py-1.5 text-sm font-semibold text-royal hover:bg-[#eeedfb]">
                  {b.firstName} {b.lastName} {b.course && <span className="text-muted">· {b.course}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} label="Acudiente" closeLabel="Cerrar">
        {editing && (
          <div className="space-y-4 p-5 sm:p-7">
            <h2 className="text-[1.5rem]">{editing.id ? 'Editar acudiente' : 'Nuevo acudiente'}</h2>
            <GuardianForm value={editing.value} onChange={(v) => setEditing({ ...editing, value: v })} errors={m.fields} />
            {m.message && <ErrorBox message={m.message} />}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(null)} className="btn btn-ghost">
                Cancelar
              </button>
              <button type="button" disabled={m.busy} onClick={save} className="btn btn-primary">
                Guardar
              </button>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmModal
        open={Boolean(removing)}
        title={`¿Quitar a ${removing?.name}?`}
        confirmLabel="Sí, quitar"
        tone="danger"
        icon={<Trash2 size={24} />}
        onClose={() => setRemoving(null)}
        onConfirm={async () => {
          try {
            await api2.del(`/guardians/${removing!.id}`)
            toast('Acudiente quitado')
            onChanged()
          } catch (e) {
            toast(e instanceof Error ? e.message : 'No se pudo quitar')
          }
        }}
      >
        Deja de aparecer en la familia (los hermanos también lo pierden).
      </ConfirmModal>
    </div>
  )
}
