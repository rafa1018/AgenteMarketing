import { Loader2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { initials } from '@/shared/format'

/* Small building blocks of the family portal. */

export function StudentPhoto({ student, size = 44 }: { student: { id: number; firstName: string; lastName: string; hasPhoto: number }; size?: number }) {
  const [broken, setBroken] = useState(false)
  if (student.hasPhoto && !broken) return <img src={`/api/v2/students/${student.id}/photo`} alt="" onError={() => setBroken(true)} className="shrink-0 rounded-full object-cover ring-2 ring-white" style={{ width: size, height: size }} />
  return (
    <span className="grid shrink-0 place-items-center rounded-full bg-[#eeedfb] font-semibold text-royal" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {initials(student)}
    </span>
  )
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      <h1 className="text-[1.8rem] leading-tight">{children}</h1>
      {sub && <p className="mt-1 text-[15px] text-muted">{sub}</p>}
    </div>
  )
}

export const Loading = () => (
  <p className="flex items-center gap-2 py-8 text-muted">
    <Loader2 size={18} className="animate-spin" /> Cargando…
  </p>
)

export function Problem({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <p className="rounded-xl bg-[#fdf0ef] px-4 py-3 text-sm font-medium text-berry">
      {message}{' '}
      {onRetry && (
        <button type="button" onClick={onRetry} className="underline">
          Reintentar
        </button>
      )}
    </p>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('card p-4', className)}>{children}</div>
}

export function Chip({ tone = 'gray', children }: { tone?: 'green' | 'red' | 'yellow' | 'blue' | 'violet' | 'gray'; children: ReactNode }) {
  const c = { green: 'bg-[#e9f4ee] text-leaf', red: 'bg-[#fdf0ef] text-berry', yellow: 'bg-butter text-[#8a5716]', blue: 'bg-[#eaf3fa] text-[#185a8a]', violet: 'bg-[#eeedfb] text-royal', gray: 'bg-paper text-muted' }[tone]
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-bold whitespace-nowrap', c)}>{children}</span>
}

export function YearSelect({ years, value, onChange }: { years: number[]; value: number; onChange: (y: number) => void }) {
  if (years.length < 2) return null
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label="Año" className="rounded-lg border border-line bg-white px-3 py-2 font-semibold">
      {years.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  )
}
