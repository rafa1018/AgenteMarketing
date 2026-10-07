// Generates optimized web assets from the original files in public/images.
// Run with: npm run images
// - logo.png (GABUSH block letters) → wordmark WebP/PNG
// - 22bd…png (lion, high-res) → mascot WebP, favicons and PWA icons
// - anim-icon-*.png → floating decorations (WebP)
// - slider-gabushkids.jpg + real photos → hero / gallery / programs (WebP)
// - 01…05.jpg → initial Instagram-style feed (the admin panel manages it afterwards)
// - og-image.jpg (1200×630) share image → scripts/og-image.mjs
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const IN = 'public/images'
const OUT = 'public/images/opt'
const FEED = 'public/images/feed'
await mkdir(OUT, { recursive: true })
await mkdir(FEED, { recursive: true })

const C = { cream: '#fff8e7', sky: '#e6f6ff' }
const clear = { r: 0, g: 0, b: 0, alpha: 0 }

/* ── Wordmark ── */
const logo = sharp(`${IN}/logo.png`).trim({ threshold: 2 })
for (const w of [240, 480]) await logo.clone().resize({ width: w }).webp({ quality: 90, alphaQuality: 95 }).toFile(`${OUT}/logo-${w}.webp`)
await logo.clone().resize({ width: 480 }).png({ compressionLevel: 9 }).toFile(`${OUT}/logo-480.png`)

/* ── Lion mascot ── */
const LION = `${IN}/22bd0015-2767-436c-8899-319733bc63a3_20251013_203745_0000.png`
const lion = sharp(existsSync(LION) ? LION : `${IN}/gabushV2.png`).trim({ threshold: 2 })
for (const w of [200, 400, 640]) await lion.clone().resize({ width: w }).webp({ quality: 88, alphaQuality: 95 }).toFile(`${OUT}/lion-${w}.webp`)
// waving lion (other pose)
for (const w of [200, 400]) await sharp(`${IN}/gabushV2.png`).trim({ threshold: 2 }).resize({ width: w }).webp({ quality: 90 }).toFile(`${OUT}/lion-wave-${w}.webp`)

// Head only (top ~52 %) → favicons: legible at 16 px
const lm = await lion.clone().png().toBuffer().then((b) => sharp(b).metadata())
const lionBuf = await lion.clone().png().toBuffer()
const head = await sharp(lionBuf).extract({ left: 0, top: 0, width: lm.width, height: Math.round(lm.height * 0.5) }).trim({ threshold: 2 }).png().toBuffer()
await sharp(head).resize({ width: 160 }).webp({ quality: 90 }).toFile(`${OUT}/lion-head-160.webp`)

async function icon(size, file, pad = 0.08, bg = C.cream, rounded = true, art = head) {
  const inner = Math.round(size * (1 - pad * 2))
  const img = await sharp(art).resize(inner, inner, { fit: 'contain', background: clear }).png().toBuffer()
  const r = rounded ? Math.round(size * 0.22) : 0
  const tile = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" fill="${bg}"/></svg>`)
  await sharp(tile).composite([{ input: img, gravity: 'center' }]).png().toFile(file)
}
await icon(32, 'public/favicon-32.png', 0.02, C.cream, false)
await icon(48, 'public/favicon-48.png', 0.02, C.cream, false)
// App icons (installed admin panel): full-bleed sky blue — the same colour as the app's splash screen
// (manifest background_color), so Android's circle crop blends in — and the lion inside the safe zone.
const APP_BG = '#bfe8ff'
// The whole lion (not just the head, which looks cut off at this size).
await icon(180, 'public/apple-touch-icon.png', 0.12, APP_BG, false, lionBuf)
await icon(192, 'public/icon-192.png', 0.16, APP_BG, false, lionBuf)
await icon(512, 'public/icon-512.png', 0.16, APP_BG, false, lionBuf)
// Android only shows the central ~66 % circle of a maskable icon (launcher and launch screen):
// the whole lion must fit inside it, so it gets a wide margin here.
await icon(512, 'public/icon-maskable-512.png', 0.27, APP_BG, false, lionBuf)

/* ── Floating decorations ── */
for (const n of [1, 2, 3, 5, 6, 7, 8, 9, 10, 11, 16]) {
  const src = `${IN}/anim-icon-${n}.png`
  if (existsSync(src)) await sharp(src).webp({ quality: 88, alphaQuality: 95 }).toFile(`${OUT}/anim-${n}.webp`)
}

/* ── Photos ── */
async function photo(src, name, widths, { square = false, quality = 76 } = {}) {
  if (!existsSync(`${IN}/${src}`)) return
  for (const w of widths) {
    let p = sharp(`${IN}/${src}`).rotate()
    p = square ? p.resize(w, w, { fit: 'cover', position: 'attention' }) : p.resize({ width: w, withoutEnlargement: true })
    await p.webp({ quality }).toFile(`${OUT}/${name}-${w}.webp`)
  }
}
// hero: the real façade
await photo('slider-gabushkids.jpg', 'hero-fachada', [960, 1600], { quality: 78 })
// gallery: real photos of the kindergarten
await photo('IMG-20250909-WA0140.jpg', 'espacio-salon', [640, 1280])
await photo('IMG-20250423-WA0017.jpg', 'espacio-psico', [640, 1280])
await photo('IMG-20250423-WA0014.jpg', 'espacio-arte', [640, 1280])
await photo('IMG-20250801-WA0051.jpg', 'espacio-salida', [640, 1280])
await photo('slider-6.jpg', 'espacio-fachada', [640, 1280])
await photo('IMG-20250912-WA0070.jpg', 'espacio-promo', [640, 1280])
// programmes (illustrative)
await photo('class-1.jpg', 'prog-parvulos', [640])
await photo('class-5.jpg', 'prog-prejardin', [640])
await photo('class-8.png', 'prog-jardin', [640])
await photo('IMG-20250909-WA0140.jpg', 'prog-transicion', [640])
await photo('class-3.jpeg', 'prog-artes', [640])
await photo('class-4.jpeg', 'prog-ingles', [640])
await photo('class-7.jpg', 'prog-vacaciones', [640])
// about: the shield
await photo('about-1.jpg', 'escudo', [400], { quality: 85 })
// kids cut-out (CTA band)
if (existsSync(`${IN}/kids.webp`)) await sharp(`${IN}/kids.webp`).resize({ width: 640 }).webp({ quality: 82, alphaQuality: 95 }).toFile(`${OUT}/kids-640.webp`)
// landscapes: grass strip (footer / hero ground) and sky meadow
// the strip has an opaque blue sky: key it out so the hills sit on any background
{
  const src = sharp(`${IN}/footer-gabushkids.png`).resize({ width: 2000 })
  const meta = await src.clone().metadata()
  const top = Math.round((meta.height * 2000) / meta.width * 0.3)
  const { data, info } = await src.extract({ left: 0, top, width: 2000, height: Math.round((meta.height * 2000) / meta.width) - top }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]]
    if (b > g + 8 && b > r + 50) data[i + 3] = 0 // sky
    else if (b > g - 6 && b > r + 30) data[i + 3] = 120 // anti-aliased edge
  }
  // keep only the trees + hills band (2000×260): the page fills the rest with the same green
  const band = await sharp(data, { raw: info }).extract({ left: 0, top: 45, width: 2000, height: 260 }).png().toBuffer()
  const grass = sharp(band)
  await grass.clone().webp({ quality: 80, alphaQuality: 90 }).toFile(`${OUT}/grass-2000.webp`)
  await grass.clone().resize({ width: 1000 }).webp({ quality: 80, alphaQuality: 90 }).toFile(`${OUT}/grass-1000.webp`)
}
await sharp(`${IN}/fondo-clubinfantil.jpg`).resize({ width: 1800 }).webp({ quality: 74 }).toFile(`${OUT}/meadow-1800.webp`)

/* ── Initial feed (square, Instagram-like) ── */
for (const n of ['01', '02', '03', '04', '05']) {
  const src = `${IN}/${n}.jpg`
  if (!existsSync(src)) continue
  for (const w of [480, 1080]) await sharp(src).rotate().resize(w, w, { fit: 'cover', withoutEnlargement: false }).webp({ quality: 80 }).toFile(`${FEED}/${n}-${w}.webp`)
}

/* ── Open Graph 1200×630 (share image) ── */
await import('./og-image.mjs')

console.log('[images] done')
