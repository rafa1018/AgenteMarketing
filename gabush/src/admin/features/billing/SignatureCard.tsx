import { PenLine, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { can } from '@/lib/calendar'
import { useMutation, useQuery } from '@/shared/useQuery'
import { toast } from '../../store'
import { api2 } from '../../v2/api'
import { ErrorBox, Field, Spinner, inputCls } from '../../v2/kit'

type Sig = { image: string | null; name: string; title: string; updatedAt: string | null }

/**
 * The rectora's signature: printed automatically on payment receipts and on the paz y salvo when the student
 * is up to date (pending → the signature line stays blank).
 */
export function SignatureCard() {
  const { data, error, loading, reload, setData } = useQuery('signature', () => api2.get<{ signature: Sig }>('/billing/signature'))
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [clean, setClean] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const m = useMutation()
  const editable = can('ajustes')
  useEffect(() => {
    if (data) {
      setName(data.signature.name)
      setTitle(data.signature.title)
    }
  }, [data])
  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  if (error) return <ErrorBox message={error.message} onRetry={reload} />
  if (loading && !data) return <Spinner />
  const sig = data!.signature
  const save = async () => {
    const fd = new FormData()
    if (file) fd.append('file', file)
    fd.append('name', name)
    fd.append('title', title)
    fd.append('clean', clean ? '1' : '0')
    const r = await m.run(() => api2.upload<{ signature: Sig }>('/billing/signature', fd))
    if (r) {
      setData(r)
      setFile(null)
      toast('Firma guardada: ya sale en los comprobantes y en el paz y salvo')
    }
  }
  return (
    <section className="card space-y-4 p-4 sm:p-6">
      <div>
        <h3 className="flex items-center gap-2 text-lg">
          <PenLine size={19} className="text-royal" /> Firma digital
        </h3>
        <p className="mt-1 text-[14px] text-muted">
          Se pone sola en los <b>comprobantes de pago</b> y en el <b>paz y salvo</b> cuando el estudiante está al día. Si tiene saldo pendiente, la firma queda en blanco.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[260px_1fr]">
        <div className="grid min-h-32 place-items-center rounded-2xl border-2 border-dashed border-line bg-white p-3">
          {preview || sig.image ? (
            <img src={preview ?? sig.image!} alt="Firma" className="max-h-28 max-w-full object-contain" />
          ) : (
            <p className="text-center text-sm text-muted">Aún no hay firma</p>
          )}
        </div>
        <div className="space-y-3">
          {editable && (
            <>
              <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button type="button" onClick={() => input.current?.click()} className="btn btn-ghost !min-h-10 !text-sm">
                <Upload size={16} /> {sig.image ? 'Cambiar imagen de la firma' : 'Subir imagen de la firma'}
              </button>
              <p className="text-[12px] text-muted">Firma con tinta negra o azul sobre papel blanco y tómale una foto de cerca, o sube un PNG con fondo transparente.</p>
              <label className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                <input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} className="size-5 accent-[#3a36a8]" /> Quitar el fondo blanco del papel
              </label>
            </>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombre de quien firma (opcional)">
              <input value={name} onChange={(e) => setName(e.target.value)} disabled={!editable} placeholder="Ej. Rectora" className={inputCls()} />
            </Field>
            <Field label="Texto bajo la firma">
              <input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!editable} className={inputCls()} />
            </Field>
          </div>
          {m.message && <ErrorBox message={m.message} />}
          {editable && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={m.busy || (!file && !sig.image)} onClick={save} className="btn btn-primary !min-h-10 !text-sm disabled:opacity-50">
                Guardar firma
              </button>
              {sig.image && (
                <button
                  type="button"
                  disabled={m.busy}
                  onClick={async () => {
                    const r = await m.run(() => api2.del<{ signature: Sig }>('/billing/signature'))
                    if (r) {
                      setData(r)
                      toast('Firma quitada')
                    }
                  }}
                  className="btn btn-ghost !min-h-10 !text-sm text-berry"
                >
                  <Trash2 size={16} /> Quitar firma
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
