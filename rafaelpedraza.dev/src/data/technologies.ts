import { useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Server, Braces, Hash, Layers, FileCode2, Component, Atom, Code2, Type, Palette,
  Database, DatabaseZap, Table, Boxes, GitBranch, Container, Infinity as InfinityIcon,
  Workflow, FileSpreadsheet, Merge, Bot, Sparkles, Brain, Webhook, Leaf, LayoutGrid, Coffee, Smartphone, TabletSmartphone,
  Cloud, Cpu, Globe, Terminal, Shield, Box, Package, FileJson, Flame, Zap, Cog, Wrench, BarChart3, TestTube, Bug, Network, KeyRound, Gem, Puzzle, Rocket, Wind, Feather, Monitor, PenTool, MessageSquare,
} from 'lucide-react'
import type { L } from '@/i18n'
import seed from '../../public/api/seed/stack.json'

/**
 * TECHNOLOGY STACK — section 04. The six categories are fixed (the core graphic has six sectors);
 * the technologies inside each one are managed from the admin panel (/admin/ → Stack) and served by
 * /api/stack.php. public/api/seed/stack.json is the starting point and the offline fallback.
 */
export type CategoryId = 'backend' | 'frontend' | 'databases' | 'devops' | 'data' | 'ai'

/** Icons the admin can pick from (stored by name). */
export const TECH_ICONS: Record<string, LucideIcon> = {
  Hash, Layers, Server, Component, Leaf, FileCodeCorner: FileCode2, Coffee, Smartphone, TabletSmartphone, Atom, Braces, CodeXml: Code2, Type, Palette,
  Database, DatabaseZap, Table, Boxes, Workflow, GitBranch, Container, Infinity: InfinityIcon, Merge, FileSpreadsheet, Bot, Sparkles, Webhook, Brain,
  Cloud, Cpu, Globe, Terminal, Shield, Box, Package, FileJson, Flame, Zap, Cog, Wrench, BarChart3, TestTube, Bug, Network, KeyRound, Gem, Puzzle, Rocket, Wind, Feather, Monitor, PenTool, MessageSquare,
}
export const techIcon = (name: string): LucideIcon => TECH_ICONS[name] ?? Code2

/** What the API stores for each technology. */
export interface TechRecord {
  id: string
  name: string
  icon: string
  note: L
  active: boolean
}
export type StackData = Record<CategoryId, TechRecord[]>

export interface Technology {
  name: string
  icon: LucideIcon
  note: L
}

export interface TechCategory {
  id: CategoryId
  label: L
  code: string
  icon: LucideIcon
  items: Technology[]
}

const p = (es: string, en: string): L => ({ es, en })

export const CATEGORIES: Omit<TechCategory, 'items'>[] = [
  { id: 'backend', label: p('Backend', 'Backend'), code: 'BE', icon: Server },
  { id: 'frontend', label: p('Frontend / Mobile', 'Frontend / Mobile'), code: 'FE', icon: LayoutGrid },
  { id: 'databases', label: p('Bases de datos', 'Databases'), code: 'DB', icon: Database },
  { id: 'devops', label: p('DevOps / Versionamiento', 'DevOps / Version control'), code: 'OPS', icon: GitBranch },
  { id: 'data', label: p('Datos / Reportes', 'Data / Reporting'), code: 'DAT', icon: Workflow },
  { id: 'ai', label: p('IA / Automatización', 'AI / Automation'), code: 'AI', icon: Brain },
]

export const stackSeed = seed as StackData

/** Visible categories for the site: only active technologies; English falls back to Spanish. */
export function toCategories(data: StackData): TechCategory[] {
  return CATEGORIES.map((c) => ({
    ...c,
    items: (data[c.id] ?? [])
      .filter((t) => t.active)
      .map((t) => ({ name: t.name, icon: techIcon(t.icon), note: { es: t.note.es, en: t.note.en?.trim() ? t.note.en : t.note.es } })),
  }))
}

let loaded: Promise<StackData> | null = null
export function loadStack(): Promise<StackData> {
  loaded ??= fetch('/api/stack.php')
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => (d?.ok && d.stack ? (d.stack as StackData) : stackSeed))
    .catch(() => stackSeed)
  return loaded
}

/** Stack categories from the API; null while loading. */
export function useTechCategories(): TechCategory[] | null {
  const [cats, setCats] = useState<TechCategory[] | null>(null)
  useEffect(() => {
    let alive = true
    loadStack().then((d) => alive && setCats(toCategories(d)))
    return () => {
      alive = false
    }
  }, [])
  return cats
}
