import { Loader2, RotateCcw, Save, Send } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { api, toast, type Settings } from '../api'
import { Card, CardTitle, Toggle, btnGhost, btnPrimary, field, label } from '../ui'

const ERRORS: Record<string, string> = {
  token: 'El token no tiene el formato de Telegram (números:letras, lo da @BotFather).',
  chat: 'El chat ID debe ser un número (puede empezar con -) o un @canal.',
}

/** Ajustes → Telegram: copy of every contact message to a Telegram chat. */
export function TelegramCard({ settings, onChange }: { settings: Settings | null; onChange: (s: Settings) => void }) {
  const tg = settings?.telegram
  const [token, setToken] = useState('')
  const [chatId, setChatId] = useState('')
  const [busy, setBusy] = useState<'' | 'save' | 'test' | 'toggle' | 'reset'>('')

  useEffect(() => setChatId(tg?.chatId ?? ''), [tg?.chatId])

  const post = async (body: Record<string, unknown>, kind: typeof busy, okText: string) => {
    setBusy(kind)
    const { data } = await api.post<{ settings: Settings }>('settings.php', body)
    setBusy('')
    if (!data?.ok) return toast(ERRORS[data?.error ?? ''] ?? 'No se pudo guardar.')
    onChange(data.settings)
    toast(okText)
  }

  const save = (e: FormEvent) => {
    e.preventDefault()
    post({ action: 'telegramSave', token: token.trim(), chatId: chatId.trim() }, 'save', 'Datos de Telegram actualizados.').then(() => setToken(''))
  }

  const test = async () => {
    setBusy('test')
    const { data } = await api.post('settings.php', { action: 'telegramTest' })
    setBusy('')
    toast(data?.ok ? 'Mensaje de prueba enviado a Telegram.' : 'Telegram no aceptó el envío: revisa el token y el chat ID (y que le hayas escrito /start al bot).')
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <CardTitle icon={Send} sub={tg?.enabled === false ? 'Apagado: los mensajes solo llegan al panel (y a las notificaciones del celular).' : 'Cada mensaje del formulario también te llega a Telegram.'}>
          Avisos por Telegram
        </CardTitle>
        <Toggle on={tg?.enabled ?? false} disabled={!tg || busy !== ''} onChange={(enabled) => post({ action: 'telegramEnabled', enabled }, 'toggle', enabled ? 'Avisos por Telegram activados.' : 'Avisos por Telegram desactivados.')} label="Avisos por Telegram" />
      </div>
      <form onSubmit={save} className="space-y-3">
        <label className="block">
          <span className={label}>Token del bot {tg?.tokenHint && <span className="normal-case tracking-normal text-dim">· actual {tg.tokenHint}</span>}</span>
          <input className={field} value={token} onChange={(e) => setToken(e.target.value)} placeholder={tg?.tokenHint ? 'Déjalo vacío para conservar el actual' : '123456789:AA…'} autoComplete="off" spellCheck={false} />
        </label>
        <label className="block">
          <span className={label}>Chat ID</span>
          <input className={field} value={chatId} onChange={(e) => setChatId(e.target.value)} placeholder="123456789" inputMode="text" autoComplete="off" spellCheck={false} required />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={btnPrimary} disabled={!tg || busy !== '' || (!token.trim() && chatId.trim() === tg?.chatId)}>
            {busy === 'save' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar
          </button>
          <button type="button" className={btnGhost} onClick={test} disabled={!tg || busy !== ''}>
            {busy === 'test' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Enviar prueba
          </button>
          {tg?.source === 'panel' && (
            <button type="button" className={btnGhost} disabled={busy !== ''} onClick={() => post({ action: 'telegramReset' }, 'reset', 'Se volvió a los datos originales de Telegram.')}>
              <RotateCcw size={16} /> Usar los originales
            </button>
          )}
        </div>
      </form>
      <p className="mt-3 text-xs leading-relaxed text-dim">El token se guarda solo en el servidor; aquí nunca se muestra completo.</p>
    </Card>
  )
}
