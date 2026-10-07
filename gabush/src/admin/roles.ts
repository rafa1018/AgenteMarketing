import type { Perm } from '@/lib/calendar'

/** Everything a staff user can be allowed to do (same keys as RP_PERMS in api/_bootstrap.php). */
export const PERMS: { id: Perm; label: string; detail: string }[] = [
  { id: 'asistencia', label: 'Asistencia', detail: 'Marcar quién vino cada día.' },
  { id: 'estudiantes', label: 'Estudiantes', detail: 'Registrar estudiantes nuevos y actualizar sus datos y fotos.' },
  { id: 'pagos', label: 'Pagos', detail: 'Ver y registrar pagos, cobros extra y lo que debe cada familia.' },
  { id: 'inscripciones', label: 'Inscripciones', detail: 'Ver los formularios que llegan desde la página.' },
  { id: 'calendario', label: 'Calendario', detail: 'Crear eventos públicos o privados y festivos.' },
  { id: 'feed', label: 'Contenido de la página', detail: 'Momentos (feed), Galería y Niveles y programas: fotos, textos e imágenes.' },
  { id: 'ajustes', label: 'Ajustes', detail: 'Planes y precios, horario, recordatorios, notificaciones y copias de seguridad.' },
  { id: 'usuarios', label: 'Usuarios y permisos', detail: 'Crear usuarios y decidir qué puede hacer cada uno.' },
]

export type Role = 'rectora' | 'docente' | 'auxiliar' | 'personalizado'

/** Roles are starting points: choosing one ticks its permissions, which can then be adjusted one by one. */
export const ROLES: { id: Role; label: string; detail: string; perms: Perm[]; color: string }[] = [
  { id: 'rectora', label: 'Rectora', detail: 'Ve y administra todo.', perms: PERMS.map((p) => p.id), color: '#e5197e' },
  { id: 'docente', label: 'Docente', detail: 'Solo toma asistencia.', perms: ['asistencia'], color: '#1fa3dd' },
  { id: 'auxiliar', label: 'Auxiliar', detail: 'Registra y actualiza estudiantes y maneja eventos.', perms: ['estudiantes', 'calendario'], color: '#5cb531' },
  { id: 'personalizado', label: 'Personalizado', detail: 'Tú eliges cada permiso.', perms: [], color: '#f26b1d' },
]

export const roleOf = (id: string) => ROLES.find((r) => r.id === id)
export const roleLabel = (id: string) => (id === 'admin' ? 'Administrador técnico' : (roleOf(id)?.label ?? id))
export const roleColor = (id: string) => (id === 'admin' ? '#23206b' : (roleOf(id)?.color ?? '#615f86'))
