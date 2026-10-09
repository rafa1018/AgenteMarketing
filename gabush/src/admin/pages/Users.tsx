import { Check, Eye, EyeOff, KeyRound, Loader2, Pencil, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import type { Perm } from '@/lib/calendar'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import { api, toast } from '../store'
import { api2 } from '../v2/api'
import { ConfirmModal, PageHead, field, labelCls } from '../ui'
import { PERMS, ROLES, roleColor, roleLabel, roleOf, type Role } from '../roles'

interface StaffUser {
  id: string
  name: string
  user: string
  role: string
  perms: Perm[]
  active: boolean
  lastLogin?: string | null
  owner?: boolean
}
type Draft = Omit<StaffUser, 'id' | 'lastLogin' | 'owner'> & { id?: string; password: string }

const ERRORS: Record<string, string> = {
  name: 'Escribe el nombre (mínimo 2 letras).',
  user: 'Usuario inválido: 3 a 60 letras, números o . _ @ - (sin espacios).',
  taken: 'Ese usuario ya existe. Elige otro.',
  password: 'La contraseña debe tener al menos 8 caracteres.',
  self: 'No puedes quitarte a ti misma el acceso a Usuarios ni desactivarte.',
}

function newDraft(role: Role = 'docente'): Draft {
  return { name: '', user: '', role, perms: [...(roleOf(role)?.perms ?? [])], active: true, password: '' }
}

/** Readable random password (no confusing characters). */
function suggestPassword() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789'
  const arr = crypto.getRandomValues(new Uint32Array(10))
  return 'Gb-' + [...arr].map((n) => abc[n % abc.length]).join('')
}

/** A person of the Personal tab (teachers, staff) that a panel user can be linked to. */
type Person = { id: number; name: string; position: string | null; userId: string | null; directs: string | null; active: number }

function UserEditor({ draft, people, onClose, onSaved }: { draft: Draft | null; people: Person[]; onClose: () => void; onSaved: (u: StaffUser) => void }) {
  const [d, setD] = useState<Draft | null>(draft)
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [show, setShow] = useState(false)
  const [staffId, setStaffId] = useState<number | ''>('')
  useEffect(() => {
    setD(draft)
    setErrors([])
    setShow(false)
    setStaffId(people.find((p) => draft?.id && p.userId === draft.id)?.id ?? '')
  }, [draft, people])
  if (!d) return null
  const up = (p: Partial<Draft>) => setD((x) => (x ? { ...x, ...p } : x))

  const pickRole = (role: Role) => up({ role, perms: role === 'personalizado' ? d.perms : [...(roleOf(role)?.perms ?? [])] })
  const toggle = (p: Perm) => {
    const perms = d.perms.includes(p) ? d.perms.filter((x) => x !== p) : [...d.perms, p]
    // a role whose permissions were changed by hand becomes "Personalizado"
    const preset = roleOf(d.role)
    const same = preset && preset.id !== 'personalizado' && preset.perms.length === perms.length && preset.perms.every((x) => perms.includes(x))
    up({ perms, role: same ? d.role : 'personalizado' })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const { status, data } = await api.post('users.php', { action: 'save', user: { ...d, name: d.name.trim(), user: d.user.trim().toLowerCase() } })
    if (data?.ok) {
      // link (or unlink) the person of the Personal tab: that is what limits a teacher to her courses
      const was = people.find((p) => p.userId === data.user.id)?.id ?? ''
      if (was !== staffId) await api2.post('/staff/link-user', { userId: data.user.id, staffId: staffId || null }).catch(() => toast('El usuario se guardó, pero no se pudo vincular a la ficha de personal.'))
    }
    setBusy(false)
    if (data?.ok) {
      onSaved(data.user)
      toast(d.id ? 'Usuario actualizado' : 'Usuario creado')
    } else if (status === 422) setErrors(data?.fields ?? ['name'])
    else toast('No se pudo guardar. Intenta de nuevo.')
  }

  return (
    <Modal open={Boolean(draft)} onClose={onClose} label={d.id ? 'Editar usuario' : 'Nuevo usuario'} closeLabel="Cerrar" className="w-full max-w-2xl">
      <form onSubmit={submit} noValidate className="p-6 sm:p-8">
        <h2 className="pr-10 text-[1.8rem]">{d.id ? 'Editar usuario' : 'Nuevo usuario'}</h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="us-name" className={labelCls}>
              Nombre <span className="text-berry">*</span>
            </label>
            <input id="us-name" className={field} value={d.name} maxLength={80} onChange={(e) => up({ name: e.target.value })} placeholder="Ej.: Profe Laura" />
          </div>
          <div>
            <label htmlFor="us-user" className={labelCls}>
              Usuario para ingresar <span className="text-berry">*</span>
            </label>
            <input id="us-user" className={field} value={d.user} maxLength={60} autoCapitalize="none" spellCheck={false} onChange={(e) => up({ user: e.target.value.replace(/\s/g, '') })} placeholder="laura" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="us-pass" className={labelCls}>
              {d.id ? 'Nueva contraseña' : 'Contraseña'} {d.id ? <span className="font-normal text-muted">(déjala vacía para no cambiarla)</span> : <span className="text-berry">*</span>}
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input id="us-pass" type={show ? 'text' : 'password'} autoComplete="new-password" className={cn(field, 'pr-12')} value={d.password} onChange={(e) => up({ password: e.target.value })} />
                <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar' : 'Mostrar'} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  up({ password: suggestPassword() })
                  setShow(true)
                }}
                className="btn btn-ghost !min-h-[46px] shrink-0 !px-3 !text-sm"
              >
                <KeyRound size={16} /> Generar
              </button>
            </div>
            <p className="mt-1 text-xs text-muted">Compártela con la persona por un medio privado. Después no se puede ver, solo cambiar.</p>
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="us-staff" className={labelCls}>
              Ficha de personal {d.role === 'docente' && <span className="text-berry">*</span>}
            </label>
            <select id="us-staff" className={field} value={staffId} onChange={(e) => setStaffId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— Sin vincular —</option>
              {people
                .filter((p) => p.active || p.id === staffId)
                .map((p) => (
                  <option key={p.id} value={p.id} disabled={Boolean(p.userId && p.userId !== d.id)}>
                    {p.name}
                    {p.directs ? ` · Directora de ${p.directs}` : ''}
                    {p.userId && p.userId !== d.id ? ' (ya tiene usuario)' : ''}
                  </option>
                ))}
            </select>
            <p className="mt-1 text-xs text-muted">
              {d.role === 'docente'
                ? 'En Calificaciones solo verá los cursos donde esta persona es director(a) de grupo o tiene materias, y solo califica las materias asignadas a ella. Sin ficha no verá ningún curso.'
                : 'Opcional para este rol. La rectora ve todos los cursos.'}
            </p>
          </div>
        </div>

        <p className={cn(labelCls, 'mt-6')}>Rol</p>
        <div className="grid gap-2 sm:grid-cols-4">
          {ROLES.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={d.role === r.id}
              onClick={() => pickRole(r.id)}
              className={cn('rounded-2xl border-2 p-3 text-left transition-colors', d.role === r.id ? 'bg-paper' : 'border-line hover:border-muted/50')}
              style={d.role === r.id ? { borderColor: r.color } : undefined}
            >
              <span className="flex items-center gap-2 font-serif font-semibold text-ink">
                <span className="size-3 shrink-0 rounded-full" style={{ background: r.color }} />
                {r.label}
              </span>
              <span className="mt-0.5 block text-xs leading-snug text-muted">{r.detail}</span>
            </button>
          ))}
        </div>

        <p className={cn(labelCls, 'mt-6')}>Qué puede hacer</p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {PERMS.map((p) => {
            const on = d.perms.includes(p.id)
            return (
              <li key={p.id}>
                <label className={cn('flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-3 transition-colors', on ? 'border-royal/40 bg-[#eeedfb]' : 'border-line')}>
                  <input type="checkbox" checked={on} onChange={() => toggle(p.id)} className="sr-only" />
                  <span className={cn('mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border-2', on ? 'border-royal bg-royal text-white' : 'border-muted/40')}>{on && <Check size={13} strokeWidth={3.5} />}</span>
                  <span>
                    <span className="block font-semibold text-ink">{p.label}</span>
                    <span className="block text-xs leading-snug text-muted">{p.detail}</span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>

        <label className="mt-5 flex items-center gap-3 font-semibold text-ink">
          <input type="checkbox" checked={d.active} onChange={(e) => up({ active: e.target.checked })} className="size-5 accent-[#3a36a8]" />
          Activo (puede ingresar)
        </label>

        {errors.length > 0 && (
          <ul role="alert" className="mt-4 space-y-1 rounded-xl bg-[#fdf0ef] px-4 py-3 text-sm font-medium text-berry">
            {errors.map((e) => (
              <li key={e}>{ERRORS[e] ?? 'Revisa los datos.'}</li>
            ))}
          </ul>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancelar
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-70">
            {busy ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />} Guardar usuario
          </button>
        </div>
      </form>
    </Modal>
  )
}

export function UsersPage() {
  const [users, setUsers] = useState<StaffUser[] | null>(null)
  const [me, setMe] = useState('')
  const [editing, setEditing] = useState<Draft | null>(null)
  const [deleting, setDeleting] = useState<StaffUser | null>(null)
  const [people, setPeople] = useState<Person[]>([])
  const loadPeople = () =>
    api2
      .get<{ staff: Person[] }>('/staff?status=todos')
      .then((r) => setPeople(r.staff))
      .catch(() => setPeople([]))

  useEffect(() => {
    api.get('users.php').then(({ data }) => {
      setUsers(data?.ok ? data.users : [])
      setMe(data?.me ?? '')
    })
    loadPeople()
  }, [])

  const remove = async (u: StaffUser) => {
    const { data } = await api.post('users.php', { action: 'delete', id: u.id })
    if (data?.ok) {
      setUsers((xs) => xs?.filter((x) => x.id !== u.id) ?? null)
      toast('Usuario eliminado')
    } else toast('No se pudo eliminar.')
  }

  return (
    <div>
      <PageHead
        title="Usuarios y permisos"
        sub="Crea un usuario para cada persona del equipo y decide qué puede hacer. Los cambios aplican de inmediato."
        actions={
          <button type="button" onClick={() => setEditing(newDraft())} className="btn btn-primary">
            <UserPlus size={18} /> Nuevo usuario
          </button>
        }
      />

      {users === null ? (
        <p className="mt-8 flex items-center gap-2 text-muted">
          <Loader2 size={18} className="animate-spin" /> Cargando…
        </p>
      ) : (
        <ul className="mt-8 grid gap-4 md:grid-cols-2">
          {users.map((u) => (
            <li key={u.id} className={cn('card p-5', !u.active && 'opacity-60')}>
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl font-serif text-lg font-semibold text-white" style={{ background: roleColor(u.role) }}>
                  {u.name.trim().slice(0, 1).toUpperCase() || '?'}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-serif text-lg font-semibold text-ink">
                    {u.name} {u.id === me && <span className="text-sm font-normal text-muted">(tú)</span>}
                  </p>
                  <p className="truncate text-sm text-muted">
                    @{u.user} · <span style={{ color: roleColor(u.role) }} className="font-bold">{roleLabel(u.role)}</span>
                    {!u.active && ' · inactivo'}
                  </p>
                  {(() => {
                    const p = people.find((x) => x.userId === u.id)
                    if (p) return <p className="truncate text-[13px] text-muted">Ficha: {p.name}{p.directs ? ` · Directora de ${p.directs}` : ''}</p>
                    return u.role === 'docente' ? <p className="text-[13px] font-semibold text-berry">Sin ficha de personal: no verá cursos en Calificaciones</p> : null
                  })()}
                </div>
                {u.owner ? (
                  <span title="Definido en el servidor (config.php); siempre tiene todos los permisos." className="grid size-9 place-items-center rounded-lg text-muted">
                    <ShieldCheck size={18} />
                  </span>
                ) : (
                  <span className="flex gap-1">
                    <button type="button" title="Editar" onClick={() => setEditing({ ...u, password: '' })} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink">
                      <Pencil size={17} />
                    </button>
                    {u.id !== me && (
                      <button type="button" title="Eliminar" onClick={() => setDeleting(u)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-[#fdf0ef] hover:text-berry">
                        <Trash2 size={17} />
                      </button>
                    )}
                  </span>
                )}
              </div>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {PERMS.filter((p) => u.perms.includes(p.id)).map((p) => (
                  <li key={p.id} className="rounded-full bg-paper px-2.5 py-1 text-xs font-bold text-ink">
                    {p.label}
                  </li>
                ))}
                {!u.perms.length && <li className="text-sm text-muted">Sin permisos</li>}
              </ul>
              {u.lastLogin && <p className="mt-3 text-xs text-muted">Último ingreso: {new Date(u.lastLogin).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
            </li>
          ))}
        </ul>
      )}

      <UserEditor
        draft={editing}
        people={people}
        onClose={() => setEditing(null)}
        onSaved={(u) => {
          setUsers((xs) => (xs?.some((x) => x.id === u.id) ? xs.map((x) => (x.id === u.id ? u : x)) : [...(xs ?? []), u]))
          setEditing(null)
          loadPeople()
        }}
      />
      <ConfirmModal
        open={Boolean(deleting)}
        title={`¿Eliminar a ${deleting?.name ?? ''}?`}
        confirmLabel="Sí, eliminar"
        tone="danger"
        icon={<Trash2 size={24} />}
        onConfirm={async () => {
          if (deleting) await remove(deleting)
        }}
        onClose={() => setDeleting(null)}
      >
        Ya no podrá ingresar al panel. Si es temporal, mejor desactívalo.
      </ConfirmModal>
    </div>
  )
}
