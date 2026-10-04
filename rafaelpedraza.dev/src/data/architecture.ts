import type { L, Text } from '@/i18n'

/**
 * ARCHITECTURE DIAGRAMS — rendered as animated SVG by <ArchitectureDiagram />.
 * Coordinates live in a 1000 x H viewBox (desktop); mobile re-flows as a vertical list.
 */
export interface DiagramNode {
  id: string
  label: Text
  sub?: Text
  x: number
  y: number
  w?: number
  tone?: 'blue' | 'cyan' | 'violet' | 'muted'
}
export interface DiagramEdge {
  from: string
  to: string
  label?: Text
  dashed?: boolean
}
export interface Diagram {
  id: string
  title: L
  caption: L
  height: number
  nodes: DiagramNode[]
  edges: DiagramEdge[]
}

const p = (es: string, en: string): L => ({ es, en })

export const diagrams: Diagram[] = [
  {
    id: 'clean',
    title: p('Clean Architecture', 'Clean Architecture'),
    caption: p('Las dependencias apuntan hacia el dominio: no conoce frameworks, UI ni bases de datos.', 'Dependencies point inward: the domain knows nothing about frameworks, UI or databases.'),
    height: 640,
    nodes: [
      { id: 'fe', label: 'Frontend', sub: 'Angular · React · Blazor', x: 500, y: 50, tone: 'cyan' },
      { id: 'api', label: 'API', sub: p('ASP.NET · contratos REST', 'ASP.NET · REST contracts'), x: 500, y: 160, tone: 'blue' },
      { id: 'app', label: p('Aplicación', 'Application'), sub: p('Casos de uso · DTOs · validación', 'Use cases · DTOs · validation'), x: 500, y: 270, tone: 'blue' },
      { id: 'domain', label: p('Dominio', 'Domain'), sub: p('Entidades · reglas de negocio', 'Entities · business rules'), x: 500, y: 380, tone: 'violet' },
      { id: 'infra', label: p('Infraestructura', 'Infrastructure'), sub: p('Repositorios · ORM · adaptadores', 'Repositories · ORM · adapters'), x: 500, y: 490, tone: 'blue' },
      { id: 'db', label: p('Base de datos', 'Database'), sub: 'Oracle · SQL Server · PostgreSQL', x: 500, y: 600, w: 260, tone: 'cyan' },
      { id: 'auth', label: p('Identidad', 'Identity'), sub: 'AuthN · AuthZ', x: 170, y: 160, tone: 'muted' },
      { id: 'tests', label: p('Pruebas', 'Tests'), sub: p('Unitarias · integración', 'Unit · integration'), x: 830, y: 270, tone: 'muted' },
      { id: 'reports', label: p('Reportes', 'Reports'), sub: 'JasperReports', x: 170, y: 490, tone: 'muted' },
      { id: 'etl', label: 'ETL', sub: 'Talend', x: 830, y: 600, tone: 'muted' },
    ],
    edges: [
      { from: 'fe', to: 'api', label: 'HTTP' },
      { from: 'api', to: 'app' },
      { from: 'app', to: 'domain' },
      { from: 'infra', to: 'domain', label: p('implementa', 'implements') },
      { from: 'infra', to: 'db', label: 'SQL' },
      { from: 'auth', to: 'api', dashed: true },
      { from: 'tests', to: 'app', dashed: true },
      { from: 'reports', to: 'infra', dashed: true },
      { from: 'etl', to: 'db', dashed: true },
    ],
  },
  {
    id: 'platform',
    title: p('Mapa del sistema', 'System landscape'),
    caption: p('Cómo se conectan las piezas de un sistema empresarial, del navegador al pipeline.', 'How the pieces of an enterprise system connect — from the browser to the pipeline.'),
    height: 520,
    nodes: [
      { id: 'users', label: p('Usuarios', 'Users'), sub: p('Navegador · móvil', 'Browser · mobile'), x: 120, y: 90, tone: 'muted' },
      { id: 'fe', label: 'Frontend', sub: 'SPA', x: 360, y: 90, tone: 'cyan' },
      { id: 'api', label: 'API Gateway', sub: 'REST · Auth', x: 620, y: 90, tone: 'blue' },
      { id: 'svc', label: p('Servicios', 'Services'), sub: '.NET · Laravel', x: 620, y: 260, tone: 'blue' },
      { id: 'int', label: p('Integración', 'Integration'), sub: p('Sistemas externos', 'External systems'), x: 880, y: 260, tone: 'violet' },
      { id: 'dw', label: p('Reportes', 'Reporting'), sub: 'JasperReports', x: 120, y: 430, tone: 'muted' },
      { id: 'etl', label: 'ETL', sub: 'Talend', x: 360, y: 430, tone: 'blue' },
      { id: 'db', label: p('Base de datos', 'Database'), sub: p('Núcleo relacional', 'Relational core'), x: 620, y: 430, tone: 'cyan' },
      { id: 'cicd', label: 'DevOps', sub: 'Git · CI/CD · Docker', x: 880, y: 430, tone: 'violet' },
    ],
    edges: [
      { from: 'users', to: 'fe' },
      { from: 'fe', to: 'api' },
      { from: 'api', to: 'svc' },
      { from: 'svc', to: 'db' },
      { from: 'svc', to: 'int', label: p('eventos', 'events') },
      { from: 'db', to: 'etl' },
      { from: 'etl', to: 'dw' },
      { from: 'cicd', to: 'svc', dashed: true, label: 'deploy' },
    ],
  },
]

export const architecturePrinciples = [
  { title: p('Clean Architecture', 'Clean Architecture'), text: p('Separación de responsabilidades.', 'Separation of concerns.') },
  { title: p('API-first', 'API-first'), text: p('Contratos claros entre frontend y backend.', 'Clear frontend–backend contracts.') },
  { title: p('Integridad de datos', 'Data integrity'), text: p('Modelado relacional y PL/SQL.', 'Relational modeling and PL/SQL.') },
  { title: p('Integración & ETL', 'Integration & ETL'), text: p('Datos confiables entre sistemas.', 'Reliable data between systems.') },
  { title: p('DevOps', 'DevOps'), text: p('Entregas versionadas y automatizadas.', 'Versioned, automated delivery.') },
  { title: p('Soporte nivel III', 'Level III support'), text: p('Estabilidad en producción.', 'Stability in production.') },
]
