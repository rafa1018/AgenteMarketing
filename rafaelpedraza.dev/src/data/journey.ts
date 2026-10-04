import type { LucideIcon } from 'lucide-react'
import { Code2, Layers, GitBranch, Workflow, Sparkles, Network, Rocket, TestTube, Bug, BookOpen, Package, Lightbulb, ScanSearch, DraftingCompass, FlaskConical, LifeBuoy } from 'lucide-react'
import type { L } from '@/i18n'

const p = (es: string, en: string): L => ({ es, en })

/** MY EVOLUTION — narrative stages (no dates, no invented claims). */
export interface EvolutionStage {
  id: string
  label: string
  title: L
  text: L
  icon: LucideIcon
  tags: string[]
  current?: boolean
}

export const evolution: EvolutionStage[] = [
  { id: 'traditional', label: '01', icon: Code2, title: p('Desarrollo tradicional', 'Traditional development'),
    text: p('Sistemas de información a la medida, sitios web y bases de datos.', 'Custom information systems, websites and databases.'),
    tags: ['PHP', 'C#', 'Visual Basic', 'MySQL'] },
  { id: 'fullstack', label: '02', icon: Layers, title: p('Desarrollo Full Stack', 'Full Stack development'),
    text: p('Aplicaciones ASP.NET, Angular y Laravel sobre Oracle, SQL Server y PostgreSQL.', 'ASP.NET, Angular and Laravel apps over Oracle, SQL Server and PostgreSQL.'),
    tags: ['ASP.NET MVC', 'Angular', 'Oracle', 'PL/SQL'] },
  { id: 'devops', label: '03', icon: GitBranch, title: p('DevOps y versionamiento', 'DevOps & version control'),
    text: p('Control de versiones, tableros y pipelines con Azure DevOps y Git.', 'Version control, boards and pipelines with Azure DevOps and Git.'),
    tags: ['Azure DevOps', 'Git', 'TFS', 'Docker'] },
  { id: 'automation', label: '04', icon: Workflow, title: p('Datos y automatización', 'Data & automation'),
    text: p('Integración de datos con ETL y reportes institucionales.', 'Data integration with ETL and institutional reporting.'),
    tags: ['Talend ETL', 'JasperReports', 'n8n'] },
  { id: 'ai-assisted', label: '05', icon: Sparkles, current: true, title: p('Desarrollo asistido por IA', 'AI-assisted development'),
    text: p('La IA como herramienta en análisis, código, pruebas y documentación.', 'AI as a tool for analysis, code, testing and documentation.'),
    tags: ['Claude', 'AI Agents', 'Testing', 'Docs'] },
]

/**
 * FULL SOFTWARE LIFECYCLE — section 06. Each stage cites real experience from the CV
 * (`proof`), so it reads as track record rather than a generic process.
 */
export interface LifecycleStage {
  id: string
  icon: LucideIcon
  title: L
  text: L
  proof: L[]
}

export const lifecycle: LifecycleStage[] = [
  { id: 'analysis', icon: ScanSearch, title: p('Análisis', 'Analysis'),
    text: p('Levantamiento de requerimientos, reglas de negocio y normativa.', 'Requirements, business rules and regulations.'),
    proof: [p('Analista de software', 'Software analyst'), p('Actualización normativa', 'Regulatory updates')] },
  { id: 'design', icon: DraftingCompass, title: p('Diseño', 'Design'),
    text: p('Arquitectura, modelo de datos e interfaces.', 'Architecture, data model and interfaces.'),
    proof: [p('Clean Architecture', 'Clean Architecture'), p('Modelado relacional', 'Relational modeling')] },
  { id: 'build', icon: Code2, title: p('Desarrollo', 'Development'),
    text: p('Backend, frontend, móvil y base de datos.', 'Backend, frontend, mobile and database.'),
    proof: [p('.NET · Angular · PL/SQL', '.NET · Angular · PL/SQL'), p('Ionic · React Native', 'Ionic · React Native')] },
  { id: 'test', icon: FlaskConical, title: p('Pruebas', 'Testing'),
    text: p('Pruebas funcionales, de regresión y de migración de datos.', 'Functional, regression and data-migration testing.'),
    proof: [p('Pruebas de migración de BD', 'DB migration testing')] },
  { id: 'deploy', icon: Rocket, title: p('Despliegue', 'Deployment'),
    text: p('Versionamiento, integración y entregas automatizadas.', 'Version control, integration and automated delivery.'),
    proof: [p('Azure DevOps · Git', 'Azure DevOps · Git')] },
  { id: 'support', icon: LifeBuoy, title: p('Soporte y evolución', 'Support & evolution'),
    text: p('Operación estable, incidencias críticas y mantenimiento evolutivo.', 'Stable operations, critical incidents and evolutionary maintenance.'),
    proof: [p('Soporte nivel III', 'Level III support'), p('Mantenimiento evolutivo', 'Evolutionary maintenance')] },
]

/** HOW I WORK — engineering process, AI-assisted. */
export interface CoreNode {
  id: string
  label: L
  icon: LucideIcon
  text: L
}

export const coreEngine: CoreNode = { id: 'engine', icon: Lightbulb, label: p('ANÁLISIS', 'ANALYSIS'),
  text: p('Entender el problema, los usuarios y las restricciones.', 'Understand the problem, the users and the constraints.') }
export const coreNodes: CoreNode[] = [
  { id: 'architecture', icon: Network, label: p('ARQUITECTURA', 'ARCHITECTURE'), text: p('Definir capas, límites y flujo de datos.', 'Define layers, boundaries and data flow.') },
  { id: 'code', icon: Code2, label: p('CÓDIGO', 'CODE'), text: p('Implementar con un diseño claro; la IA acelera.', 'Implement against a clear design; AI speeds it up.') },
  { id: 'test', icon: TestTube, label: p('PRUEBAS', 'TEST'), text: p('Casos de prueba y regresión.', 'Test cases and regression.') },
  { id: 'debug', icon: Bug, label: p('DEPURACIÓN', 'DEBUG'), text: p('Análisis de causa raíz.', 'Root-cause analysis.') },
  { id: 'document', icon: BookOpen, label: p('DOCUMENTACIÓN', 'DOCS'), text: p('Documentación junto al código.', 'Documentation next to the code.') },
  { id: 'deploy', icon: Rocket, label: p('DESPLIEGUE', 'DEPLOY'), text: p('Pipelines y entregas automatizadas.', 'Automated pipelines and releases.') },
]
export const coreProduct: CoreNode = { id: 'product', icon: Package, label: p('PRODUCTO', 'PRODUCT'),
  text: p('Software funcionando, revisado y con un responsable.', 'Working software — reviewed and owned.') }

export const focusStatus = [
  { label: p('Ingeniería de software', 'Software engineering'), status: 'ONLINE' },
  { label: p('.NET · Angular', '.NET · Angular'), status: 'ONLINE' },
  { label: p('Arquitectura', 'Architecture'), status: 'ACTIVE' },
  { label: p('DevOps', 'DevOps'), status: 'ACTIVE' },
  { label: p('Automatización', 'Automation'), status: 'ACTIVE' },
  { label: p('IA aplicada', 'Applied AI'), status: 'ACTIVE' },
] as const
