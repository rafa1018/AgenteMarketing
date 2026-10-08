import { CheckCircle2, Copy, Download, FileUp, KeyRound, Loader2, LogOut, RotateCcw, ShieldCheck, Upload, XCircle } from 'lucide-react'
import { useRef, useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { useMutation, useQuery } from '@/shared/useQuery'
import { date, dateTime } from '@/shared/format'
import { toast } from '../../store'
import { api2, useSetup } from '../../v2/api'
import { Badge, CourseSelect, ErrorBox, Field, Spinner, StatusBadge, inputCls } from '../../v2/kit'
import type { DocumentItem, Enrollment, StudentDetail } from './types'

/** Enrollment of the working year, the history of years, required documents and the family portal access. */
export function EnrollmentTab({ detail, onChanged }: { detail: StudentDetail; onChanged: () => void }) {
  const { year } = useSetup()
  const e = detail.enrollments.find((x) => x.year === year) ?? null
  const m = useMutation()
  const [withdraw, setWithdraw] = useState(false)

  const update = async (body: Record<string, unknown>, ok: string) => {
    if (!e) return
    if (await m.run(() => api2.put(`/enrollments/${e.id}`, body))) {
      toast(ok)
      onChanged()
    }
  }
  const status = async (to: string, extra: Record<string, unknown> = {}, ok = 'Listo') => {
    if (!e) return
    if (await m.run(() => api2.post(`/enrollments/${e.id}/status`, { status: to, ...extra }))) {
      toast(ok)
      onChanged()
    }
  }
  const enroll = async () => {
    if (await m.run(() => api2.post('/enrollments', { studentId: detail.student.id, year, status: 'prematricula' }))) {
      toast(`Prematriculado en ${year}`)
      onChanged()
    }
  }

  return (
    <div className="space-y-5">
      <section className="card space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-xl">Matrícula {year}</h3>
          {e && <StatusBadge status={e.status} />}
        </div>
        {!e ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-paper p-4">
            <p className="text-[15px] text-muted">No tiene matrícula en {year}.</p>
            <button type="button" onClick={enroll} disabled={m.busy} className="btn btn-primary !min-h-10 !text-sm">
              Prematricular en {year}
            </button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Curso">
                <CourseSelect value={e.courseId} onChange={(id) => update({ courseId: id }, 'Curso actualizado')} allowAll={false} />
              </Field>
              <Field label="No. de orden">
                <input key={e.id} type="number" min={1} defaultValue={e.orderNumber ?? ''} onBlur={(ev) => ev.target.value !== String(e.orderNumber ?? '') && update({ orderNumber: ev.target.value || null }, 'Número de orden guardado')} className={inputCls()} />
              </Field>
              <Field label="Contrato de matrícula">
                <button type="button" onClick={() => update({ contractSigned: !e.contractSigned }, e.contractSigned ? 'Marcado sin firmar' : 'Contrato firmado')} className={`btn w-full ${e.contractSigned ? 'btn-whatsapp' : 'btn-ghost'}`}>
                  {e.contractSigned ? <CheckCircle2 size={18} /> : <XCircle size={18} />} {e.contractSigned ? 'Firmado' : 'Sin firmar'}
                </button>
              </Field>
            </div>
            <div className="flex flex-wrap gap-2">
              {e.status === 'prematricula' && (
                <button type="button" onClick={() => status('activo', {}, '¡Matriculado! Se generó el cobro de matrícula.')} disabled={m.busy} className="btn btn-primary !text-sm">
                  <ShieldCheck size={17} /> Matricular (activar)
                </button>
              )}
              {e.status !== 'retirado' && (
                <button type="button" onClick={() => setWithdraw(true)} className="btn btn-ghost !text-sm text-berry">
                  <LogOut size={17} /> Retirar
                </button>
              )}
              {e.status === 'retirado' && (
                <button type="button" onClick={() => status('activo', {}, 'Estudiante reintegrado')} disabled={m.busy} className="btn btn-ghost !text-sm">
                  <RotateCcw size={17} /> Reintegrar
                </button>
              )}
            </div>
            {e.status === 'retirado' && (
              <p className="text-sm text-muted">
                Retirado el {date(e.withdrawnOn)}
                {e.withdrawReason && ` · ${e.withdrawReason}`}
              </p>
            )}
          </>
        )}
        {m.message && <ErrorBox message={m.message} />}
      </section>

      {e && <DocumentsPanel enrollment={e} />}
      <PortalAccess detail={detail} onChanged={onChanged} />

      <section className="card p-4 sm:p-5">
        <h3 className="mb-2 text-lg">Historial en el jardín</h3>
        <ul className="divide-y divide-line">
          {detail.enrollments.map((x) => (
            <li key={x.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="font-semibold text-ink">
                {x.year} · {x.course ?? 'Sin curso'}
                {x.isNew > 0 && <Badge tone="blue" className="ml-2">Nuevo</Badge>}
              </span>
              <StatusBadge status={x.status} />
            </li>
          ))}
        </ul>
      </section>

      <WithdrawModal open={withdraw} onClose={() => setWithdraw(false)} onConfirm={(reason, d) => status('retirado', { reason, date: d }, 'Estudiante retirado')} />
    </div>
  )
}

function WithdrawModal({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (reason: string, date: string) => Promise<void> }) {
  const [reason, setReason] = useState('')
  const [d, setD] = useState(() => new Date().toISOString().slice(0, 10))
  const [busy, setBusy] = useState(false)
  return (
    <Modal open={open} onClose={onClose} label="Retirar estudiante" closeLabel="Cerrar" className="sm:!max-w-md">
      <div className="space-y-4 p-6">
        <h2 className="text-[1.5rem]">Retirar estudiante</h2>
        <p className="text-sm text-muted">Las pensiones de los meses siguientes que no tengan pagos se anulan automáticamente.</p>
        <Field label="Fecha de retiro">
          <input type="date" value={d} onChange={(e) => setD(e.target.value)} className={inputCls()} />
        </Field>
        <Field label="Motivo">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Cambio de ciudad, otro colegio…" className={inputCls()} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Cancelar
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              await onConfirm(reason, d)
              setBusy(false)
              onClose()
            }}
            className="btn bg-berry text-white"
          >
            Retirar
          </button>
        </div>
      </div>
    </Modal>
  )
}

/** Required documents of the enrollment: upload (staff), approve / reject with a note the family sees. */
export function DocumentsPanel({ enrollment }: { enrollment: Enrollment }) {
  const { data, error, loading, reload, setData } = useQuery(`docs:${enrollment.id}`, () => api2.get<{ documents: DocumentItem[] }>(`/enrollments/${enrollment.id}/documents`))
  const [rejecting, setRejecting] = useState<DocumentItem | null>(null)
  const [note, setNote] = useState('')
  const fileFor = useRef<number | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState<number | null>(null)

  const upload = async (typeId: number, file: File) => {
    setUploading(typeId)
    try {
      const fd = new FormData()
      fd.append('file', file)
      setData(await api2.upload<{ documents: DocumentItem[] }>(`/enrollments/${enrollment.id}/documents/${typeId}`, fd))
      toast('Documento cargado')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo subir')
    } finally {
      setUploading(null)
    }
  }
  const review = async (d: DocumentItem, status: string, n?: string) => {
    try {
      setData(await api2.put<{ documents: DocumentItem[] }>(`/enrollment-documents/${d.id}`, { status, note: n ?? null }))
      toast(status === 'aprobado' ? 'Documento aprobado' : status === 'rechazado' ? 'Documento devuelto a la familia' : 'Actualizado')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo guardar')
    }
  }
  const docs = data?.documents ?? []
  const missing = docs.filter((d) => d.required && ['pendiente', 'rechazado'].includes(d.status)).length

  return (
    <section className="card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg">Documentos de matrícula</h3>
        {docs.length > 0 && (missing ? <Badge tone="red">Faltan {missing}</Badge> : <Badge tone="green">Completos</Badge>)}
      </div>
      {error ? (
        <ErrorBox message={error.message} onRetry={reload} />
      ) : loading && !data ? (
        <Spinner />
      ) : !docs.length ? (
        <p className="text-sm text-muted">No hay documentos configurados. Agrégalos en Matrículas → Documentos requeridos.</p>
      ) : (
        <ul className="divide-y divide-line">
          {docs.map((d) => (
            <li key={d.typeId} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink">
                  {d.name} {!d.required && <span className="text-sm font-normal text-muted">(opcional)</span>}
                </p>
                <p className="text-[13px] text-muted">
                  {d.uploadedAt ? `${d.uploadedBy === 'family' ? 'Lo subió la familia' : 'Cargado en el jardín'} · ${dateTime(d.uploadedAt)}` : d.description || 'Pendiente'}
                </p>
                {d.note && <p className="mt-0.5 text-[13px] font-semibold text-berry">Nota: {d.note}</p>}
              </div>
              <StatusBadge status={d.status} />
              <div className="flex gap-1">
                {d.fileName && (
                  <a href={`/api/v2/enrollment-documents/${d.id}/file`} target="_blank" rel="noopener noreferrer" className="grid size-9 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink" title="Ver archivo">
                    <Download size={17} />
                  </a>
                )}
                <button type="button" title="Cargar archivo" onClick={() => { fileFor.current = d.typeId; input.current?.click() }} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-paper hover:text-ink">
                  {uploading === d.typeId ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
                </button>
                {d.status !== 'aprobado' && (d.fileName || d.status === 'pendiente') && (
                  <button type="button" title={d.fileName ? 'Aprobar' : 'Recibido en papel'} onClick={() => review(d, 'aprobado')} className="grid size-9 place-items-center rounded-lg text-leaf hover:bg-[#e9f4ee]">
                    <CheckCircle2 size={18} />
                  </button>
                )}
                {d.fileName && d.status !== 'rechazado' && (
                  <button type="button" title="Devolver para corregir" onClick={() => { setRejecting(d); setNote('') }} className="grid size-9 place-items-center rounded-lg text-berry hover:bg-[#fdf0ef]">
                    <XCircle size={18} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <input ref={input} type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f && fileFor.current) upload(fileFor.current, f); e.target.value = '' }} />
      <Modal open={Boolean(rejecting)} onClose={() => setRejecting(null)} label="Devolver documento" closeLabel="Cerrar" className="sm:!max-w-md">
        <div className="space-y-4 p-6">
          <h2 className="text-[1.4rem]">Devolver «{rejecting?.name}»</h2>
          <Field label="¿Qué debe corregir la familia?">
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className={inputCls()} placeholder="La foto está borrosa, falta la página 2…" />
          </Field>
          <button type="button" onClick={async () => { await review(rejecting!, 'rechazado', note); setRejecting(null) }} className="btn w-full bg-berry text-white">
            <FileUp size={18} /> Devolver a la familia
          </button>
        </div>
      </Modal>
    </section>
  )
}

/** Username / temporary password for the family portal. The password is shown only once. */
function PortalAccess({ detail, onChanged }: { detail: StudentDetail; onChanged: () => void }) {
  const [creds, setCreds] = useState<{ username: string; password: string; emailed: boolean } | null>(null)
  const m = useMutation()
  const issue = async (sendEmail: boolean) => {
    const r = await m.run(() => api2.post<{ credentials: { username: string; password: string; emailed: boolean }[] }>('/portal-accounts/issue', { studentIds: [detail.student.id], sendEmail }))
    if (r) {
      setCreds(r.credentials[0])
      onChanged()
    }
  }
  const p = detail.portal
  const shareText = creds ? `Portal de familias Gabush\nhttps://gabushkids.com/familia/\nUsuario: ${creds.username}\nContraseña temporal: ${creds.password}` : ''
  return (
    <section className="card p-4 sm:p-5">
      <h3 className="flex items-center gap-2 text-lg">
        <KeyRound size={19} className="text-royal" /> Portal de la familia
      </h3>
      {p ? (
        <p className="mt-1 text-sm text-muted">
          Usuario <b className="text-ink">{p.username}</b> · {p.active ? 'activo' : 'desactivado'} · {p.lastLogin ? `último ingreso ${dateTime(p.lastLogin)}` : 'aún no ha entrado'}
          {p.mustChange > 0 && ' · debe cambiar la contraseña'}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">La familia todavía no tiene acceso.</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={m.busy} onClick={() => issue(false)} className="btn btn-primary !min-h-10 !text-sm">
          {p ? 'Nueva contraseña temporal' : 'Crear acceso'}
        </button>
        <button type="button" disabled={m.busy} onClick={() => issue(true)} className="btn btn-ghost !min-h-10 !text-sm">
          {p ? 'Restablecer y enviar por correo' : 'Crear y enviar por correo'}
        </button>
      </div>
      {m.message && <div className="mt-3"><ErrorBox message={m.message} /></div>}
      {creds && (
        <div className="mt-4 rounded-xl border-2 border-dashed border-royal/40 bg-[#eeedfb] p-4">
          <p className="text-sm font-semibold text-ink">Compártelo con la familia (solo se muestra una vez):</p>
          <pre className="mt-2 font-mono text-[15px] whitespace-pre-wrap text-ink">{shareText}</pre>
          {creds.emailed && <p className="mt-1 text-sm text-leaf">También se envió al correo de la familia.</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={() => navigator.clipboard.writeText(shareText).then(() => toast('Copiado: pégalo en el chat de la familia'))} className="btn btn-ghost !min-h-10 !text-sm">
              <Copy size={16} /> Copiar para enviar
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
