import type { L } from '@/i18n'

/**
 * SELECTED PROJECTS — systems Rafael worked on, as described in the CV.
 * `results` is optional and intentionally empty until real results are provided.
 */
export interface Project {
  id: string
  name: string
  client: string
  summary: L
  role: L
  period: L
  technologies: string[]
  problem: L
  solution: L[]
  results?: L[]
  code: string
  accent: 'blue' | 'cyan' | 'violet'
}

const p = (es: string, en: string): L => ({ es, en })

export const projects: Project[] = [
  {
    id: 'salud-sis',
    code: 'SYS-01',
    name: 'SALUD.SIS',
    client: 'Dirección General de Sanidad Militar (DIGSA)',
    summary: p('Sistema Integral de Información del Subsistema de Salud de las Fuerzas Militares.', 'Integrated Information System of the Military Forces Health Subsystem.'),
    role: p('Desarrollador Senior · FullStack ASP.NET', 'Senior Developer · Full-Stack ASP.NET'),
    period: p('2021 — 2025 (GrowData y UT SALUD SIS Integral)', '2021 — 2025 (GrowData and UT SALUD SIS Integral)'),
    technologies: ['ASP.NET MVC', 'C#', 'Kendo UI', 'PL/SQL', 'Oracle', 'ETL (Talend)', 'JasperReports', 'Azure DevOps'],
    problem: p('Un sistema de salud crítico que debe mantenerse al día con la normativa sin interrumpir su operación.', 'A critical health system that must keep up with regulation without interrupting operations.'),
    solution: [
      p('Desarrollo FullStack evolutivo y correctivo en ASP.NET y C#.', 'Evolutionary and corrective full-stack development in ASP.NET and C#.'),
      p('Integración de datos con Talend y reportes con JasperReports sobre Oracle / PL/SQL.', 'Data integration with Talend and reporting with JasperReports over Oracle / PL/SQL.'),
      p('Nuevas funcionalidades y soporte nivel III con metodologías ágiles.', 'New features and level III support with agile methodologies.'),
    ],
    accent: 'blue',
  },
  {
    id: 'sidcar',
    code: 'SYS-02',
    name: 'SIDCAR · Cuentas de Cobro',
    client: 'Corporación Autónoma Regional de Cundinamarca (CAR)',
    summary: p('Evolución del sistema misional SIDCAR, con aporte clave en el módulo de Cuentas de Cobro.', 'Evolution of the SIDCAR mission system, with a key contribution to the Billing Accounts module.'),
    role: p('Desarrollador de Software & Soporte Nivel III', 'Software Developer & Level III Support'),
    period: p('2022 — 2025', '2022 — 2025'),
    technologies: ['C#', 'ASP.NET', 'Angular', 'SQL Server', 'Oracle', 'Azure DevOps'],
    problem: p('Sistemas institucionales que necesitan nuevas funcionalidades garantizando estabilidad y operación diaria.', 'Institutional systems that need new features while guaranteeing stability and daily operation.'),
    solution: [
      p('Desarrollo, mantenimiento e implementación de funcionalidades en Cuentas de Cobro.', 'Development, maintenance and new features in the Billing Accounts module.'),
      p('Requerimientos FullStack para aplicativos de la OTIC.', 'Full-stack requirements for OTIC applications.'),
      p('Soporte nivel III en SIDCAR, SIDCAR AMBIENTAL y SAE.', 'Level III support for SIDCAR, SIDCAR AMBIENTAL and SAE.'),
    ],
    accent: 'cyan',
  },
  {
    id: 'madr-observatory',
    code: 'SYS-03',
    name: 'Observatorio TI · MADR',
    client: 'Ministerio de Agricultura y Desarrollo Rural (MADR)',
    summary: p('Transformación y mantenimiento de los sistemas misionales del Observatorio de TI.', 'Transformation and maintenance of the IT Observatory mission systems.'),
    role: p('Desarrollador de Software', 'Software Developer'),
    period: p('May 2025 — Dic 2025', 'May 2025 — Dec 2025'),
    technologies: ['.NET', 'C#', 'Blazor', 'PHP', 'Laravel', 'PostgreSQL', 'Azure DevOps'],
    problem: p('Aplicaciones misionales que requerían transformación, atención de incidencias críticas y mejoras normativas.', 'Mission applications requiring transformation, critical-incident handling and regulatory improvements.'),
    solution: [
      p('Transformación y mantenimiento de los sistemas del Observatorio.', 'Transformation and maintenance of the Observatory systems.'),
      p('Resolución de incidencias críticas y soporte nivel III.', 'Critical incident resolution and level III support.'),
      p('Mejoras normativas y funcionalidades de análisis.', 'Regulatory improvements and analysis features.'),
    ],
    accent: 'violet',
  },
  {
    id: 'upc-accreditation',
    code: 'SYS-04',
    name: 'Software de Acreditación',
    client: 'Universidad Popular del Cesar',
    summary: p('Software para los procesos de autoevaluación y acreditación institucional.', 'Software for institutional self-assessment and accreditation processes.'),
    role: p('Programador Web', 'Web Programmer'),
    period: p('Feb 2022 — Dic 2022', 'Feb 2022 — Dec 2022'),
    technologies: ['PHP', 'Laravel', 'Git'],
    problem: p('Procesos de acreditación que requerían software alineado con los requisitos de registro calificado.', 'Accreditation processes requiring software aligned with qualified-registry requirements.'),
    solution: [p('Desarrollo del software requerido para autoevaluación y acreditación.', 'Development of the software required for self-assessment and accreditation.')],
    accent: 'blue',
  },
]
