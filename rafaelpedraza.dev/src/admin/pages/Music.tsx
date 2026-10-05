import { Link2, Loader2, Music2, RotateCcw, Save, Upload, Volume2 } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { api, fmtDate, toast, type Settings } from '../api'
import { Card, CardTitle, Confirm, PageHead, Toggle, btnGhost, btnPrimary, field, label } from '../ui'

const MAX_MB = 30
const ERRORS: Record<string, string> = {
  too_big: `El archivo pesa más de ${MAX_MB} MB.`,
  not_mp3: 'El archivo no es un .mp3 válido.',
  url: 'La URL debe empezar por https://',
  upload: 'No se pudo subir el archivo.',
}

type Res = { settings: Settings; musicSrc: string | null }

const PRESETS = [50, 80, 100]

/** Whether the music starts by itself and at what volume every visit begins. */
function PlaybackCard({ music, onSaved }: { music: Settings['music']; onSaved: (r: Res) => void }) {
  const [volume, setVolume] = useState(music.volume)
  const [busy, setBusy] = useState(false)
  useEffect(() => setVolume(music.volume), [music.volume])

  const post = async (body: Record<string, unknown>, okText: string) => {
    setBusy(true)
    const { data } = await api.post<Res>('settings.php', body)
    setBusy(false)
    if (!data?.ok) return toast('No se pudo guardar.')
    onSaved(data)
    toast(okText)
  }

  return (
    <Card className="lg:col-span-2">
      <CardTitle icon={Volume2}>Reproducción</CardTitle>
      <div className="flex items-start justify-between gap-4 rounded-lg border border-line px-4 py-3">
        <span>
          <span className="block text-[15px] text-fg">Sonar automáticamente al entrar</span>
          <span className="block text-sm text-muted">
            {music.autoplay
              ? 'Empieza sola (si el navegador lo bloquea, arranca con el primer toque o clic del visitante).'
              : 'El botón de música aparece en pausa: el visitante decide si la escucha.'}
          </span>
        </span>
        <Toggle on={music.autoplay} disabled={busy} onChange={(autoplay) => post({ action: 'musicAutoplay', autoplay }, autoplay ? 'La música sonará al entrar.' : 'La música quedará en pausa hasta que el visitante la active.')} label="Sonar automáticamente" />
      </div>

      <div className="mt-4 rounded-lg border border-line px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] text-fg">Volumen inicial</span>
          <span className="font-mono text-lg font-semibold tabular-nums text-cyan">{volume}%</span>
        </div>
        <input type="range" min={0} max={100} step={5} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="mt-3 w-full accent-[#2f8cff]" aria-label="Volumen inicial" />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => setVolume(p)} className={`rounded-full border px-3 py-1.5 text-sm ${volume === p ? 'border-cyan/60 bg-cyan/10 text-fg' : 'border-line text-muted'}`}>
              {p}%
            </button>
          ))}
          <button type="button" className={`${btnPrimary} ml-auto`} disabled={busy || volume === music.volume} onClick={() => post({ action: 'musicVolume', volume }, `Volumen inicial guardado en ${volume}%.`)}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar volumen
          </button>
        </div>
        <p className="mt-2 text-xs text-dim">Cada visitante empieza con este volumen y puede subirlo o bajarlo desde el botón de música.</p>
      </div>
    </Card>
  )
}

export function MusicPage({ tick }: { tick: number }) {
  const [s, setS] = useState<Res | null>(null)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState<'' | 'url' | 'upload' | 'toggle' | 'default'>('')
  const [progress, setProgress] = useState(0)
  const [askDefault, setAskDefault] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.get<Res>('settings.php').then(({ data }) => {
      if (!data?.ok) return
      setS(data)
      setUrl(data.settings.music.mode === 'url' ? data.settings.music.url : '')
    })
  }, [tick])

  const apply = (data: (Res & { ok?: boolean; error?: string }) | null, okText: string) => {
    if (data?.ok) {
      setS(data)
      toast(okText)
    } else toast(ERRORS[data?.error ?? ''] ?? 'No se pudo guardar.')
  }

  const toggle = async (enabled: boolean) => {
    setBusy('toggle')
    const { data } = await api.post<Res>('settings.php', { action: 'musicEnabled', enabled })
    setBusy('')
    apply(data, enabled ? 'Música activada en el sitio.' : 'Música desactivada: el botón de música ya no se muestra.')
  }

  const saveUrl = async (e: FormEvent) => {
    e.preventDefault()
    // check it plays before saving
    setBusy('url')
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
      return toast('No se pudo reproducir esa URL. Debe ser un enlace directo a un archivo de audio (.mp3).')
    }
    const { data } = await api.post<Res>('settings.php', { action: 'musicUrl', url: url.trim() })
    setBusy('')
    apply(data, 'Listo: el sitio ya usa la música de esa URL.')
  }

  const upload = async (file: File) => {
    if (!/\.mp3$/i.test(file.name) && file.type !== 'audio/mpeg') return toast(ERRORS.not_mp3)
    if (file.size > MAX_MB * 1024 * 1024) return toast(ERRORS.too_big)
    const form = new FormData()
    form.append('action', 'musicUpload')
    form.append('file', file)
    setBusy('upload')
    setProgress(0)
    const { data } = await api.upload('settings.php', form, setProgress)
    setBusy('')
    if (fileRef.current) fileRef.current.value = ''
    apply(data, 'Listo: el sitio ya usa la canción que subiste.')
  }

  const backToDefault = async () => {
    setBusy('default')
    const { data } = await api.post<Res>('settings.php', { action: 'musicDefault' })
    setBusy('')
    setUrl('')
    apply(data, 'Se restauró la música original.')
  }

  const m = s?.settings.music
  const current = !m ? '' : m.mode === 'file' ? `Archivo subido: ${m.name || 'canción'}.mp3` : m.mode === 'url' ? `URL: ${m.url}` : 'Música original del sitio'

  return (
    <>
      <PageHead title="Música de fondo" sub="La canción que suena en rafaelpedraza.dev. Los cambios se ven al recargar el sitio." />
      {!s || !m ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="lg:col-span-2">
            <div className="flex items-start justify-between gap-4">
              <CardTitle icon={Music2} sub={m.enabled ? 'Visible: los visitantes ven el botón de música.' : 'Apagada: el sitio no reproduce música ni muestra el botón.'}>
                Música en el sitio
              </CardTitle>
              <Toggle on={m.enabled} onChange={toggle} disabled={busy !== ''} label="Música en el sitio" />
            </div>
            <div className="rounded-lg border border-line bg-ink/50 p-4">
              <p className={label}>Sonando ahora</p>
              <p className="truncate text-[15px] text-fg">{current}</p>
              {m.updatedAt && <p className="mt-0.5 text-xs text-dim">Cambiada el {fmtDate(Date.parse(m.updatedAt) / 1000)}</p>}
              {s.musicSrc && <audio key={s.musicSrc} controls preload="none" src={s.musicSrc} className="mt-3 w-full" />}
            </div>
          </Card>

          {m.enabled && <PlaybackCard music={m} onSaved={setS} />}

          <Card>
            <CardTitle icon={Upload} sub={`Sube un archivo .mp3 desde tu celular o computador (máximo ${MAX_MB} MB).`}>
              Subir canción
            </CardTitle>
            <input ref={fileRef} type="file" accept=".mp3,audio/mpeg" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            <button type="button" className={btnPrimary} disabled={busy !== ''} onClick={() => fileRef.current?.click()}>
              {busy === 'upload' ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
              {busy === 'upload' ? `Subiendo… ${progress}%` : 'Elegir archivo .mp3'}
            </button>
            {busy === 'upload' && (
              <div className="mt-3 h-1.5 rounded-full bg-steel">
                <div className="h-full rounded-full bg-gradient-to-r from-volt to-cyan transition-[width]" style={{ width: `${progress}%` }} />
              </div>
            )}
          </Card>

          <Card>
            <CardTitle icon={Link2} sub="Pega un enlace directo a un archivo de audio (que termine en .mp3, por ejemplo).">
              Usar una URL
            </CardTitle>
            <form onSubmit={saveUrl} className="flex flex-col gap-3 sm:flex-row">
              <input className={field} type="url" inputMode="url" placeholder="https://…/cancion.mp3" value={url} onChange={(e) => setUrl(e.target.value)} required pattern="https://.+" />
              <button type="submit" className={btnPrimary} disabled={busy !== '' || !url.trim()}>
                {busy === 'url' ? <Loader2 size={17} className="animate-spin" /> : 'Guardar'}
              </button>
            </form>
            <p className="mt-2 text-xs text-dim">Los enlaces de YouTube o Spotify no sirven: deben ser el archivo de audio.</p>
          </Card>

          {m.mode !== 'default' && (
            <div className="lg:col-span-2">
              <button type="button" className={btnGhost} disabled={busy !== ''} onClick={() => setAskDefault(true)}>
                <RotateCcw size={16} /> Volver a la música original
              </button>
            </div>
          )}
        </div>
      )}
      <Confirm open={askDefault} title="¿Volver a la música original?" body="La canción que subiste o la URL guardada dejarán de usarse." confirm="Restaurar" onClose={() => setAskDefault(false)} onConfirm={backToDefault} />
    </>
  )
}
