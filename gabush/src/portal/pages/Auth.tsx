import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { BlockLogo } from '@/components/fx/Fx'
import { ApiError } from '@/shared/api'
import { field } from '../../admin/ui'
import { InstallBox } from '../install'
import { api, login, logout, passwordChanged, toast } from '../session'
import { Problem } from '../ui'

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh place-items-center bg-[linear-gradient(180deg,#bfe8ff_0%,#f2f8ff_55%)] p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <img src="/images/opt/leon-asomado-400.webp" alt="" width={400} height={402} className="h-28 w-auto" />
          <BlockLogo size="text-[2rem]" kids="text-[1.1rem] px-2.5" />
          <p className="font-serif text-lg font-semibold text-ink">Portal de familias</p>
        </div>
        <div className="card p-6">{children}</div>
        <div className="mt-4">
          <InstallBox highlight={new URLSearchParams(location.search).has('instalar')} />
        </div>
        <a href="/" className="mt-4 block text-center text-sm font-semibold text-royal">
          ← Ir a la página del jardín
        </a>
        <a href="/admin/" className="mt-2 block text-center text-[13px] font-semibold text-muted hover:text-ink">
          Acceso del personal del jardín
        </a>
      </div>
    </div>
  )
}

function PasswordInput({ value, onChange, label, autoComplete }: { value: string; onChange: (v: string) => void; label: string; autoComplete: string }) {
  const [show, setShow] = useState(false)
  return (
    <label className="block">
      <span className="mb-1.5 block text-[14px] font-semibold text-ink">{label}</span>
      <span className="relative block">
        <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className={field + ' pr-12'} required />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Ocultar' : 'Mostrar'} className="absolute top-1/2 right-2 grid size-9 -translate-y-1/2 place-items-center text-muted">
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  )
}

export function Login() {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [forgot, setForgot] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (forgot) {
        const r = await api.post<{ message: string }>('/portal/forgot', { username: user })
        setSent(r.message)
      } else {
        await login(user, pass)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo entrar.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Frame>
      <form onSubmit={submit} className="space-y-4">
        <h1 className="text-[1.5rem]">{forgot ? 'Recuperar contraseña' : 'Entrar'}</h1>
        <label className="block">
          <span className="mb-1.5 block text-[14px] font-semibold text-ink">Usuario</span>
          <input value={user} onChange={(e) => setUser(e.target.value.toUpperCase())} placeholder="Documento del estudiante" autoComplete="username" autoCapitalize="characters" className={field} required />
          <span className="mt-1 block text-[12px] text-muted">El número de documento de tu hijo o hija (o su código GAB).</span>
        </label>
        {!forgot && <PasswordInput value={pass} onChange={setPass} label="Contraseña" autoComplete="current-password" />}
        {error && <Problem message={error} />}
        {sent && <p className="rounded-xl bg-[#e9f4ee] px-4 py-3 text-sm text-leaf">{sent}</p>}
        <button type="submit" disabled={busy} className="btn btn-primary w-full">
          {busy && <Loader2 size={18} className="animate-spin" />} {forgot ? 'Enviarme el enlace' : 'Entrar'}
        </button>
        <button type="button" onClick={() => { setForgot((f) => !f); setError(null); setSent(null) }} className="block w-full text-center text-sm font-semibold text-royal">
          {forgot ? '← Volver a entrar' : '¿Olvidaste tu contraseña?'}
        </button>
        {!forgot && <p className="text-center text-[13px] text-muted">La primera vez, la contraseña también es el documento del estudiante (salvo que el jardín te haya dado otra).</p>}
      </form>
    </Frame>
  )
}

export function ChangePassword({ first = false, onDone }: { first?: boolean; onDone?: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (next !== again) return setError('Las contraseñas nuevas no coinciden.')
    setBusy(true)
    setError(null)
    try {
      await api.post('/portal/password', { current, password: next })
      toast('Contraseña actualizada')
      passwordChanged()
      onDone?.()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar.')
    } finally {
      setBusy(false)
    }
  }
  const form = (
    <form onSubmit={submit} className="space-y-4">
      <h1 className="flex items-center gap-2 text-[1.4rem]">
        <KeyRound className="text-pink" /> {first ? 'Crea tu contraseña' : 'Cambiar contraseña'}
      </h1>
      {first && <p className="text-sm text-muted">Puedes crear una contraseña tuya (mínimo 6 caracteres, pueden ser solo números) o seguir con la que te dio el jardín.</p>}
      <PasswordInput value={current} onChange={setCurrent} label={first ? 'Contraseña con la que entraste' : 'Contraseña actual'} autoComplete="current-password" />
      <PasswordInput value={next} onChange={setNext} label="Contraseña nueva" autoComplete="new-password" />
      <PasswordInput value={again} onChange={setAgain} label="Repite la contraseña nueva" autoComplete="new-password" />
      {error && <Problem message={error} />}
      <button type="submit" disabled={busy} className="btn btn-primary w-full">
        {busy && <Loader2 size={18} className="animate-spin" />} Guardar contraseña
      </button>
      {first && (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await api.post('/portal/password/keep')
                passwordChanged()
              } catch (err) {
                setError(err instanceof ApiError ? err.message : 'No se pudo continuar.')
              } finally {
                setBusy(false)
              }
            }}
            className="btn btn-ghost w-full"
          >
            Seguir con mi contraseña actual
          </button>
          <button type="button" onClick={logout} className="block w-full text-center text-sm font-semibold text-muted">
            Salir
          </button>
        </>
      )}
    </form>
  )
  return first ? <Frame>{form}</Frame> : form
}

export function ResetPassword({ token }: { token: string }) {
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (next !== again) return setError('Las contraseñas no coinciden.')
    setBusy(true)
    setError(null)
    try {
      await api.post('/portal/reset', { token, password: next })
      setDone(true)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo cambiar.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Frame>
      {done ? (
        <div className="space-y-4 text-center">
          <p className="text-[15px] text-ink">¡Listo! Ya puedes entrar con tu contraseña nueva.</p>
          <a href="#/inicio" onClick={() => location.reload()} className="btn btn-primary w-full">
            Entrar
          </a>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <h1 className="text-[1.4rem]">Nueva contraseña</h1>
          <PasswordInput value={next} onChange={setNext} label="Contraseña nueva" autoComplete="new-password" />
          <PasswordInput value={again} onChange={setAgain} label="Repítela" autoComplete="new-password" />
          {error && <Problem message={error} />}
          <button type="submit" disabled={busy} className="btn btn-primary w-full">
            Guardar
          </button>
        </form>
      )}
    </Frame>
  )
}
