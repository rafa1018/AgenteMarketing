/*
 * Colours shared by the whole site. The levels & programmes themselves are edited in the admin panel
 * (Niveles); what the site starts with is in content-seed.json.
 */

/** The six colours of the GABUSH letter blocks. */
export type Tone = 'pink' | 'yellow' | 'indigo' | 'blue' | 'green' | 'orange'

export const TONES: Record<Tone, { solid: string; soft: string; text: string; edge: string }> = {
  pink: { solid: '#e5197e', soft: '#fde7f2', text: '#b3115f', edge: '#a80f5a' },
  yellow: { solid: '#f8c21c', soft: '#fff6d6', text: '#8a6400', edge: '#c99a00' },
  indigo: { solid: '#23206b', soft: '#eceafb', text: '#23206b', edge: '#14124a' },
  blue: { solid: '#1fa3dd', soft: '#e3f5fd', text: '#0e6f9c', edge: '#1380b0' },
  green: { solid: '#5cb531', soft: '#ebf7e4', text: '#2f7d14', edge: '#3f8a1d' },
  orange: { solid: '#f26b1d', soft: '#fff0e6', text: '#b84a0c', edge: '#c24f0e' },
}
export const TONE_ORDER: Tone[] = ['pink', 'yellow', 'indigo', 'blue', 'green', 'orange']
