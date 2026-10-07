import { Camera, ImagePlus, ListChecks, Loader2, Phone, Plus, Search, Trash2, UserRound } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { formatDay, parseYMD, todayYMD } from '@/lib/dates'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/Modal'
import {
  closeStudent,
  openDayBilling,
  deleteStudent,
  fullName,
  newStudentDraft,
  openStudent,
  planOf,
  priceOf,
  saveStudent,
  setInscriptionStatus,
  uploadPhoto,
  useAdmin,
  type Student,
  type StudentDraft,
} from '../store'
import { useCan } from '@/lib/calendar'
import { ageOn, duesFor, money, nextBirthday, studentAge } from '../logic'
import { Avatar, PageHead, field, labelCls, preparePhoto } from '../ui'
import { Periods } from './Periods'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { PHONE_HINT, coMobileDigits } from '@/lib/phone'

type Filter = 'activos' | 'inactivos' | 'todos'

export function Students() {
  const students = useAdmin((s) => s.students)
  const plans = useAdmin((s) => s.plans)
  const payments = useAdmin((s) => s.payments)
  const canPay = useCan('pagos')
  const attendance = useAdmin((s) => s.attendance)
  const charges = useAdmin((s) => s.charges)
  const mode = useAdmin((s) => s.monthlyMode)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('activos')
  const today = todayYMD()

  // payment status of each student; the list goes: who owes (biggest debt first) → "cobra pronto" → al día
  const list = useMemo(() => {
    const term = q.trim().toLowerCase()
    return students
      .filter((s) => (filter === 'todos' || (filter === 'activos') === s.active) && (!term || fullName(s).toLowerCase().includes(term) || s.guardianName.toLowerCase().includes(term)))
      .map((s) => {
        const plan = planOf(s)
        const all = duesFor(s, plan, priceOf(s), payments, charges, attendance, today, s.monthlyMode ?? mode)
        // real debts only: unpaid days / extras, and monthly fees already due (not the upcoming one)
        const owed = all.filter((x) => x.kind !== 'mensual' || x.status === 'vencido' || x.status === 'hoy').reduce((n, x) => n + x.amount, 0)
        const due = all.find((x) => x.kind !== 'extra') ?? all[0]
        const rank = !plan || (!s.active && owed <= 0) ? 3 : owed > 0 ? 0 : due?.status === 'pronto' ? 1 : 2
        return { s, plan, owed, due, rank }
      })
      .sort((a, b) => a.rank - b.rank || b.owed - a.owed || fullName(a.s).localeCompare(fullName(b.s), 'es'))
  }, [students, q, filter, payments, charges, attendance, today, mode])

  return (
    <div className="space-y-6">
      <PageHead
        title="Estudiantes"
        sub={`${students.filter((s) => s.active).length} activos · ${students.length} en total`}
        actions={
          <button type="button" onClick={() => openStudent(newStudentDraft(today))} className="btn btn-gold !min-h-11">
            <Plus size={18} /> Nuevo estudiante
          </button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative min-w-0 sm:flex-1">
          <span className="sr-only">Buscar</span>
          <Search size={18} className="absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o acudiente" className={cn(field, 'pl-10')} />
        </label>
        <div role="group" aria-label="Filtro" className="grid grid-cols-3 rounded-lg border border-line bg-white p-1 sm:flex">
          {(['activos', 'inactivos', 'todos'] as Filter[]).map((f) => (
            <button key={f} type="button" aria-pressed={filter === f} onClick={() => setFilter(f)} className={cn('rounded-md px-3 py-2 text-sm font-semibold capitalize', filter === f ? 'bg-ink text-white' : 'text-muted hover:text-ink')}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {list.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map(({ s, plan, owed, due }) => {
            const tone = owed > 0 ? 'bg-[#fdf0ef] text-berry' : due?.status === 'pronto' ? 'bg-[#fff4e0] text-[#8a5716]' : 'bg-[#e9f4ee] text-leaf'
            const label = owed > 0 ? `Debe ${money(owed)}` : due?.status === 'pronto' ? 'Cobra pronto' : 'Al día'
            // inactive students only get a badge when they still owe something
            const badge = canPay && plan && (s.active || owed > 0) ? <span className={cn('inline-block rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap', tone)}>{label}</span> : null
            return (
              <li key={s.id} className="min-w-0">
                <button type="button" onClick={() => openStudent(s)} className={cn('card flex w-full min-w-0 items-center gap-3 p-4 text-left transition-shadow hover:shadow-[0_16px_36px_-24px_rgba(35,32,107,0.5)] sm:gap-4', !s.active && 'opacity-60')}>
                  <Avatar student={s} size={56} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-semibold text-ink">
                      {fullName(s)} {studentAge(s, today) != null && <span className="font-normal text-muted">· {studentAge(s, today)} años</span>}
                      {s.birthDate && nextBirthday(s.birthDate, today).date === today && <span title="¡Hoy cumple años!"> 🎂</span>}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {plan?.name ?? 'Sin plan'} · {money(priceOf(s))}
                    </p>
                    <p className="truncate text-sm text-muted">Ingresó el {formatDay(s.startDate, 'es')}</p>
                    {/* phones: the payment badge goes under the text so the card never gets wider than the screen */}
                    {badge && <div className="mt-1.5 sm:hidden">{badge}</div>}
                  </div>
                  {badge && <div className="hidden shrink-0 sm:block">{badge}</div>}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="card p-6 text-muted">{students.length ? 'No hay estudiantes con ese filtro.' : 'Aún no tienes estudiantes. Crea el primero con “Nuevo estudiante”.'}</p>
      )}
      {!plans.length && <p className="text-sm text-berry">Primero crea tus planes en Ajustes.</p>}
    </div>
  )
}

/* ───────────── Editor (modal, mounted once in the app) ───────────── */

export function StudentEditor() {
  const canPay = useCan('pagos')
  const editing = useAdmin((s) => s.editing)
  const globalMode = useAdmin((s) => s.monthlyMode)
  const plans = useAdmin((s) => s.plans)
  const students = useAdmin((s) => s.students)
  const [d, setD] = useState<(StudentDraft & { inscriptionId?: string }) | null>(editing)
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  useEffect(() => {
    setD(editing)
    setPhoto(null)
    setErrors([])
    setConfirmDel(false)
  }, [editing])

  if (!d) return null

  const up = (p: Partial<StudentDraft>) => setD((x) => (x ? { ...x, ...p } : x))
  const plan = plans.find((p) => p.id === d.planId)
  const existing = d.id ? students.find((s) => s.id === d.id) : undefined

  const pick = async (file?: File) => {
    if (!file) return
    try {
      const blob = await preparePhoto(file)
      setPhoto({ blob, url: URL.createObjectURL(blob) })
    } catch {
      setErrors((e) => [...e, 'photo'])
    }
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs: string[] = []
    if (d.firstName.trim().length < 2) errs.push('firstName')
    if (d.lastName.trim().length < 2) errs.push('lastName')
    if (!d.startDate) errs.push('startDate')
    if (!d.planId) errs.push('planId')
    if (d.guardianPhone && !coMobileDigits(d.guardianPhone)) errs.push('guardianPhone')
    setErrors(errs)
    if (errs.length) return
    setBusy(true)
    const { student, fields } = await saveStudent({ ...d, firstName: d.firstName.trim(), lastName: d.lastName.trim() })
    if (student && photo) await uploadPhoto(student.id, photo.blob)
    if (student && d.inscriptionId) await setInscriptionStatus(d.inscriptionId, 'atendido')
    setBusy(false)
    if (student) closeStudent()
    else if (fields) setErrors(fields)
  }

  const err = (f: string, msg: string) => errors.includes(f) && <p className="mt-1 text-sm font-medium text-berry">{msg}</p>
  const preview: Student | undefined = existing ?? (d.firstName ? ({ ...d, id: 'new', photo: 0 } as Student) : undefined)

  return (
    <Modal open onClose={closeStudent} label={d.id ? 'Editar estudiante' : 'Nuevo estudiante'} closeLabel="Cerrar">
      <form onSubmit={submit} noValidate className="p-6 sm:p-8">
        <h2 className="pr-12 text-[1.8rem]">{d.id ? 'Editar estudiante' : 'Nuevo estudiante'}</h2>

        {/* photo */}
        <div className="mt-5 flex items-center gap-4">
          {photo ? (
            <img src={photo.url} alt="Foto nueva" className="size-24 rounded-full object-cover" />
          ) : preview ? (
            <Avatar student={preview} size={96} />
          ) : (
            <span className="grid size-24 place-items-center rounded-full bg-paper text-muted">
              <UserRound size={36} />
            </span>
          )}
          <div className="flex flex-col gap-2">
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg bg-ink px-3 text-sm font-semibold text-white">
              <Camera size={17} /> Tomar foto
              <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
            <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-ink">
              <ImagePlus size={17} /> Elegir de la galería
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
            </label>
          </div>
        </div>
        {err('photo', 'No se pudo leer esa imagen.')}

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="st-first" className={labelCls}>
              Nombre <span className="text-berry">*</span>
            </label>
            <input id="st-first" className={field} value={d.firstName} onChange={(e) => up({ firstName: e.target.value })} autoComplete="off" />
            {err('firstName', 'Escribe el nombre.')}
          </div>
          <div>
            <label htmlFor="st-last" className={labelCls}>
              Apellidos <span className="text-berry">*</span>
            </label>
            <input id="st-last" className={field} value={d.lastName} onChange={(e) => up({ lastName: e.target.value })} autoComplete="off" />
            {err('lastName', 'Escribe los apellidos.')}
          </div>
          <div>
            <label htmlFor="st-birth" className={labelCls}>
              Fecha de nacimiento
            </label>
            <input id="st-birth" type="date" max={todayYMD()} className={field} value={d.birthDate ?? ''} onChange={(e) => up({ birthDate: e.target.value || null, ...(e.target.value ? { age: ageOn(e.target.value, todayYMD()) } : {}) })} />
            {err('birthDate', 'Revisa la fecha de nacimiento.')}
          </div>
          <div>
            <label htmlFor="st-age" className={labelCls}>
              Edad {d.birthDate && <span className="font-normal text-muted">(calculada)</span>}
            </label>
            <input
              id="st-age"
              type="number"
              inputMode="numeric"
              min={1}
              max={25}
              readOnly={Boolean(d.birthDate)}
              className={cn(field, d.birthDate && 'bg-paper')}
              value={d.birthDate ? ageOn(d.birthDate, todayYMD()) : (d.age ?? '')}
              onChange={(e) => up({ age: e.target.value === '' ? null : Number(e.target.value) })}
            />
            {err('age', 'Revisa la edad.')}
          </div>
          <div>
            <label htmlFor="st-start" className={labelCls}>
              {d.periods && d.periods.length > 1 ? 'Fecha de ingreso (periodo actual)' : 'Fecha de ingreso'} <span className="text-berry">*</span>
            </label>
            <input
              id="st-start"
              type="date"
              className={field}
              value={d.startDate}
              onChange={(e) => {
                const v = e.target.value
                const periods = d.periods?.length ? [...d.periods.slice(0, -1), { ...d.periods[d.periods.length - 1], start: v }] : d.periods
                up({ startDate: v, periods, ...(v && !d.id ? { billingDay: parseYMD(v).d } : {}) })
              }}
            />
            {err('startDate', 'Elige la fecha de ingreso.')}
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="st-plan" className={labelCls}>
              Plan <span className="text-berry">*</span>
            </label>
            <select id="st-plan" className={field} value={d.planId} onChange={(e) => up({ planId: e.target.value, price: null })}>
              {!plans.length && <option value="">Crea tus planes en Ajustes</option>}
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {money(p.price)}
                </option>
              ))}
            </select>
            {err('planId', 'Elige un plan.')}
          </div>
          <div>
            <label htmlFor="st-price" className={labelCls}>
              Valor a cobrar {plan?.type === 'dia' ? 'por día' : 'mensual'}
            </label>
            <input
              id="st-price"
              type="number"
              inputMode="numeric"
              min={0}
              step={1000}
              className={field}
              value={d.price ?? plan?.price ?? ''}
              onChange={(e) => up({ price: e.target.value === '' ? null : Number(e.target.value) })}
            />
            <p className="mt-1 text-xs text-muted">Por defecto, el precio del plan. Cámbialo si este estudiante tiene otro valor.</p>
          </div>
          {canPay && plan?.type === 'dia' && d.id && (
            <div className="flex items-end sm:col-span-1">
              <button type="button" onClick={() => openDayBilling(d.id!)} className="btn btn-ghost !min-h-[46px] w-full !text-[15px]">
                <ListChecks size={17} /> Ver días y pagos
              </button>
            </div>
          )}
          {plan?.type !== 'dia' && (
            <div>
              <label htmlFor="st-bday" className={labelCls}>
                Día de cobro (cada mes)
              </label>
              <input id="st-bday" type="number" inputMode="numeric" min={1} max={31} className={field} value={d.billingDay} onChange={(e) => up({ billingDay: Math.max(1, Math.min(31, Number(e.target.value) || 1)) })} />
              <p className="mt-1 text-xs text-muted">Por defecto, el mismo día en que ingresó.</p>
            </div>
          )}
          {plan?.type !== 'dia' && (
            <div className="sm:col-span-2">
              <label htmlFor="st-mode" className={labelCls}>
                Forma de cobro
              </label>
              <select id="st-mode" className={field} value={d.monthlyMode ?? ''} onChange={(e) => up({ monthlyMode: (e.target.value || null) as StudentDraft['monthlyMode'] })}>
                <option value="">Como en Ajustes ({globalMode === 'anticipado' ? 'por adelantado' : 'al cumplir el mes'})</option>
                <option value="vencido">Al cumplir el mes (ingresó el 18 → paga el 18 del mes siguiente)</option>
                <option value="anticipado">Por adelantado (paga el día que ingresa y luego cada mes)</option>
              </select>
            </div>
          )}

          <div>
            <label htmlFor="st-gname" className={labelCls}>
              Nombre del acudiente
            </label>
            <input id="st-gname" className={field} value={d.guardianName} onChange={(e) => up({ guardianName: e.target.value })} />
          </div>
          <div>
            <label htmlFor="st-gphone" className={labelCls}>
              Teléfono del acudiente
            </label>
            <PhoneInput id="st-gphone" value={d.guardianPhone} onChange={(v) => up({ guardianPhone: v })} invalid={errors.includes('guardianPhone')} />
            {err('guardianPhone', PHONE_HINT)}
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="st-auth" className={labelCls}>
              Autorizados para recoger
            </label>
            <input id="st-auth" className={field} value={d.authorized} onChange={(e) => up({ authorized: e.target.value })} placeholder="Ej.: Mamá Ana Pérez, abuela Rosa Díaz" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="st-notes" className={labelCls}>
              Notas
            </label>
            <textarea id="st-notes" rows={2} className={cn(field, 'resize-y')} value={d.notes} onChange={(e) => up({ notes: e.target.value })} placeholder="Alergias, grado escolar, observaciones…" />
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line p-4 sm:col-span-2">
            <input
              type="checkbox"
              checked={d.attendance ?? plan?.type === 'dia'}
              onChange={(e) => up({ attendance: e.target.checked })}
              className="mt-0.5 size-5 shrink-0 accent-[#3a36a8]"
            />
            <span>
              <span className="block font-semibold text-ink">Registrar asistencia</span>
              <span className="block text-sm text-muted">
                Sale en Asistencia para marcar si vino o no. Recomendado para plan por día (cada asistencia suma al cobro); para mensuales normalmente no hace falta.
              </span>
            </span>
          </label>
          <Periods d={d} onChange={up} />
        </div>

        {existing?.guardianPhone && (
          <a href={`tel:${existing.guardianPhone.replace(/[^\d+]/g, '')}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-royal">
            <Phone size={15} /> Llamar al acudiente
          </a>
        )}

        <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {d.id ? (
            confirmDel ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-berry">¿Eliminar a {fullName(d)}? Mejor márcalo inactivo si solo dejó de venir.</span>
                <button
                  type="button"
                  onClick={async () => {
                    await deleteStudent(d.id!)
                    closeStudent()
                  }}
                  className="rounded-md bg-berry px-3 py-1.5 font-semibold text-white"
                >
                  Sí, eliminar
                </button>
                <button type="button" onClick={() => setConfirmDel(false)} className="rounded-md border border-line px-3 py-1.5 font-medium">
                  Cancelar
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDel(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-berry">
                <Trash2 size={16} /> Eliminar estudiante
              </button>
            )
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" onClick={closeStudent} className="btn btn-ghost">
              Cancelar
            </button>
            <button type="submit" disabled={busy} className="btn btn-primary disabled:opacity-70">
              {busy && <Loader2 size={18} className="animate-spin" />} Guardar
            </button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
