import { Baby, Blocks, Globe2, GraduationCap, Music2, Palette, Sun, type LucideIcon } from 'lucide-react'
import type { L } from '@/i18n'

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

export interface Program {
  id: string
  icon: LucideIcon
  tone: Tone
  title: L
  /** Edad recomendada (opcional) */
  level?: L
  short: L
  detail: L
  includes: L[]
  /** Foto (public/images/opt) */
  image?: { src: string; alt: L }
  /** true = nivel escolar (se muestra en la fila principal) */
  grade?: boolean
}

/**
 * Niveles y programas — del sitio anterior (gabushkids.com): Párvulos, Prejardín, Jardín y Transición,
 * con enfoque en las artes; máximo 12 niños por salón.
 * Las edades son las habituales en Colombia: confírmalas con el jardín.
 */
export const programs: Program[] = [
  {
    id: 'parvulos',
    icon: Baby,
    tone: 'pink',
    grade: true,
    title: { es: 'Párvulos', en: 'Toddlers' },
    level: { es: '2 a 3 años', en: '2 to 3 years' },
    short: { es: 'Primeros pasos con docente titular y auxiliar.', en: 'First steps with a lead teacher and an assistant.' },
    detail: {
      es: 'Cada grupo de Párvulos tiene máximo 12 niños, acompañados por su docente titular y una auxiliar: atención individual, acompañamiento constante y un entorno seguro y amoroso para sus primeras experiencias fuera de casa.',
      en: 'Each Toddlers group has at most 12 children, with a lead teacher and an assistant: individual attention, constant support and a safe, loving environment for their first experiences away from home.',
    },
    includes: [
      { es: 'Docente titular + auxiliar', en: 'Lead teacher + assistant' },
      { es: 'Estimulación sensorial', en: 'Sensory stimulation' },
      { es: 'Música y movimiento', en: 'Music and movement' },
      { es: 'Hábitos y autonomía', en: 'Routines and independence' },
    ],
    image: { src: '/images/opt/prog-parvulos-640.webp', alt: { es: 'Niño pequeño tocando un tambor de juguete', en: 'Toddler playing a toy drum' } },
  },
  {
    id: 'prejardin',
    icon: Blocks,
    tone: 'yellow',
    grade: true,
    title: { es: 'Prejardín', en: 'Pre-kindergarten' },
    level: { es: '3 a 4 años', en: '3 to 4 years' },
    short: { es: 'Lenguaje, juego y creatividad en grupo.', en: 'Language, play and creativity together.' },
    detail: {
      es: 'Fortalecemos el lenguaje, la motricidad y la socialización a través del juego, la pintura y la expresión corporal, en salones de máximo 12 niños.',
      en: 'We strengthen language, motor skills and social skills through play, painting and body expression, in classes of no more than 12 children.',
    },
    includes: [
      { es: 'Lenguaje y expresión oral', en: 'Language and speaking' },
      { es: 'Motricidad fina y gruesa', en: 'Fine and gross motor skills' },
      { es: 'Pintura y manualidades', en: 'Painting and crafts' },
      { es: 'Juego en grupo', en: 'Group play' },
    ],
    image: { src: '/images/opt/prog-prejardin-640.webp', alt: { es: 'Niña pintando con las manos', en: 'Girl finger painting' } },
  },
  {
    id: 'jardin',
    icon: Palette,
    tone: 'blue',
    grade: true,
    title: { es: 'Jardín', en: 'Kindergarten' },
    level: { es: '4 a 5 años', en: '4 to 5 years' },
    short: { es: 'Pensamiento, arte y emociones.', en: 'Thinking, art and emotions.' },
    detail: {
      es: 'Los niños exploran números, letras y el mundo que los rodea con proyectos artísticos, música y actividades que desarrollan sus habilidades emocionales.',
      en: 'Children explore numbers, letters and the world around them through art projects, music and activities that build emotional skills.',
    },
    includes: [
      { es: 'Pre-lectura y pre-escritura', en: 'Pre-reading and pre-writing' },
      { es: 'Pensamiento lógico', en: 'Logical thinking' },
      { es: 'Proyectos artísticos', en: 'Art projects' },
      { es: 'Habilidades emocionales', en: 'Emotional skills' },
    ],
    image: { src: '/images/opt/prog-jardin-640.webp', alt: { es: 'Niña y niño haciendo manualidades', en: 'Girl and boy doing crafts' } },
  },
  {
    id: 'transicion',
    icon: GraduationCap,
    tone: 'green',
    grade: true,
    title: { es: 'Transición', en: 'Transition (Pre-K)' },
    level: { es: '5 a 6 años', en: '5 to 6 years' },
    short: { es: 'Listos y felices para el colegio.', en: 'Ready and happy for school.' },
    detail: {
      es: 'El último año del preescolar: lectura, escritura, matemáticas iniciales y autonomía para llegar al colegio con confianza, sin dejar de crear y jugar.',
      en: 'The last pre-school year: reading, writing, early maths and independence to start school with confidence — while still creating and playing.',
    },
    includes: [
      { es: 'Lectoescritura', en: 'Reading and writing' },
      { es: 'Matemáticas iniciales', en: 'Early maths' },
      { es: 'Autonomía y hábitos de estudio', en: 'Independence and study habits' },
      { es: 'Ceremonia de grado', en: 'Graduation ceremony' },
    ],
    image: { src: '/images/opt/prog-transicion-640.webp', alt: { es: 'Salón de clase de Gabush con niños y su profesora', en: 'Gabush classroom with children and their teacher' } },
  },
  {
    id: 'artes',
    icon: Music2,
    tone: 'orange',
    title: { es: 'Artes: música, danza y pintura', en: 'Arts: music, dance & painting' },
    short: { es: 'Nuestro sello: creciendo con las artes.', en: 'Our hallmark: growing up with the arts.' },
    detail: {
      es: 'El arte atraviesa todo lo que hacemos: estimulamos la creatividad, la expresión corporal, la música y las habilidades emocionales desde los primeros años.',
      en: 'Art runs through everything we do: we stimulate creativity, body expression, music and emotional skills from the very first years.',
    },
    includes: [
      { es: 'Música y canto', en: 'Music and singing' },
      { es: 'Danza y expresión corporal', en: 'Dance and body expression' },
      { es: 'Pintura y artes plásticas', en: 'Painting and visual arts' },
      { es: 'Teatro y títeres', en: 'Theatre and puppets' },
    ],
    image: { src: '/images/opt/prog-artes-640.webp', alt: { es: 'Dos niñas en clase de ballet', en: 'Two girls in ballet class' } },
  },
  {
    id: 'ingles',
    icon: Globe2,
    tone: 'indigo',
    title: { es: 'Inglés divertido', en: 'Fun English' },
    short: { es: 'Canciones, juegos y primeras palabras.', en: 'Songs, games and first words.' },
    detail: {
      es: 'Un primer acercamiento al inglés con canciones, cuentos y juegos para que los niños se familiaricen con el idioma de forma natural.',
      en: 'A first approach to English with songs, stories and games so children get familiar with the language naturally.',
    },
    includes: [
      { es: 'Canciones y rimas', en: 'Songs and rhymes' },
      { es: 'Vocabulario con juegos', en: 'Vocabulary through games' },
    ],
    image: { src: '/images/opt/prog-ingles-640.webp', alt: { es: 'Niña sonriente con gafas y la frase I love English', en: 'Smiling girl with glasses and the words I love English' } },
  },
  {
    id: 'vacaciones',
    icon: Sun,
    tone: 'yellow',
    title: { es: 'Vacaciones recreativas', en: 'Holiday camps' },
    short: { es: 'Diversión, magia y arte en temporada de vacaciones.', en: 'Fun, magic and art during the holidays.' },
    detail: {
      es: 'Planes de vacaciones con juegos, shows, manualidades y salidas. Consulta las fechas en nuestro calendario.',
      en: 'Holiday plans with games, shows, crafts and outings. Check the dates in our calendar.',
    },
    includes: [{ es: 'Juegos, shows y manualidades', en: 'Games, shows and crafts' }],
    image: { src: '/images/opt/prog-vacaciones-640.webp', alt: { es: 'Niños disfrazados en un show de magia', en: 'Children in costumes at a magic show' } },
  },
]
