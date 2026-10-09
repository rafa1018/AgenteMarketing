import { FileDown, Loader2, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { api2, qs } from '../../v2/api'
import { StudentAvatar, inputCls } from '../../v2/kit'

export type FoundRow = { id: number; enrollmentId: number | null; courseId: number | null; course: string | null; firstName: string; lastName: string; secondLastName: string | null; hasPhoto: number; status: string | null }

/** Find a child of the working year by name, code or document → the sheet jumps to their course and row. */
export function StudentFinder({ year, onPick, only }: { year: number | null; onPick: (s: FoundRow) => void; only?: number[] | null }) {
  const [q, setQ] = useState('')
  const [found, setFound] = useState<FoundRow[] | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (q.trim().length < 2) return setFound(null)
    const t = window.setTimeout(async () => {
      setBusy(true)
      const r = await api2.get<{ students: FoundRow[] }>('/students' + qs({ year, q: q.trim() })).catch(() => ({ students: [] }))
      // a teacher only finds the children of the courses she directs
      setFound(r.students.filter((s) => s.enrollmentId && s.courseId && s.status !== 'retirado' && (!only || only.includes(s.courseId))).slice(0, 8))
      setBusy(false)
    }, 300)
    return () => window.clearTimeout(t)
  }, [q, year, only])
  return (
    <div className="relative">
      <Search size={17} className="pointer-events-none absolute top-[23px] left-3.5 -translate-y-1/2 text-muted" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar un niño por nombre, código o documento…" aria-label="Buscar estudiante" className={inputCls() + ' pl-10'} />
      {busy && <Loader2 size={17} className="absolute top-[23px] right-3.5 -translate-y-1/2 animate-spin text-muted" />}
      {found && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-xl border border-line bg-white p-1 shadow-lg">
          {!found.length && <li className="px-3 py-2 text-sm text-muted">No hay estudiantes de {year} con «{q}».</li>}
          {found.map((s) => (
            <li key={s.id} className="flex items-center gap-1 pr-1.5">
              <button
                type="button"
                onClick={() => {
                  onPick(s)
                  setQ('')
                  setFound(null)
                }}
                className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-paper"
              >
                <StudentAvatar s={s} size={34} zoom={false} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold text-ink">
                    {s.lastName} {s.secondLastName ?? ''}, {s.firstName}
                  </span>
                  <span className="block text-[12px] text-muted">{s.course} · ver planilla</span>
                </span>
              </button>
              <a href={`/api/v2/students/${s.id}/boletin?year=${year ?? ''}`} target="_blank" rel="noopener" title="Boletín en PDF" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#fde7f1] px-3 py-1.5 text-[12px] font-bold text-pink hover:bg-pink hover:text-white">
                <FileDown size={14} /> Boletín
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
