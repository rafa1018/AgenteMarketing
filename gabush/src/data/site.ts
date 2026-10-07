import type { L } from '@/i18n'

/**
 * Datos generales del jardín — tomados de gabushkids.com (sitio anterior) y del aviso de la fachada.
 * Los valores entre corchetes, p. ej. "[AGREGAR PRECIOS]", son placeholders visibles:
 * reemplázalos por el dato real y desaparecerá el recuadro naranja en la página.
 */
export const site = {
  name: 'Gabush Kids',
  fullName: 'Jardín Infantil Gabush Kids',
  url: 'https://gabushkids.com',

  /** Recepción / WhatsApp */
  whatsapp: '573228347109',
  phoneDisplay: '+57 322 834 7109',
  email: 'gabushjardin@gmail.com',

  city: 'Valledupar, Cesar',
  address: 'Manzana E 19-12A, Urbanización Colombia',
  /** Licencia de funcionamiento (aviso de la fachada) */
  license: 'Resolución N.° 000375 del 22/04/2021',
  dane: '320001800480',

  schedule: { es: 'Lunes a viernes', en: 'Monday to Friday' } as L,

  socials: {
    facebook: 'https://www.facebook.com/gabush.infantil',
    instagram: 'https://www.instagram.com/jardin_gabush',
  },
  instagramHandle: '@jardin_gabush',

  /** Frase principal */
  slogan: {
    es: 'Un jardín semipersonalizado donde cada niño aprende a su ritmo, jugando, creando y descubriendo el mundo a través del arte.',
    en: 'A small-group kindergarten where every child learns at their own pace — playing, creating and discovering the world through art.',
  } as L,
  motto: { es: 'Creciendo con las artes', en: 'Growing up with the arts' } as L,

  whatsappMessage: {
    es: 'Hola, quiero información sobre el Jardín Infantil Gabush Kids 🦁',
    en: "Hi, I'd like information about Gabush Kids kindergarten 🦁",
  } as L,
}

export const whatsappLink = (text: string) => `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`
export const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${site.address}, ${site.city}, Colombia`)}`
