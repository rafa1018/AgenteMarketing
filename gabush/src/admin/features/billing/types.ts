/** validUntil: a discount that counts only if the charge is paid by that date ("pronto pago") */
export interface Adjustment { id: number; kind: 'descuento' | 'recargo' | 'mora' | 'traslado'; amount: number; reason: string | null; validUntil?: string | null; daysLate: number | null; waived: boolean; createdBy: string | null; createdAt: string }
export interface Charge {
  id: number
  description: string
  concept: string | null
  year: number | null
  dueOn: string | null
  periodMonth: string | null
  status: 'abierto' | 'pagado' | 'anulado'
  source: string
  createdAt: string
  lateFeeApplies: boolean
  onlinePayable: boolean
  overdue: boolean
  adjustments: Adjustment[]
  amount: number
  discounts: number
  surcharges: number
  lateFees: number
  net: number
  paid: number
  balance: number
}
export interface Payment {
  id: number
  receipt: string | null
  paidOn: string
  amount: number
  method: string
  reference: string | null
  notes: string | null
  status: 'aprobado' | 'anulado' | 'pendiente' | 'rechazado'
  source: 'manual' | 'en_linea' | 'importado'
  createdBy: string | null
  createdAt: string
  charges: { chargeId: number; description: string; amount: number; year: number | null }[]
}
/** balance: what is owed today · upcoming: charges of a year that has not started and are not due yet */
export interface Summary { balance: number; byYear?: { year: number | null; balance: number; overdue: number }[]; upcoming?: number; overdue: number; lateFees: number; credit: number; charged: number; paid: number }
export interface Statement { summary: Summary; total: Summary; charges: Charge[]; payments: Payment[]; checkouts: { id: number; reference: string; provider: string; amount: number; status: string; paymentId: number | null; createdAt: string }[]; since?: string | null; years?: number; gradesLock?: GradesLock }

/** Grades held in the family app for overdue payments, and the payment-agreement exception (visible until a date). */
export interface GradesLock { enabled: boolean; locked: boolean; overdue: number; until: string | null; reason: string | null; by: string | null }

export const METHODS: [string, string][] = [
  ['efectivo', 'Efectivo'],
  ['nequi', 'Nequi'],
  ['daviplata', 'Daviplata'],
  ['bancolombia', 'Bancolombia'],
  ['transferencia', 'Transferencia'],
  ['consignacion', 'Consignación'],
  ['tarjeta', 'Tarjeta'],
  ['colegio', 'En el jardín'],
  ['otro', 'Otro'],
]
export const methodLabel = (m: string) => ({ wompi: 'Wompi (en línea)', mercadopago: 'Mercado Pago (en línea)' })[m] ?? METHODS.find(([k]) => k === m)?.[1] ?? m
