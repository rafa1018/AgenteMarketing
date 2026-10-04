import type { LucideIcon } from 'lucide-react'
import {
  Server, Braces, Hash, Layers, FileCode2, Component, Atom, Code2, Type, Palette,
  Database, DatabaseZap, Table, Boxes, Cloud, CloudCog, GitBranch, Container, Infinity as InfinityIcon,
  Workflow, FileSpreadsheet, Merge, Bot, Sparkles, Brain, Webhook, Cpu, Wand2, Leaf, LayoutGrid,
} from 'lucide-react'
import type { L } from '@/i18n'

/**
 * TECHNOLOGY STACK — grouped by category. `note` is the secondary line shown on hover.
 * Only technologies listed in the CV or confirmed by Rafael.
 */
export type CategoryId = 'backend' | 'frontend' | 'databases' | 'cloud' | 'data' | 'ai'

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

export const techCategories: TechCategory[] = [
  {
    id: 'backend',
    label: p('Backend', 'Backend'),
    code: 'BE',
    icon: Server,
    items: [
      { name: 'C#', icon: Hash, note: p('Lenguaje principal', 'Primary language') },
      { name: '.NET', icon: Layers, note: p('Aplicaciones empresariales', 'Enterprise applications') },
      { name: 'ASP.NET MVC', icon: Server, note: p('Aplicaciones web FullStack', 'Full-stack web apps') },
      { name: 'Blazor', icon: Component, note: p('UI por componentes en .NET', 'Component UI on .NET') },
      { name: 'Laravel', icon: Leaf, note: p('Framework web PHP', 'PHP web framework') },
      { name: 'PHP', icon: FileCode2, note: p('Desarrollo web', 'Web development') },
    ],
  },
  {
    id: 'frontend',
    label: p('Frontend', 'Frontend'),
    code: 'FE',
    icon: LayoutGrid,
    items: [
      { name: 'Angular', icon: Component, note: p('SPA empresariales', 'Enterprise SPAs') },
      { name: 'React', icon: Atom, note: p('Interfaces por componentes', 'Component interfaces') },
      { name: 'TypeScript', icon: Braces, note: p('JavaScript tipado', 'Typed JavaScript') },
      { name: 'JavaScript', icon: Code2, note: p('El lenguaje de la web', 'The language of the web') },
      { name: 'HTML', icon: Type, note: p('Estructura semántica', 'Semantic structure') },
      { name: 'CSS', icon: Palette, note: p('Diseño responsive', 'Responsive layouts') },
    ],
  },
  {
    id: 'databases',
    label: p('Bases de datos', 'Databases'),
    code: 'DB',
    icon: Database,
    items: [
      { name: 'Oracle', icon: Database, note: p('Base de datos empresarial', 'Enterprise database') },
      { name: 'PL/SQL', icon: DatabaseZap, note: p('Procedimientos y paquetes', 'Procedures & packages') },
      { name: 'SQL Server', icon: Table, note: p('Motor relacional Microsoft', 'Microsoft relational engine') },
      { name: 'PostgreSQL', icon: Database, note: p('Motor relacional open source', 'Open-source relational') },
      { name: 'MySQL', icon: Table, note: p('Base de datos relacional', 'Relational database') },
      { name: 'MongoDB', icon: Boxes, note: p('Base de datos documental', 'Document database') },
    ],
  },
  {
    id: 'cloud',
    label: p('Cloud / DevOps', 'Cloud / DevOps'),
    code: 'OPS',
    icon: Cloud,
    items: [
      { name: 'Azure', icon: Cloud, note: p('Plataforma cloud', 'Cloud platform') },
      { name: 'Azure DevOps', icon: CloudCog, note: p('Boards, repos y pipelines', 'Boards, repos & pipelines') },
      { name: 'Git', icon: GitBranch, note: p('Control de versiones · TFS', 'Version control · TFS') },
      { name: 'Docker', icon: Container, note: p('Contenedores', 'Containers') },
      { name: 'CI/CD', icon: InfinityIcon, note: p('Integración y entrega continua', 'Continuous delivery') },
    ],
  },
  {
    id: 'data',
    label: p('Datos / Reportes', 'Data / Reporting'),
    code: 'DAT',
    icon: Workflow,
    items: [
      { name: 'ETL', icon: Merge, note: p('Extracción · transformación · carga', 'Extract · transform · load') },
      { name: 'Talend', icon: Workflow, note: p('Integración de datos', 'Data integration') },
      { name: 'JasperReports', icon: FileSpreadsheet, note: p('Reportes institucionales', 'Institutional reports') },
    ],
  },
  {
    id: 'ai',
    label: p('IA / Automatización', 'AI / Automation'),
    code: 'AI',
    icon: Brain,
    items: [
      { name: 'AI Agents', icon: Bot, note: p('Agentes en el flujo de trabajo', 'Agents in the workflow') },
      { name: 'Claude', icon: Sparkles, note: p('Asistente de ingeniería', 'Engineering assistant') },
      { name: 'Gemini', icon: Sparkles, note: p('Asistente multimodal', 'Multimodal assistant') },
      { name: 'n8n', icon: Webhook, note: p('Automatización de flujos', 'Workflow automation') },
      { name: 'LLM APIs', icon: Cpu, note: p('Modelos integrados en productos', 'Models inside products') },
      { name: 'AI-assisted dev', icon: Wand2, note: p('Código, pruebas y docs', 'Code, tests & docs') },
    ],
  },
]

export const techCount = techCategories.reduce((n, c) => n + c.items.length, 0)
