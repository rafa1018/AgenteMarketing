import { Field, inputCls } from '../../v2/kit'
import { RELATIONSHIPS } from './types'

export type GuardianFormValue = { name: string; relationship: string; docType: string; docNumber: string; phone: string; phone2: string; email: string; address: string; occupation: string; isPrimary: boolean; isBilling: boolean }

export const emptyGuardian = (relationship = 'Madre'): GuardianFormValue => ({ name: '', relationship, docType: 'CC', docNumber: '', phone: '', phone2: '', email: '', address: '', occupation: '', isPrimary: false, isBilling: false })

/** A guardian (madre, padre, acudiente…) of the family group. */
export function GuardianForm({ value, onChange, errors = {}, compact = false }: { value: GuardianFormValue; onChange: (v: GuardianFormValue) => void; errors?: Record<string, string>; compact?: boolean }) {
  const set = (k: keyof GuardianFormValue) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value })
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nombre completo *" error={errors.name} className="sm:col-span-2">
        <input value={value.name} onChange={set('name')} className={inputCls(errors.name)} autoComplete="off" />
      </Field>
      <Field label="Parentesco">
        <select value={value.relationship} onChange={set('relationship')} className={inputCls()}>
          {RELATIONSHIPS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </Field>
      <Field label="Documento">
        <div className="flex gap-2">
          <select value={value.docType} onChange={set('docType')} className={inputCls() + ' w-24 shrink-0'} aria-label="Tipo">
            {['CC', 'CE', 'PP', 'PEP', 'PPT', 'TI'].map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
          <input value={value.docNumber} onChange={set('docNumber')} inputMode="numeric" className={inputCls()} aria-label="Número" />
        </div>
      </Field>
      <Field label="Celular / WhatsApp" error={errors.phone}>
        <input value={value.phone} onChange={set('phone')} inputMode="tel" className={inputCls(errors.phone)} />
      </Field>
      <Field label="Correo (recibe avisos y comprobantes)" error={errors.email}>
        <input type="email" value={value.email} onChange={set('email')} className={inputCls(errors.email)} />
      </Field>
      {!compact && (
        <>
          <Field label="Otro teléfono">
            <input value={value.phone2} onChange={set('phone2')} inputMode="tel" className={inputCls()} />
          </Field>
          <Field label="Ocupación">
            <input value={value.occupation} onChange={set('occupation')} className={inputCls()} />
          </Field>
          <Field label="Dirección" className="sm:col-span-2">
            <input value={value.address} onChange={set('address')} className={inputCls()} />
          </Field>
          <label className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <input type="checkbox" checked={value.isPrimary} onChange={(e) => onChange({ ...value, isPrimary: e.target.checked })} className="size-5 accent-[#3a36a8]" /> Contacto principal
          </label>
          <label className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <input type="checkbox" checked={value.isBilling} onChange={(e) => onChange({ ...value, isBilling: e.target.checked })} className="size-5 accent-[#3a36a8]" /> Responsable de pagos
          </label>
        </>
      )}
    </div>
  )
}
