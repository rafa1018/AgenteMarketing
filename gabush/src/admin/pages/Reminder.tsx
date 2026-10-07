import { Loader2, MessageCircle, Phone, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatDay, todayYMD } from '@/lib/dates'
import { Modal } from '@/components/ui/Modal'
import { closeReminder, fullName, saveReminderTemplate, saveStudent, useAdmin } from '../store'
import { guardianWhatsapp, money, type Due } from '../logic'
import { Avatar, field, labelCls } from '../ui'
import { PhoneInput } from '@/components/ui/PhoneInput'
import { PHONE_HINT, coMobileDigits } from '@/lib/phone'

/** Default WhatsApp reminder. Placeholders are replaced for each student. */
export const DEFAULT_TEMPLATE =
  'Hola {acudiente} 👋, te saludamos de Gabush Kids.\n\nTe recordamos que está pendiente el pago de {concepto} de {estudiante}: *{valor}* (fecha de pago: {fecha}).\n\nSi ya realizaste el pago, por favor ignora este mensaje. ¡Muchas gracias!'

export const PLACEHOLDERS: [string, string][] = [
  ['{acudiente}', 'nombre del acudiente'],
  ['{estudiante}', 'nombre del niño'],
  ['{concepto}', 'mensualidad, días o extra'],
  ['{valor}', 'valor a pagar'],
  ['{fecha}', 'fecha de pago'],
]

/** What is being collected, in words. */
function concept(d: Due) {
  if (d.kind === 'mensual') return d.count > 1 ? `${d.count} mensualidades` : 'la mensualidad'
  if (d.kind === 'dia') return `${d.count} día${d.count === 1 ? '' : 's'} de asistencia`
  return (d.charges ?? []).map((c) => c.concept.toLowerCase()).join(', ')
}

export function fillTemplate(template: string, d: Due) {
  const first = d.student.guardianName.trim().split(/\s+/)[0] ?? ''
  return template
    .replaceAll('{acudiente}', first)
    .replaceAll('{estudiante}', fullName(d.student))
    .replaceAll('{concepto}', concept(d))
    .replaceAll('{valor}', money(d.amount))
    .replaceAll('{fecha}', formatDay(d.kind === 'dia' ? todayYMD() : d.date, 'es'))
    .replace(/Hola\s+👋/, 'Hola 👋') // no guardian name
}

/** WhatsApp reminder for one pending payment (mounted once in the app). */
export function ReminderModal() {
  const due = useAdmin((s) => s.reminding)
  const template = useAdmin((s) => s.reminderTemplate) || DEFAULT_TEMPLATE
  const students = useAdmin((s) => s.students)
  const student = due ? (students.find((s) => s.id === due.student.id) ?? due.student) : null
  const [text, setText] = useState('')
  const [phone, setPhone] = useState('')
  const [saving, setSaving] = useState(false)
  const [phoneError, setPhoneError] = useState(false)
  const [editPhone, setEditPhone] = useState(false)

  useEffect(() => {
    if (!due) return
    setText(fillTemplate(template, due))
    setPhone('')
    setPhoneError(false)
    setEditPhone(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due])

  if (!due || !student) return null
  const link = student.guardianPhone ? guardianWhatsapp(student.guardianPhone, text) : null
  // Colombian mobiles: 10 digits starting with 3 (optionally with 57 in front)
  const digits = student.guardianPhone.replace(/\D/g, '')
  const suspicious = Boolean(student.guardianPhone) && !coMobileDigits(student.guardianPhone)
  const askPhone = !student.guardianPhone || editPhone

  const savePhone = async () => {
    if (!coMobileDigits(phone)) return setPhoneError(true)
    setSaving(true)
    const { student: saved } = await saveStudent({ ...student, guardianPhone: phone.trim() })
    setSaving(false)
    if (!saved) setPhoneError(true)
    else setEditPhone(false)
  }

  return (
    <Modal open onClose={closeReminder} label="Recordar pago" closeLabel="Cerrar" className="sm:!max-w-lg">
      <div className="p-6 sm:p-8">
        <h2 className="pr-12 text-[1.7rem]">Recordar pago</h2>
        <div className="mt-4 flex items-center gap-3">
          <Avatar student={student} size={44} />
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{fullName(student)}</p>
            <p className="text-sm text-muted">
              {money(due.amount)} · {student.guardianName ? `Acudiente: ${student.guardianName}` : 'Sin nombre de acudiente'}
            </p>
          </div>
        </div>

        {askPhone ? (
          <div className="mt-5 rounded-xl border border-gold/50 bg-[#fff8ea] p-4">
            <p className="flex items-center gap-2 font-semibold text-ink">
              <Phone size={17} /> {student.guardianPhone ? 'Corregir el WhatsApp del acudiente' : 'No hay WhatsApp del acudiente registrado'}
            </p>
            <p className="mt-1 text-sm text-muted">Escríbelo aquí y queda guardado en la ficha de {student.firstName}.</p>
            <div className="mt-3 flex gap-2">
              <PhoneInput autoFocus value={phone} onChange={setPhone} invalid={phoneError} aria-label="Teléfono del acudiente" />
              <button type="button" disabled={saving} onClick={savePhone} className="btn btn-primary !min-h-[46px] shrink-0 !px-4">
                {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />} Guardar
              </button>
            </div>
            {phoneError && <p className="mt-2 text-sm font-medium text-berry">{PHONE_HINT}</p>}
          </div>
        ) : (
          <div className="mt-4 text-sm">
            <p className="text-muted">
              Se enviará al WhatsApp <b className="text-ink">{student.guardianPhone}</b>{' '}
              <button
                type="button"
                onClick={() => {
                  setPhone(student.guardianPhone)
                  setEditPhone(true)
                }}
                className="font-semibold text-royal hover:underline"
              >
                Cambiar
              </button>
            </p>
            {suspicious && (
              <p className="mt-2 rounded-lg bg-[#fdf0ef] px-3 py-2 font-medium text-berry">
                Este número no es un celular de Colombia válido ({digits.length} dígitos). {PHONE_HINT} Corrígelo con “Cambiar” para que el mensaje llegue.
              </p>
            )}
          </div>
        )}

        <label htmlFor="rem-text" className={`${labelCls} mt-5`}>
          Mensaje <span className="font-normal text-muted">(puedes editarlo antes de enviar)</span>
        </label>
        <textarea id="rem-text" rows={8} className={`${field} resize-y leading-relaxed`} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <button type="button" onClick={() => setText(fillTemplate(template, due))} className="font-semibold text-royal hover:underline">
            Volver a la plantilla
          </button>
          <a href="#/ajustes" onClick={closeReminder} className="font-semibold text-royal hover:underline">
            Editar plantilla en Ajustes
          </a>
        </div>

        {link && !askPhone ? (
          <a href={link} target="_blank" rel="noopener noreferrer" onClick={closeReminder} className="btn btn-whatsapp mt-6 w-full">
            <MessageCircle size={19} /> Enviar por WhatsApp
          </a>
        ) : (
          <button type="button" disabled className="btn btn-whatsapp mt-6 w-full opacity-50">
            <MessageCircle size={19} /> Registra el teléfono para enviar
          </button>
        )}
      </div>
    </Modal>
  )
}

/** Ajustes → template editor (shared by every device). */
export function ReminderTemplateCard() {
  const saved = useAdmin((s) => s.reminderTemplate)
  const [text, setText] = useState(saved || DEFAULT_TEMPLATE)
  const [busy, setBusy] = useState(false)
  useEffect(() => setText(saved || DEFAULT_TEMPLATE), [saved])
  return (
    <div className="card p-5 sm:p-6">
      <h2 className="text-xl">Plantilla de recordatorio de pago</h2>
      <p className="mt-1 text-[15px] text-muted">El mensaje que se arma al tocar “Recordar”. Estos campos se reemplazan solos:</p>
      <ul className="mt-2 flex flex-wrap gap-2 text-sm">
        {PLACEHOLDERS.map(([k, v]) => (
          <li key={k}>
            <button type="button" onClick={() => setText((t) => `${t}${k}`)} className="rounded-md bg-paper px-2 py-1 font-mono text-[13px] text-ink hover:bg-[#eeedfb]" title={`Insertar ${v}`}>
              {k}
            </button>{' '}
            <span className="text-muted">{v}</span>
          </li>
        ))}
      </ul>
      <textarea rows={7} className={`${field} mt-3 resize-y leading-relaxed`} value={text} onChange={(e) => setText(e.target.value)} aria-label="Plantilla" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || text === (saved || DEFAULT_TEMPLATE)}
          onClick={async () => {
            setBusy(true)
            await saveReminderTemplate(text.trim())
            setBusy(false)
          }}
          className="btn btn-primary !min-h-11 disabled:opacity-50"
        >
          <Save size={17} /> Guardar plantilla
        </button>
        <button type="button" onClick={() => setText(DEFAULT_TEMPLATE)} className="btn btn-ghost !min-h-11">
          Restaurar la original
        </button>
      </div>
    </div>
  )
}
