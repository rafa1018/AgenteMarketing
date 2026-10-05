import { Clapperboard, Loader2, Save } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { api, toast, type Settings } from '../api'
import { Card, CardTitle, Toggle, btnPrimary, field, label } from '../ui'

const ERRORS: Record<string, string> = {
  video_url: 'Pega un link de YouTube o un enlace https directo a un archivo .mp4 / .webm.',
  video_missing: 'Primero guarda la URL del video.',
}

const currentUrl = (v: Settings['video']) => (v.youtube ? `https://www.youtube.com/watch?v=${v.youtube}` : v.src)

/** Ajustes → background video behind the Manifesto statement (section after the hero). */
export function VideoCard({ settings, onChange }: { settings: Settings | null; onChange: (s: Settings) => void }) {
  const v = settings?.video
  const [url, setUrl] = useState('')
  const [opacity, setOpacity] = useState(30)
  const [busy, setBusy] = useState<'' | 'toggle' | 'url' | 'opacity'>('')

  useEffect(() => {
    if (!v) return
    setUrl(currentUrl(v))
    setOpacity(v.opacity)
  }, [v?.youtube, v?.src, v?.opacity]) // eslint-disable-line react-hooks/exhaustive-deps

  const post = async (body: Record<string, unknown>, kind: typeof busy, okText: string) => {
    setBusy(kind)
    const { data } = await api.post<{ settings: Settings }>('settings.php', body)
    setBusy('')
    if (!data?.ok) return toast(ERRORS[data?.error ?? ''] ?? 'No se pudo guardar.')
    onChange(data.settings)
    toast(okText)
  }

  const saveUrl = (e: FormEvent) => {
    e.preventDefault()
    post({ action: 'videoUrl', url: url.trim() }, 'url', 'Video actualizado. Se ve al recargar el sitio.')
  }

  const hasVideo = Boolean(v && (v.youtube || v.src))

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <CardTitle icon={Clapperboard} sub={v?.enabled ? 'Visible detrás de la frase principal (la sección después de la portada).' : 'Oculto: la sección se ve con su fondo normal.'}>
          Video de fondo
        </CardTitle>
        <Toggle
          on={v?.enabled ?? false}
          disabled={!v || busy !== '' || (!hasVideo && !v.enabled)}
          onChange={(enabled) => post({ action: 'videoEnabled', enabled }, 'toggle', enabled ? 'Video de fondo activado.' : 'Video de fondo oculto.')}
          label="Mostrar video de fondo"
        />
      </div>

      <form onSubmit={saveUrl} className="space-y-2">
        <label className="block">
          <span className={label}>URL del video</span>
          <input className={field} type="url" inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.youtube.com/watch?v=… o https://…/video.mp4" required />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" className={btnPrimary} disabled={!v || busy !== '' || !url.trim() || (v && url.trim() === currentUrl(v))}>
            {busy === 'url' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar URL
          </button>
          <span className="text-xs text-dim">YouTube o un archivo .mp4 directo (más rápido y sin marca de YouTube).</span>
        </div>
      </form>

      <div className="mt-4 rounded-lg border border-line px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[15px] text-fg">Qué tan visible se ve</span>
          <span className="font-mono text-lg font-semibold tabular-nums text-cyan">{opacity}%</span>
        </div>
        <input type="range" min={5} max={100} step={5} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="mt-3 w-full accent-[#2f8cff]" aria-label="Visibilidad del video" />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-dim">Sutil 20–35 % · notorio 50 %+ (la frase debe seguir leyéndose)</span>
          <button type="button" className={btnPrimary} disabled={!v || busy !== '' || opacity === v?.opacity} onClick={() => post({ action: 'videoOpacity', opacity }, 'opacity', `Visibilidad guardada en ${opacity}%.`)}>
            {busy === 'opacity' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar
          </button>
        </div>
      </div>
    </Card>
  )
}
