import { Field, inputCls } from '../../v2/kit'
import { BLOOD, DOC_TYPES } from './types'

export type StudentFormValue = {
  firstName: string
  middleName: string
  lastName: string
  secondLastName: string
  birthDate: string
  birthCity: string
  gender: string
  docType: string
  docNumber: string
  eps: string
  bloodType: string
  religion: string
  email: string
  allergies: string
  authorizedPickup: string
  notes: string
}

export const emptyStudent = (): StudentFormValue => ({ firstName: '', middleName: '', lastName: '', secondLastName: '', birthDate: '', birthCity: 'Valledupar (Cesar)', gender: '', docType: 'Registro Civil', docNumber: '', eps: '', bloodType: '', religion: '', email: '', allergies: '', authorizedPickup: '', notes: '' })

export const studentToForm = (s: Partial<Record<keyof StudentFormValue, string | null>>): StudentFormValue => {
  const base = emptyStudent()
  for (const k of Object.keys(base) as (keyof StudentFormValue)[]) base[k] = (s[k] ?? '') as string
  return base
}

/** Personal data of a student (same fields Cerkademia had, plus allergies and who can pick them up). */
export function StudentForm({ value, onChange, errors = {} }: { value: StudentFormValue; onChange: (v: StudentFormValue) => void; errors?: Record<string, string> }) {
  const set = (k: keyof StudentFormValue) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value })
  return (
    <div className="grid gap-3.5 sm:grid-cols-2">
      <Field label="Primer nombre *" error={errors.firstName}>
        <input value={value.firstName} onChange={set('firstName')} className={inputCls(errors.firstName)} autoComplete="off" />
      </Field>
      <Field label="Segundo nombre" error={errors.middleName}>
        <input value={value.middleName} onChange={set('middleName')} className={inputCls()} autoComplete="off" />
      </Field>
      <Field label="Primer apellido *" error={errors.lastName}>
        <input value={value.lastName} onChange={set('lastName')} className={inputCls(errors.lastName)} autoComplete="off" />
      </Field>
      <Field label="Segundo apellido">
        <input value={value.secondLastName} onChange={set('secondLastName')} className={inputCls()} autoComplete="off" />
      </Field>
      <Field label="Fecha de nacimiento" error={errors.birthDate}>
        <input type="date" value={value.birthDate} onChange={set('birthDate')} className={inputCls(errors.birthDate)} />
      </Field>
      <Field label="Ciudad de nacimiento">
        <input value={value.birthCity} onChange={set('birthCity')} className={inputCls()} />
      </Field>
      <Field label="Tipo de documento">
        <select value={value.docType} onChange={set('docType')} className={inputCls()}>
          <option value="">—</option>
          {DOC_TYPES.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </Field>
      <Field label="No. de documento" error={errors.docNumber}>
        <input value={value.docNumber} onChange={set('docNumber')} inputMode="numeric" className={inputCls(errors.docNumber)} />
      </Field>
      <Field label="Género">
        <div className="flex gap-2">
          {[
            ['F', 'Niña'],
            ['M', 'Niño'],
          ].map(([v, l]) => (
            <button key={v} type="button" onClick={() => onChange({ ...value, gender: value.gender === v ? '' : v })} className={`btn flex-1 ${value.gender === v ? 'btn-primary' : 'btn-ghost'}`}>
              {l}
            </button>
          ))}
        </div>
      </Field>
      <Field label="EPS">
        <input value={value.eps} onChange={set('eps')} className={inputCls()} />
      </Field>
      <Field label="Tipo de sangre (RH)">
        <select value={value.bloodType} onChange={set('bloodType')} className={inputCls()}>
          <option value="">—</option>
          {BLOOD.map((b) => (
            <option key={b}>{b}</option>
          ))}
        </select>
      </Field>
      <Field label="Religión">
        <input value={value.religion} onChange={set('religion')} className={inputCls()} />
      </Field>
      <Field label="Correo del estudiante (opcional)" error={errors.email} className="sm:col-span-2">
        <input type="email" value={value.email} onChange={set('email')} className={inputCls(errors.email)} />
      </Field>
      <Field label="Alergias / condiciones de salud" className="sm:col-span-2">
        <textarea value={value.allergies} onChange={set('allergies')} rows={2} className={inputCls()} />
      </Field>
      <Field label="Personas autorizadas para recogerlo" className="sm:col-span-2">
        <textarea value={value.authorizedPickup} onChange={set('authorizedPickup')} rows={2} className={inputCls()} />
      </Field>
      <Field label="Notas internas" className="sm:col-span-2">
        <textarea value={value.notes} onChange={set('notes')} rows={2} className={inputCls()} />
      </Field>
    </div>
  )
}
