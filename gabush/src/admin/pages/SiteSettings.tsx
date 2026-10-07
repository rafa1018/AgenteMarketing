import { Link2, Loader2, Music2, Play, Save, Sparkles, Timer, Trash2, Upload, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { expireSession, getCsrf } from '@/lib/calendar'
import type { SiteSettings } from '@/lib/site'
import { cn } from '@/lib/utils'
import { api, toast } from '../store'
import { Card, ConfirmModal, PageHead, field } from '../ui'

/* "Sitio web": options of the public page — intro screen and background music. */

const MAX_MB = 20
const ERRORS: Record<string, string> = {
  too_big: `La canción pesa más de ${MAX_MB} MB. Prueba con un mp3 más liviano.`,
  not_mp3: 'Ese archivo no es un .mp3 válido.',
  url: 'La URL debe empezar por https://',
  upload: 'No se pudo subir el archivo. Intenta de nuevo.',
}
const PRESETS = [30, 50, 70, 100]
const SECONDS_PRESETS = [2, 3, 4, 5]
/** 2.5 → "2,5 segundos" */
const secs = (s: number) => `${String(s).replace('.', ',')} segundos`

function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn('relative h-8 w-14 shrink-0 rounded-full transition-colors disabled:opacity-50', on ? 'bg-leaf' : 'bg-[#d6d8ec]')}
    >
      <span className={cn('absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform', on && 'translate-x-6')} />
    </button>
  )
}

/** multipart upload with progress (XMLHttpRequest — fetch has no upload progress) */
function uploadSong(file: File, onProgress: (p: number) => void): Promise<{ ok?: boolean; error?: string; site?: SiteSettings } | null> {
  return new Promise((resolve) => {
    const fd = new FormData()
    fd.append('action', 'musicUpload')
    fd.append('file', file)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/settings.php')
    xhr.withCredentials = true
    xhr.setRequestHeader('X-CSRF-Token', getCsrf())
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100))
    xhr.onload = () => {
      if (xhr.status === 401) expireSession()
      try {
        resolve(JSON.parse(xhr.responseText))
      } catch {
        resolve(xhr.status === 413 ? { error: 'too_big' } : null)
      }
    }
    xhr.onerror = () => resolve(null)
    xhr.send(fd)
  })
}

export function SitePage() {
  const [site, setSite] = useState<SiteSettings | null>(null)
  const [busy, setBusy] = useState<'' | 'pre' | 'secs' | 'music' | 'auto' | 'vol' | 'url' | 'upload' | 'remove'>('')
  const [volume, setVolume] = useState(60)
  const [seconds, setSeconds] = useState(2.5)
  const [url, setUrl] = useState('')
  const [progress, setProgress] = useState(0)
  const [askRemove, setAskRemove] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get('settings.php').then(({ data }) => {
      if (!data?.site) return
      setSite(data.site)
      setVolume(data.site.music.volume)
      setSeconds(data.site.preloaderSeconds ?? 2.5)
      setUrl(data.site.music.mode === 'url' ? data.site.music.url : '')
    })
  }, [])

  const apply = (data: { ok?: boolean; error?: string; site?: SiteSettings } | null, okText: string) => {
    if (data?.ok && data.site) {
      setSite(data.site)
      setVolume(data.site.music.volume)
      setSeconds(data.site.preloaderSeconds)
      toast(okText)
    } else toast(ERRORS[data?.error ?? ''] ?? 'No se pudo guardar. Revisa tu conexión.')
  }
  const post = async (kind: typeof busy, body: Record<string, unknown>, okText: string) => {
    setBusy(kind)
    const { data } = await api.post('settings.php', body)
    setBusy('')
    apply(data, okText)
  }

  const upload = async (file: File) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!/\.mp3$/i.test(file.name) && file.type !== 'audio/mpeg') return toast(ERRORS.not_mp3)
    if (file.size > MAX_MB * 1024 * 1024) return toast(ERRORS.too_big)
    setBusy('upload')
    setProgress(0)
    const data = await uploadSong(file, setProgress)
    setBusy('')
    apply(data, '¡Listo! La página ya usa la canción que subiste.')
  }

  const saveUrl = async (e: FormEvent) => {
    e.preventDefault()
    setBusy('url')
    // make sure it actually plays before saving
    const playable = await new Promise<boolean>((resolve) => {
      const a = new Audio()
      const done = (ok: boolean) => {
        a.src = ''
        resolve(ok)
      }
      a.addEventListener('canplay', () => done(true), { once: true })
      a.addEventListener('error', () => done(false), { once: true })
      window.setTimeout(() => done(false), 12000)
      a.src = url.trim()
    })
    if (!playable) {
      setBusy('')
      return toast('Esa URL no se pudo reproducir. Debe ser un enlace directo a un archivo de audio (.mp3).')
    }
    const { data } = await api.post('settings.php', { action: 'musicUrl', url: url.trim() })
    setBusy('')
    apply(data, 'Listo: la página ya usa la música de esa URL.')
  }

  const m = site?.music
  const current = !m ? '' : m.mode === 'file' ? `${m.name || 'Canción'}.mp3` : m.mode === 'url' ? m.url : ''

  return (
    <div className="space-y-6">
      <PageHead title="Sitio web" sub="Opciones de la página pública. Los cambios se ven al recargar la página." />
      {!site || !m ? (
        <p className="flex items-center gap-2 text-muted">
          <Loader2 size={18} className="animate-spin" /> Cargando…
        </p>
      ) : (
        <>
          {/* intro */}
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-xl">
                  <Sparkles size={20} className="text-pink" /> Pantalla de bienvenida
                </h2>
                <p className="mt-1 text-[15px] text-muted">
                  {site.preloader
                    ? `Activa: al entrar, las letras GABUSH caen y el león saluda (${secs(site.preloaderSeconds)}, se puede saltar). Se muestra una vez por visita.`
                    : 'Apagada: la página abre directo en la portada.'}
                </p>
              </div>
              <Toggle on={site.preloader} disabled={busy !== ''} label="Pantalla de bienvenida" onChange={(enabled) => post('pre', { action: 'preloader', enabled }, enabled ? 'Pantalla de bienvenida activada.' : 'Pantalla de bienvenida apagada.')} />
            </div>

            {site.preloader && (
              <div className="mt-5 rounded-2xl border-2 border-line p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold text-ink">
                    <Timer size={18} className="text-pink" /> Duración
                  </span>
                  <span className="font-serif text-xl font-semibold text-pink tabular-nums">{secs(seconds)}</span>
                </div>
                <input type="range" min={1.5} max={8} step={0.5} value={seconds} onChange={(e) => setSeconds(Number(e.target.value))} aria-label="Duración de la pantalla de bienvenida" className="mt-3 w-full accent-[#e5197e]" />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {SECONDS_PRESETS.map((p) => (
                    <button key={p} type="button" onClick={() => setSeconds(p)} className={cn('rounded-full border-2 px-3 py-1 text-sm font-semibold', seconds === p ? 'border-pink bg-[#fde7f2] text-ink' : 'border-line text-muted')}>
                      {secs(p)}
                    </button>
                  ))}
                  <button type="button" disabled={busy !== '' || seconds === site.preloaderSeconds} onClick={() => post('secs', { action: 'preloaderSeconds', seconds }, `Duración guardada: ${secs(seconds)}.`)} className="btn btn-primary ml-auto !min-h-10 !px-4 !text-sm disabled:opacity-50">
                    {busy === 'secs' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted">Las letras y el león entran en el primer segundo y medio; el resto del tiempo se quedan en pantalla antes de abrir la página.</p>
              </div>
            )}
          </Card>

          {/* music */}
          <Card>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 text-xl">
                  <Music2 size={20} className="text-royal" /> Música de fondo
                </h2>
                <p className="mt-1 text-[15px] text-muted">
                  {!m.src && m.mode === 'none'
                    ? 'Aún no hay canción: sube un mp3 o pega una URL.'
                    : m.enabled
                      ? 'Activa: los visitantes ven el botón de música (abajo a la izquierda) y pueden pausarla o bajar el volumen.'
                      : 'Apagada: la página no reproduce música ni muestra el botón.'}
                </p>
              </div>
              <Toggle on={m.enabled} disabled={busy !== '' || m.mode === 'none'} label="Música de fondo" onChange={(enabled) => post('music', { action: 'musicEnabled', enabled }, enabled ? 'Música activada en la página.' : 'Música apagada en la página.')} />
            </div>

            {m.mode !== 'none' && (
              <div className="mt-4 rounded-2xl bg-paper p-4">
                <p className="text-xs font-bold tracking-wide text-muted uppercase">Canción actual</p>
                <p className="mt-0.5 truncate font-semibold text-ink">{current}</p>
                {m.updatedAt && <p className="text-xs text-muted">Cambiada el {new Date(m.updatedAt).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
                {(m.src ?? (m.mode === 'url' ? m.url : `/api/media.php?f=${encodeURIComponent(m.file)}`)) && (
                  <audio key={m.file || m.url} controls preload="none" src={m.mode === 'url' ? m.url : `/api/media.php?f=${encodeURIComponent(m.file)}`} className="mt-3 w-full" />
                )}
              </div>
            )}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border-2 border-line p-4">
                <p className="flex items-center gap-2 font-semibold text-ink">
                  <Upload size={18} className="text-royal" /> Subir canción
                </p>
                <p className="mt-1 text-sm text-muted">Un archivo .mp3 desde tu celular o computador (máximo {MAX_MB} MB).</p>
                <input ref={fileRef} type="file" accept=".mp3,audio/mpeg" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
                <button type="button" disabled={busy !== ''} onClick={() => fileRef.current?.click()} className="btn btn-primary mt-3 w-full">
                  {busy === 'upload' ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
                  {busy === 'upload' ? `Subiendo… ${progress}%` : 'Elegir archivo .mp3'}
                </button>
                {busy === 'upload' && (
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full bg-[linear-gradient(90deg,#e5197e,#f8c21c,#1fa3dd)] transition-[width]" style={{ width: `${progress}%` }} />
                  </div>
                )}
              </div>

              <form onSubmit={saveUrl} className="rounded-2xl border-2 border-line p-4">
                <p className="flex items-center gap-2 font-semibold text-ink">
                  <Link2 size={18} className="text-royal" /> Usar una URL
                </p>
                <p className="mt-1 text-sm text-muted">Enlace directo a un archivo de audio. YouTube o Spotify no sirven.</p>
                <input className={cn(field, 'mt-3')} type="url" inputMode="url" placeholder="https://…/cancion.mp3" value={url} onChange={(e) => setUrl(e.target.value)} required pattern="https://.+" />
                <button type="submit" disabled={busy !== '' || !url.trim()} className="btn btn-ghost mt-3 w-full">
                  {busy === 'url' ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />} Probar y guardar
                </button>
              </form>
            </div>

            {m.mode !== 'none' && m.enabled && (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="flex items-start justify-between gap-4 rounded-2xl border-2 border-line p-4">
                  <span>
                    <span className="block font-semibold text-ink">Sonar automáticamente</span>
                    <span className="block text-sm text-muted">
                      {m.autoplay ? 'Empieza sola (si el navegador lo bloquea, arranca con el primer toque del visitante).' : 'El botón aparece en pausa: el visitante decide si la escucha.'}
                    </span>
                  </span>
                  <Toggle on={m.autoplay} disabled={busy !== ''} label="Sonar automáticamente" onChange={(autoplay) => post('auto', { action: 'musicAutoplay', autoplay }, autoplay ? 'La música sonará al entrar.' : 'La música quedará en pausa hasta que el visitante la active.')} />
                </div>

                <div className="rounded-2xl border-2 border-line p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-semibold text-ink">
                      <Volume2 size={18} className="text-royal" /> Volumen inicial
                    </span>
                    <span className="font-serif text-xl font-semibold text-pink tabular-nums">{volume}%</span>
                  </div>
                  <input type="range" min={0} max={100} step={5} value={volume} onChange={(e) => setVolume(Number(e.target.value))} aria-label="Volumen inicial" className="mt-3 w-full accent-[#e5197e]" />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {PRESETS.map((p) => (
                      <button key={p} type="button" onClick={() => setVolume(p)} className={cn('rounded-full border-2 px-3 py-1 text-sm font-semibold', volume === p ? 'border-pink bg-[#fde7f2] text-ink' : 'border-line text-muted')}>
                        {p}%
                      </button>
                    ))}
                    <button type="button" disabled={busy !== '' || volume === m.volume} onClick={() => post('vol', { action: 'musicVolume', volume }, `Volumen inicial guardado en ${volume}%.`)} className="btn btn-primary ml-auto !min-h-10 !px-4 !text-sm disabled:opacity-50">
                      {busy === 'vol' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-muted">Cada visitante empieza con este volumen y puede cambiarlo desde el botón de música.</p>
                </div>
              </div>
            )}

            {m.mode !== 'none' && (
              <button type="button" disabled={busy !== ''} onClick={() => setAskRemove(true)} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-berry hover:underline">
                <Trash2 size={16} /> Quitar la canción
              </button>
            )}
          </Card>
        </>
      )}

      <ConfirmModal
        open={askRemove}
        title="¿Quitar la canción?"
        confirmLabel="Sí, quitar"
        tone="danger"
        icon={<Trash2 size={24} />}
        onConfirm={() => post('remove', { action: 'musicRemove' }, 'Canción quitada: la página ya no tiene música.')}
        onClose={() => setAskRemove(false)}
      >
        La página dejará de tener música. El archivo se guarda aparte en el servidor por si lo necesitas después.
      </ConfirmModal>
    </div>
  )
}
