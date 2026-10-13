import type { Id } from '../../v2/api'

export interface StudentRow {
  id: Id
  code: string
  firstName: string
  middleName: string | null
  lastName: string
  secondLastName: string | null
  birthDate: string | null
  gender: 'M' | 'F' | null
  hasPhoto: number
  familyId: Id | null
  enrollmentId: Id | null
  status: 'prematricula' | 'activo' | 'retirado' | null
  orderNumber: number | null
  contractSigned: number | null
  courseId: Id | null
  course: string | null
  guardian: string | null
  guardianPhone: string | null
  guardianRelationship: string | null
  docsPending: number
  hasPortal: number
}

export interface Student {
  id: Id
  code: string
  firstName: string
  middleName: string | null
  lastName: string
  secondLastName: string | null
  birthDate: string | null
  birthCity: string | null
  gender: 'M' | 'F' | null
  docType: string | null
  docNumber: string | null
  eps: string | null
  bloodType: string | null
  religion: string | null
  email: string | null
  allergies: string | null
  authorizedPickup: string | null
  notes: string | null
  hasPhoto: boolean
  photoVersion: string
  familyId: Id | null
}

export interface Guardian {
  id: Id
  name: string
  relationship: string
  docType: string | null
  docNumber: string | null
  phone: string | null
  phone2: string | null
  email: string | null
  address: string | null
  occupation: string | null
  isPrimary: number
  isBilling: number
}

export interface Enrollment {
  id: Id
  year: number
  status: 'prematricula' | 'activo' | 'retirado'
  orderNumber: number | null
  contractSigned: number
  enrolledOn: string | null
  withdrawnOn: string | null
  withdrawReason: string | null
  isNew: number
  courseId: Id | null
  course: string | null
  planId: number | null
  plan: string | null
  monthlyDiscount: number | null
  monthlyDiscountReason: string | null
  /** 1 when it has no payments nor grades (it can be deleted if it was a mistake) */
  deletable: number
}

export interface StudentDetail {
  student: Student
  family: { id: Id; name: string; notes: string | null } | null
  guardians: Guardian[]
  siblings: { id: Id; code: string; firstName: string; lastName: string; course: string | null }[]
  enrollments: Enrollment[]
  portal: { username: string; active: number; mustChange: number; lastLogin: string | null } | null
}

export interface DocumentItem {
  typeId: Id
  name: string
  description: string | null
  required: number
  familyUpload: number
  id: Id
  status: 'pendiente' | 'recibido' | 'aprobado' | 'rechazado'
  fileName: string | null
  mime: string | null
  uploadedBy: string | null
  uploadedAt: string | null
  note: string | null
  reviewedAt: string | null
}

export const DOC_TYPES = ['Registro Civil', 'Tarjeta de Identidad', 'Cédula de Ciudadanía', 'Cédula de Extranjería', 'Pasaporte', 'P.E.P.', 'P.P.T.', 'Indocumentado']
export const RELATIONSHIPS = ['Madre', 'Padre', 'Abuela', 'Abuelo', 'Tía', 'Tío', 'Hermana', 'Hermano', 'Acudiente']
export const BLOOD = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-']
