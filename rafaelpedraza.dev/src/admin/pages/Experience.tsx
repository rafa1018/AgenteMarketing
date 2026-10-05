import { AnimatePresence, motion } from 'motion/react'
import { ArrowDown, ArrowUp, Briefcase, Languages, Loader2, MapPin, Pencil, Plus, RotateCcw, Star, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent, type KeyboardEvent } from 'react'
import { cn } from '@/lib/utils'
import { period, sortExperience, summary, type Experience } from '@/data/experience'
import { api, toast } from '../api'
import { Card, CardTitle, Confirm, Empty, PageHead, Toggle, btnGhost, btnPrimary, field, label } from '../ui'

type Draft = Experience
const blank = (): Draft => ({ id: '', company: '', location: '', role: { es: '', en: '' }, start: '', end: '', technologies: [], responsibilities: [{ es: '', en: '' }], highlight: false })

export function ExperiencePage({ tick }: { tick: number }) {
  const [items, setItems] = useState<Experience[] | null>(null)
  const [edit, setEdit] = useState<Draft | null>(null)
  const [toDelete, setToDelete] = useState<Experience | null>(null)
  const [askRestore, setAskRestore] = useState(false)

  useEffect(() => {
    api.get<{ items: Experience[] }>('experience.php').then(({ data }) => data?.ok && setItems(sortExperience(data.items)))
  }, [tick])

  const sorted = items ?? []
  const s = summary(sorted)
  const allTechs = useMemo(() => [...new Set(sorted.flatMap((e) => e.technologies))].sort((a, b) => a.localeCompare(b)), [items]) // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (e: Experience) => {
    const { data } = await api.post<{ items: Experience[] }>('experience.php', { action: 'delete', id: e.id })
    if (!data?.ok) return toast('No se pudo eliminar.')
    setItems(sortExperience(data.items))
    toast('Cargo eliminado.')
  }

  const restore = async () => {
    const { data } = await api.post<{ items: Experience[] }>('experience.php', { action: 'restoreSeed' })
    if (!data?.ok) return toast('No se pudo restaurar.')
    setItems(sortExperience(data.items))
    toast('Se restauró la experiencia original del CV.')
  }

  return (
    <>
      <PageHead
        title="Experiencia profesional"
        sub="Los cargos de la sección 03 del sitio. Los cambios se ven al recargar la página."
        actions={
          <button type="button" className={btnPrimary} onClick={() => setEdit(blank())}>
            <Plus size={17} /> Nuevo cargo
          </button>
        }
      />

      <Card className="mb-4">
        <CardTitle sub="Se calcula sola con los cargos registrados (desde el primer inicio hasta el último fin, o hasta hoy si un cargo sigue activo).">Trayectoria</CardTitle>
        <dl className="grid grid-cols-3 gap-4">
          <div>
            <dt className="hud !text-[9.5px] text-dim">Periodo</dt>
            <dd className="mt-1 font-display text-xl font-semibold sm:text-2xl">{sorted.length ? `${s.firstYear} — ${s.lastYear}` : '—'}</dd>
          </div>
          <div>
            <dt className="hud !text-[9.5px] text-dim">Cargos</dt>
            <dd className="mt-1 font-display text-xl font-semibold sm:text-2xl">{s.roles}</dd>
          </div>
          <div>
            <dt className="hud !text-[9.5px] text-dim">Organizaciones</dt>
            <dd className="mt-1 font-display text-xl font-semibold sm:text-2xl">{s.companies.length}</dd>
          </div>
        </dl>
      </Card>

      {items === null ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : sorted.length === 0 ? (
        <Empty>No hay cargos registrados.</Empty>
      ) : (
        <ul className="space-y-3">
          {sorted.map((e) => (
            <li key={e.id}>
              <Card className="!p-4 sm:!p-5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-[17px] font-semibold">{e.role.es}</h3>
                      {e.highlight && <Star size={14} className="fill-cyan text-cyan" aria-label="Destacado" />}
                      {!e.end && <span className="rounded-full bg-ok/15 px-2 py-0.5 text-[11px] text-ok">actual</span>}
                    </div>
                    <p className="mt-0.5 text-sm text-fg/75">{e.company}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 font-mono text-[11.5px] text-cyan">
                      {period(e).es}
                      {e.location && (
                        <span className="inline-flex items-center gap-1 text-dim">
                          <MapPin size={11} /> {e.location}
                        </span>
                      )}
                    </p>
                    <p className="mt-2 text-xs text-dim">
                      {e.responsibilities.length} {e.responsibilities.length === 1 ? 'función' : 'funciones'} · {e.technologies.length} skills
                      {!e.role.en && ' · sin inglés'}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button type="button" className="grid size-10 place-items-center rounded-md text-muted hover:bg-steel/60 hover:text-fg" onClick={() => setEdit(structuredClone(e))} aria-label="Editar">
                      <Pencil size={17} />
                    </button>
                    <button type="button" className="grid size-10 place-items-center rounded-md text-muted hover:bg-danger/10 hover:text-danger" onClick={() => setToDelete(e)} aria-label="Eliminar">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className={`${btnGhost} mt-6`} onClick={() => setAskRestore(true)}>
        <RotateCcw size={16} /> Restaurar la experiencia original del CV
      </button>

      <AnimatePresence>
        {edit && (
          <Editor
            draft={edit}
            suggestions={allTechs}
            onClose={() => setEdit(null)}
            onSaved={(list) => {
              setItems(sortExperience(list))
              setEdit(null)
            }}
          />
        )}
      </AnimatePresence>
      <Confirm open={Boolean(toDelete)} title="¿Eliminar este cargo?" body={toDelete && `${toDelete.role.es} — ${toDelete.company} (${period(toDelete).es}).`} confirm="Eliminar" danger onClose={() => setToDelete(null)} onConfirm={() => toDelete && remove(toDelete)} />
      <Confirm open={askRestore} title="¿Restaurar la experiencia original?" body="Se reemplazan todos los cargos por los que venían en tu CV. Los cambios que hiciste aquí se pierden." confirm="Restaurar" danger onClose={() => setAskRestore(false)} onConfirm={restore} />
    </>
  )
}

function Editor({ draft, suggestions, onClose, onSaved }: { draft: Draft; suggestions: string[]; onClose: () => void; onSaved: (items: Experience[]) => void }) {
  const [d, setD] = useState<Draft>(draft)
  const [current, setCurrent] = useState(draft.id !== '' && draft.end === '')
  const [tech, setTech] = useState('')
  const [showEn, setShowEn] = useState(Boolean(draft.role.en || draft.responsibilities.some((r) => r.en)))
  const [busy, setBusy] = useState(false)
  const up = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }))

  useEffect(() => {
    document.documentElement.style.overflow = 'hidden'
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [])

  const setResp = (i: number, lang: 'es' | 'en', v: string) => up({ responsibilities: d.responsibilities.map((r, j) => (j === i ? { ...r, [lang]: v } : r)) })
  const moveResp = (i: number, dir: -1 | 1) => {
    const list = [...d.responsibilities]
    const j = i + dir
    if (j < 0 || j >= list.length) return
    ;[list[i], list[j]] = [list[j], list[i]]
    up({ responsibilities: list })
  }
  const addTech = (raw: string) => {
    const names = raw.split(',').map((t) => t.trim()).filter(Boolean)
    const next = [...d.technologies]
    for (const n of names) if (!next.some((t) => t.toLowerCase() === n.toLowerCase())) next.push(n)
    up({ technologies: next })
    setTech('')
  }
  const onTechKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (tech.trim()) addTech(tech)
    } else if (e.key === 'Backspace' && !tech && d.technologies.length) up({ technologies: d.technologies.slice(0, -1) })
  }

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const item = { ...d, end: current ? '' : d.end, technologies: tech.trim() ? [...d.technologies, tech.trim()] : d.technologies, responsibilities: d.responsibilities.filter((r) => r.es.trim()) }
    if (!current && !item.end) return toast('Indica el mes de fin, o marca "Trabajo aquí actualmente".')
    if (item.end && item.end < item.start) return toast('La fecha de fin no puede ser anterior al inicio.')
    setBusy(true)
    const { data } = await api.post<{ items: Experience[] }>('experience.php', { action: 'save', item })
    setBusy(false)
    if (!data?.ok) return toast('Revisa los campos obligatorios (cargo, organización y fecha de inicio).')
    toast(d.id ? 'Cargo actualizado.' : 'Cargo agregado.')
    onSaved(data.items)
  }

  return (
    <motion.div className="fixed inset-0 z-[80] flex justify-end bg-ink/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        initial={{ x: 40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 40, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 36 }}
        className="flex h-full w-full max-w-2xl flex-col border-l border-line-strong bg-abyss"
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 sm:px-6">
          <h2 className="font-display text-lg font-semibold">{d.id ? 'Editar cargo' : 'Nuevo cargo'}</h2>
          <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-md text-muted hover:text-fg" aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <button type="button" onClick={() => setShowEn((v) => !v)} className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs', showEn ? 'border-cyan/60 bg-cyan/10 text-fg' : 'border-line text-muted')}>
              <Languages size={14} /> {showEn ? 'Ocultar inglés' : 'Agregar textos en inglés'}
            </button>
            <label className="inline-flex items-center gap-2 text-sm text-muted">
              Destacado <Toggle on={Boolean(d.highlight)} onChange={(v) => up({ highlight: v })} label="Destacado" />
            </label>
          </div>
          {!showEn && <p className="-mt-2 text-xs text-dim">Si no escribes la versión en inglés, el sitio en inglés muestra el texto en español.</p>}

          <label className="block">
            <span className={label}>Cargo *</span>
            <input className={field} value={d.role.es} onChange={(e) => up({ role: { ...d.role, es: e.target.value } })} required minLength={2} maxLength={120} placeholder="Desarrollador Senior" />
          </label>
          {showEn && (
            <label className="block">
              <span className={label}>Cargo (inglés)</span>
              <input className={field} value={d.role.en} onChange={(e) => up({ role: { ...d.role, en: e.target.value } })} maxLength={120} placeholder="Senior Developer" />
            </label>
          )}
          <label className="block">
            <span className={label}>Organización *</span>
            <input className={field} value={d.company} onChange={(e) => up({ company: e.target.value })} required minLength={2} maxLength={120} />
          </label>
          <label className="block">
            <span className={label}>Ciudad, país</span>
            <input className={field} value={d.location} onChange={(e) => up({ location: e.target.value })} maxLength={80} placeholder="Bogotá, Colombia" />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={label}>Inicio *</span>
              <input className={field} type="month" value={d.start} onChange={(e) => up({ start: e.target.value })} required pattern="\d{4}-\d{2}" placeholder="AAAA-MM" />
            </label>
            <label className="block">
              <span className={label}>Fin</span>
              <input className={cn(field, current && 'opacity-40')} type="month" value={current ? '' : d.end} onChange={(e) => up({ end: e.target.value })} disabled={current} pattern="\d{4}-\d{2}" placeholder="AAAA-MM" />
            </label>
          </div>
          <label className="-mt-2 inline-flex cursor-pointer items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={current} onChange={(e) => setCurrent(e.target.checked)} className="size-4 accent-[#2f8cff]" /> Trabajo aquí actualmente (se muestra "Actualidad")
          </label>

          <fieldset>
            <legend className={label}>Funciones</legend>
            <ol className="space-y-3">
              {d.responsibilities.map((r, i) => (
                <li key={i} className="rounded-lg border border-line bg-ink/40 p-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-2.5 font-mono text-[11px] text-dim">{String(i + 1).padStart(2, '0')}</span>
                    <div className="flex-1 space-y-2">
                      <textarea className={cn(field, 'min-h-20 resize-y')} value={r.es} onChange={(e) => setResp(i, 'es', e.target.value)} maxLength={800} placeholder="Describe la función o el logro…" />
                      {showEn && <textarea className={cn(field, 'min-h-16 resize-y text-sm')} value={r.en} onChange={(e) => setResp(i, 'en', e.target.value)} maxLength={800} placeholder="In English (optional)" />}
                    </div>
                    <div className="flex flex-col">
                      <button type="button" className="grid size-8 place-items-center text-muted hover:text-fg disabled:opacity-30" disabled={i === 0} onClick={() => moveResp(i, -1)} aria-label="Subir">
                        <ArrowUp size={15} />
                      </button>
                      <button type="button" className="grid size-8 place-items-center text-muted hover:text-fg disabled:opacity-30" disabled={i === d.responsibilities.length - 1} onClick={() => moveResp(i, 1)} aria-label="Bajar">
                        <ArrowDown size={15} />
                      </button>
                      <button type="button" className="grid size-8 place-items-center text-muted hover:text-danger" onClick={() => up({ responsibilities: d.responsibilities.filter((_, j) => j !== i) })} aria-label="Quitar">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <button type="button" className={`${btnGhost} mt-3`} onClick={() => up({ responsibilities: [...d.responsibilities, { es: '', en: '' }] })}>
              <Plus size={16} /> Agregar función
            </button>
          </fieldset>

          <fieldset>
            <legend className={label}>Skills / tecnologías</legend>
            <div className="flex flex-wrap gap-1.5 rounded-lg border border-line-strong bg-ink/70 p-2">
              {d.technologies.map((t) => (
                <span key={t} className="chip inline-flex items-center gap-1 !py-1 !pr-1 !text-[11.5px]">
                  {t}
                  <button type="button" onClick={() => up({ technologies: d.technologies.filter((x) => x !== t) })} className="grid size-5 place-items-center rounded text-dim hover:text-danger" aria-label={`Quitar ${t}`}>
                    <X size={12} />
                  </button>
                </span>
              ))}
              <input
                className="min-w-32 flex-1 bg-transparent px-1.5 py-1 text-[15px] text-fg placeholder:text-dim focus:outline-none"
                value={tech}
                onChange={(e) => (e.target.value.endsWith(',') ? addTech(e.target.value) : setTech(e.target.value))}
                onKeyDown={onTechKey}
                onBlur={() => tech.trim() && addTech(tech)}
                list="rp-techs"
                placeholder="Escribe y presiona Enter"
                enterKeyHint="done"
              />
              <datalist id="rp-techs">
                {suggestions.filter((s) => !d.technologies.includes(s)).map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>
          </fieldset>
        </div>

        <footer className="flex gap-2 border-t border-line px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] sm:px-6">
          <button type="button" className={btnGhost} onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className={cn(btnPrimary, 'flex-1')} disabled={busy}>
            {busy ? <Loader2 size={17} className="animate-spin" /> : <Briefcase size={17} />} Guardar cargo
          </button>
        </footer>
      </motion.form>
    </motion.div>
  )
}
