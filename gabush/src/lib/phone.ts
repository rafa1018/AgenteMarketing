/**
 * Colombian mobile numbers: +57 and 10 digits starting with 3 (e.g. +57 301 648 3958).
 * Accepts what people type: spaces, dashes, parentheses, with or without +57 / 57.
 */

/** The 10 national digits, or null when it isn't a valid Colombian mobile. */
export function coMobileDigits(input: string): string | null {
  let d = input.replace(/\D/g, '')
  if (d.length === 12 && d.startsWith('57')) d = d.slice(2)
  return /^3\d{9}$/.test(d) ? d : null
}

/** "3016483958" → "301 648 3958" (partial input is grouped as it is typed). */
export function groupDigits(d: string): string {
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join(' ')
}

/** Stored / shown format: "+57 301 648 3958". */
export function formatCoMobile(input: string): string {
  const d = coMobileDigits(input)
  return d ? `+57 ${groupDigits(d)}` : input.trim()
}

/** Only the 10 national digits of whatever is stored (for the input box). */
export function localPart(stored: string): string {
  let d = stored.replace(/\D/g, '')
  if (d.length > 10 && d.startsWith('57')) d = d.slice(2)
  return d.slice(0, 10)
}

export const PHONE_HINT = 'Celular de 10 dígitos que empiece por 3 (ej.: 301 648 3958).'
