import { Brain, ClipboardCheck, Footprints, Heart, MessageCircle, Music2, Palette, Smile, Users, type LucideIcon } from 'lucide-react'
import type { L } from '@/i18n'
import type { Tone } from './programs'

/* ───────────── Quiénes somos ───────────── */
export const about = {
  title: { es: 'Educamos con arte, amor y atención personalizada', en: 'We teach with art, love and personal attention' } as L,
  body: {
    es: 'En Gabush creemos que cada niño aprende a su propio ritmo y desde su autenticidad. Somos un jardín semipersonalizado: cada salón tiene máximo 12 estudiantes, lo que nos permite ofrecer una educación cercana, afectiva y de calidad.',
    en: 'At Gabush we believe every child learns at their own pace and in their own way. We are a small-group kindergarten: each class has at most 12 children, so we can offer close, caring, high-quality education.',
  } as L,
  closing: { es: 'Los niños aprenden jugando, creando y descubriendo el mundo a través del arte.', en: 'Children learn by playing, creating and discovering the world through art.' } as L,
  pillars: [
    { tone: 'pink', title: { es: 'Máximo 12 por salón', en: 'Max. 12 per class' }, text: { es: 'Atención cercana y acompañamiento constante.', en: 'Close attention and constant support.' } },
    { tone: 'blue', title: { es: 'Enfoque en las artes', en: 'Arts focus' }, text: { es: 'Música, danza, pintura y expresión corporal.', en: 'Music, dance, painting and body expression.' } },
    { tone: 'green', title: { es: 'Entorno seguro y amoroso', en: 'Safe, loving place' }, text: { es: 'Espacios pensados para los más pequeños.', en: 'Spaces designed for little ones.' } },
  ] as { tone: Tone; title: L; text: L }[],
}

/* ───────────── Dimensiones del desarrollo (bloques de colores) ───────────── */
export const areas = {
  kicker: { es: 'Creciendo con las artes', en: 'Growing up with the arts' } as L,
  title: { es: 'Así aprenden nuestros niños', en: 'How our children learn' } as L,
  sub: { es: 'Trabajamos todas las dimensiones del desarrollo infantil, con el arte como hilo conductor.', en: 'We work on every dimension of child development, with art as the common thread.' } as L,
  items: [
    { icon: Palette, tone: 'pink', title: { es: 'Artística', en: 'Artistic' }, text: { es: 'Pintar, modelar y crear con libertad.', en: 'Painting, modelling and creating freely.' } },
    { icon: Music2, tone: 'yellow', title: { es: 'Musical', en: 'Musical' }, text: { es: 'Ritmo, canto e instrumentos.', en: 'Rhythm, singing and instruments.' } },
    { icon: Footprints, tone: 'blue', title: { es: 'Corporal', en: 'Physical' }, text: { es: 'Danza, psicomotricidad y juego.', en: 'Dance, motor skills and play.' } },
    { icon: MessageCircle, tone: 'green', title: { es: 'Comunicativa', en: 'Communication' }, text: { es: 'Hablar, escuchar y contar cuentos.', en: 'Speaking, listening and storytelling.' } },
    { icon: Brain, tone: 'orange', title: { es: 'Cognitiva', en: 'Cognitive' }, text: { es: 'Explorar, contar y resolver.', en: 'Exploring, counting and solving.' } },
    { icon: Heart, tone: 'indigo', title: { es: 'Socioafectiva', en: 'Social & emotional' }, text: { es: 'Emociones, amistad y valores.', en: 'Emotions, friendship and values.' } },
  ] as { icon: LucideIcon; tone: Tone; title: L; text: L }[],
}

/* ───────────── Cómo inscribir ───────────── */
export const steps = {
  kicker: { es: 'Inscripciones', en: 'Enrolment' } as L,
  title: { es: '¿Cómo inscribir a tu hijo?', en: 'How to enrol your child' } as L,
  items: [
    { icon: MessageCircle, tone: 'pink', title: { es: 'Escríbenos', en: 'Message us' }, text: { es: 'Por WhatsApp o con el formulario de esta página.', en: 'On WhatsApp or through the form on this page.' } },
    { icon: Users, tone: 'yellow', title: { es: 'Visítanos', en: 'Visit us' }, text: { es: 'Conoce el jardín, los salones y a las profes.', en: 'See the kindergarten, the classrooms and the teachers.' } },
    { icon: ClipboardCheck, tone: 'blue', title: { es: 'Elige el nivel', en: 'Choose the level' }, text: { es: 'Te orientamos según la edad de tu hijo.', en: "We'll guide you according to your child's age." } },
    { icon: Smile, tone: 'green', title: { es: '¡A crecer con las artes!', en: 'Time to grow with the arts!' }, text: { es: 'Tu hijo empieza su aventura en Gabush.', en: 'Your child starts their Gabush adventure.' } },
  ] as { icon: LucideIcon; tone: Tone; title: L; text: L }[],
}

/* ───────────── Testimonios ─────────────
 * Solo testimonios REALES de padres (con su autorización). Mientras la lista esté vacía,
 * la sección no se muestra. Ejemplo:
 * { quote: { es: '…', en: '…' }, author: 'Mamá de Sofía, Jardín' }
 */
export const testimonials: { quote: L; author: string }[] = []

/* ───────────── Preguntas frecuentes ───────────── */
export const faq: { q: L; a: L; hours?: boolean }[] = [
  {
    q: { es: '¿Qué edades reciben?', en: 'What ages do you take?' },
    a: { es: 'Recibimos niños desde Párvulos hasta Transición (aproximadamente de 2 a 6 años). Escríbenos y te orientamos según la edad de tu hijo.', en: 'We take children from Toddlers to Transition (roughly 2 to 6 years). Message us and we will guide you by age.' },
  },
  {
    q: { es: '¿Cuántos niños hay por salón?', en: 'How many children per class?' },
    a: { es: 'Máximo 12. En Párvulos, cada grupo tiene además una auxiliar junto a la docente titular.', en: 'At most 12. In Toddlers, each group also has an assistant alongside the lead teacher.' },
  },
  {
    q: { es: '¿Cuáles son los horarios?', en: 'What are your opening hours?' },
    a: { es: 'De lunes a viernes. Escríbenos para conocer la jornada.', en: 'Monday to Friday. Message us for the timetable.' },
    /** se reemplaza en vivo por el horario configurado en el panel de administración */
    hours: true,
  },
  {
    q: { es: '¿Está aprobado por la Secretaría de Educación?', en: 'Is it officially licensed?' },
    a: { es: 'Sí. Licencia de funcionamiento Resolución N.° 000375 del 22/04/2021 · Código DANE 320001800480.', en: 'Yes. Operating licence Resolution No. 000375 of 22/04/2021 · DANE code 320001800480.' },
  },
  {
    q: { es: '¿Cuánto cuesta?', en: 'How much does it cost?' },
    a: { es: 'El valor de la matrícula y la pensión depende del nivel y la jornada. Escríbenos por WhatsApp y te enviamos la información completa del año.', en: 'Enrollment and tuition depend on the level and the schedule. Message us on WhatsApp and we will send you all the details for the year.' },
  },
]
