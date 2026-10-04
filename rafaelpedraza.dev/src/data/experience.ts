import type { L } from '@/i18n'

/**
 * PROFESSIONAL EXPERIENCE — from CVRafaelPedraza2026_v2.pdf. Newest first.
 */
export interface Experience {
  company: string
  location: string
  role: L
  period: L
  start: string // YYYY-MM
  technologies: string[]
  responsibilities: L[]
  highlight?: boolean
}

const p = (es: string, en: string): L => ({ es, en })

export const experience: Experience[] = [
  {
    company: 'UT SALUD SIS Integral',
    location: 'Bogotá, Colombia',
    role: p('Desarrollador Senior', 'Senior Developer'),
    period: p('Ago 2025 — Dic 2025', 'Aug 2025 — Dec 2025'),
    start: '2025-08',
    technologies: ['ASP.NET MVC', 'C#', 'PL/SQL', 'Oracle', 'JasperSoft', 'ETL (Talend)', 'Git', 'Azure'],
    responsibilities: [
      p('Desarrollo, soporte y mantenimiento evolutivo de SALUD.SIS (Sistema Integral de Información del Subsistema de Salud de las Fuerzas Militares), garantizando actualización normativa y continuidad operativa.',
        'Development, support and evolutionary maintenance of SALUD.SIS (Military Forces Health Subsystem information system), ensuring regulatory updates and operational continuity.'),
      p('Nuevas funcionalidades y soporte especializado nivel III para la Dirección General de Sanidad Militar (DIGSA).',
        'New features and level III specialized support for the Dirección General de Sanidad Militar (DIGSA).'),
    ],
    highlight: true,
  },
  {
    company: 'Ministerio de Agricultura y Desarrollo Rural (MADR)',
    location: 'Bogotá, Colombia',
    role: p('Desarrollador de Software', 'Software Developer'),
    period: p('May 2025 — Dic 2025', 'May 2025 — Dec 2025'),
    start: '2025-05',
    technologies: ['.NET', 'C#', 'Blazor', 'PHP', 'Laravel', 'PostgreSQL', 'Git', 'Azure DevOps'],
    responsibilities: [
      p('Transformación y mantenimiento de sistemas misionales del Observatorio de Tecnologías de la Información.', 'Transformation and maintenance of mission systems of the IT Observatory.'),
      p('Resolución de incidencias críticas y soporte nivel III a aplicaciones clave.', 'Critical incident resolution and level III support for key applications.'),
      p('Mejoras normativas y funcionalidades para observancia y análisis.', 'Regulatory improvements and features for monitoring and analysis.'),
    ],
  },
  {
    company: 'Corporación Autónoma Regional de Cundinamarca (CAR)',
    location: 'Bogotá, Colombia',
    role: p('Desarrollador de Software & Soporte Nivel III', 'Software Developer & Level III Support'),
    period: p('Feb 2025 — Dic 2025', 'Feb 2025 — Dec 2025'),
    start: '2025-02',
    technologies: ['C#', 'ASP.NET', 'Angular', 'SQL Server', 'Oracle', 'Git', 'Azure DevOps'],
    responsibilities: [
      p('Desarrollo y evolución del sistema SIDCAR en la Oficina TIC (OTIC).', 'Development and evolution of the SIDCAR system at the IT office (OTIC).'),
      p('Contribución relevante en el módulo de Cuentas de Cobro: nuevas funcionalidades, mantenimiento y estabilidad.', 'Key contribution to the Billing Accounts module: new features, maintenance and stability.'),
    ],
  },
  {
    company: 'Corporación Autónoma Regional de Cundinamarca (CAR)',
    location: 'Bogotá, Colombia',
    role: p('Desarrollador de Software & Soporte Nivel III', 'Software Developer & Level III Support'),
    period: p('Mar 2024 — Dic 2024', 'Mar 2024 — Dec 2024'),
    start: '2024-03',
    technologies: ['C#', 'ASP.NET', 'SQL Server', 'Oracle', 'Git', 'Azure DevOps'],
    responsibilities: [
      p('Requerimientos FullStack para aplicativos, herramientas y sistemas de información de la CAR.', 'Full-stack requirements for CAR applications, tools and information systems.'),
    ],
  },
  {
    company: 'Corporación Autónoma Regional de Cundinamarca (CAR)',
    location: 'Bogotá, Colombia',
    role: p('Desarrollador de Software & Soporte Nivel III', 'Software Developer & Level III Support'),
    period: p('Jun 2023 — Dic 2023', 'Jun 2023 — Dec 2023'),
    start: '2023-06',
    technologies: ['C#', '.NET', 'SQL Server', 'Git', 'Azure DevOps'],
    responsibilities: [
      p('Soporte nivel III y desarrollos FullStack en SIDCAR, SIDCAR AMBIENTAL y SAE.', 'Level III support and full-stack development for SIDCAR, SIDCAR AMBIENTAL and SAE.'),
    ],
  },
  {
    company: 'GrowData',
    location: 'Bogotá, Colombia',
    role: p('Ingeniero de Soporte y Desarrollo', 'Support & Development Engineer'),
    period: p('Mar 2023 — Dic 2023', 'Mar 2023 — Dec 2023'),
    start: '2023-03',
    technologies: ['ASP.NET MVC', 'C#', 'PL/SQL', 'Oracle', 'JasperSoft', 'ETL (Talend)', 'Git', 'Azure DevOps'],
    responsibilities: [
      p('Desarrollador FullStack ASP.NET: desarrollos evolutivos y correctivos para SALUD.SIS (DIGSA).', 'Full-stack ASP.NET developer: evolutionary and corrective development for SALUD.SIS (DIGSA).'),
    ],
  },
  {
    company: 'Corporación Autónoma Regional de Cundinamarca (CAR)',
    location: 'Bogotá, Colombia',
    role: p('Ingeniero de Soporte Nivel III .NET', 'Level III Support Engineer .NET'),
    period: p('Sep 2022 — May 2023', 'Sep 2022 — May 2023'),
    start: '2022-09',
    technologies: ['C#', 'Angular', '.NET', 'SQL Server', 'Git', 'Azure DevOps'],
    responsibilities: [
      p('Apoyo en planes de descongestión de trámites ambientales y mantenimiento de aplicativos.', 'Support for environmental-procedure decongestion plans and application maintenance.'),
    ],
  },
  {
    company: 'GrowData',
    location: 'Bogotá, Colombia',
    role: p('Analista de Base de Datos', 'Database Analyst'),
    period: p('Nov 2022 — Feb 2023', 'Nov 2022 — Feb 2023'),
    start: '2022-11',
    technologies: ['PostgreSQL', 'SQL Server', 'MySQL'],
    responsibilities: [p('Diseño y aplicación de pruebas para migración de bases de datos.', 'Design and execution of database-migration tests.')],
  },
  {
    company: 'Universidad Popular del Cesar',
    location: 'Valledupar, Cesar',
    role: p('Programador Web', 'Web Programmer'),
    period: p('Feb 2022 — Dic 2022', 'Feb 2022 — Dec 2022'),
    start: '2022-02',
    technologies: ['PHP', 'Laravel', 'Git'],
    responsibilities: [
      p('Software para procesos de autoevaluación y acreditación (registro calificado y condiciones institucionales).', 'Software for self-assessment and accreditation processes (qualified registry and institutional conditions).'),
    ],
  },
  {
    company: 'GrowData',
    location: 'Bogotá, Colombia',
    role: p('Desarrollador de Software', 'Software Developer'),
    period: p('Oct 2021 — Jul 2022', 'Oct 2021 — Jul 2022'),
    start: '2021-10',
    technologies: ['C#', 'ASP.NET MVC', 'Kendo UI', 'PL/SQL', 'Oracle', 'JasperSoft', 'ETL (Talend)', 'Azure DevOps'],
    responsibilities: [
      p('Desarrollador FullStack ASP.NET para SALUD.SIS: desarrollo, soporte y mantenimiento para DIGSA, con metodologías ágiles.', 'Full-stack ASP.NET developer for SALUD.SIS: development, support and maintenance for DIGSA, using agile methodologies.'),
    ],
  },
  {
    company: 'GlobalEDB',
    location: 'Bogotá, Colombia',
    role: p('Desarrollador .NET MVC, ASP.NET', '.NET MVC / ASP.NET Developer'),
    period: p('Mar 2021 — Sep 2021', 'Mar 2021 — Sep 2021'),
    start: '2021-03',
    technologies: ['ASP.NET MVC', 'C#', 'PL/SQL', 'Oracle', 'Git', 'Azure DevOps'],
    responsibilities: [p('Desarrollo, soporte, administración de bases de datos y reportes.', 'Development, support, database administration and reporting.')],
  },
  {
    company: 'Konecta Digital',
    location: 'Medellín, Antioquia',
    role: p('Desarrollador Web Profesional', 'Professional Web Developer'),
    period: p('Ene 2019 — Nov 2019', 'Jan 2019 — Nov 2019'),
    start: '2019-01',
    technologies: ['HTML', 'CSS', 'JavaScript', 'PHP', 'Laravel', 'WordPress'],
    responsibilities: [p('Landing pages, sitios responsive y e-commerce.', 'Landing pages, responsive sites and e-commerce.')],
  },
  {
    company: 'SisemCorp',
    location: 'Valledupar, Cesar',
    role: p('Desarrollador Full Stack', 'Full Stack Developer'),
    period: p('Feb 2016 — Dic 2018', 'Feb 2016 — Dec 2018'),
    start: '2016-02',
    technologies: ['HTML', 'CSS', 'JavaScript', 'PHP', 'Laravel', 'WordPress', 'OpenCart', 'C#', 'Visual Basic'],
    responsibilities: [
      p('Sistemas de información y software a la medida; administración de MySQL, Oracle, SQL Server y PostgreSQL.', 'Information systems and custom software; administration of MySQL, Oracle, SQL Server and PostgreSQL.'),
    ],
  },
]

export const education = [
  { title: p('Especialización en Ingeniería de Software', 'Specialization in Software Engineering'), institution: 'Universidad Popular del Cesar', date: p('Dic 2025', 'Dec 2025') },
  { title: p('Ingeniería de Sistemas', 'Systems Engineering'), institution: 'Universidad Popular del Cesar', date: p('Oct 2022', 'Oct 2022') },
]
