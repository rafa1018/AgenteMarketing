// Gabush lion mascot → WebP for the site (navbar, preloader, app intro, feed avatar), favicons and PWA icons.
// Run with: npm run lion   (also part of `npm run images`)
//
// Source: public/images/animals/leon-asomado.png (transparent, the lion peeking with its paws in front).
// Its alpha is "almost" opaque all over (224–254) with a faint haze around it, so it is cleaned first:
// near-opaque → opaque, near-transparent → transparent.
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const SRC = 'public/images/animals/leon-asomado.png'
const OUT = 'public/images/opt'
await mkdir(OUT, { recursive: true })

const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
for (let i = 3; i < data.length; i += 4) {
  if (data[i] >= 216) data[i] = 255
  else if (data[i] < 40) data[i] = 0
}
const lionBuf = await sharp(data, { raw: info }).trim({ threshold: 1 }).png().toBuffer()
const lion = sharp(lionBuf)
const { width, height } = await lion.metadata()

for (const w of [200, 400, 640]) await lion.clone().resize({ width: w }).webp({ quality: 88, alphaQuality: 95 }).toFile(`${OUT}/leon-asomado-${w}.webp`)
// small mark next to the GABUSH blocks (navbar, admin, feed avatar): the whole lion, it is mostly head
await lion.clone().resize({ width: 160 }).webp({ quality: 90, alphaQuality: 95 }).toFile(`${OUT}/leon-asomado-160.webp`)

const clear = { r: 0, g: 0, b: 0, alpha: 0 }
async function icon(size, file, pad, bg) {
  const inner = Math.round(size * (1 - pad * 2))
  const img = await sharp(lionBuf).resize(inner, inner, { fit: 'contain', background: clear }).png().toBuffer()
  const tile = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" fill="${bg}"/></svg>`)
  await sharp(tile).composite([{ input: img, gravity: 'center' }]).png().toFile(file)
}
await icon(32, 'public/favicon-32.png', 0.02, '#fff8e7')
await icon(48, 'public/favicon-48.png', 0.02, '#fff8e7')
// App icons (installed admin panel): full-bleed sky blue — the same colour as the app's splash screen
// (manifest background_color), so Android's circle crop blends in — and the lion inside the safe zone.
const APP_BG = '#bfe8ff'
await icon(180, 'public/apple-touch-icon.png', 0.12, APP_BG)
await icon(192, 'public/icon-192.png', 0.16, APP_BG)
await icon(512, 'public/icon-512.png', 0.16, APP_BG)
// Android only shows the central ~66 % circle of a maskable icon (launcher and launch screen)
await icon(512, 'public/icon-maskable-512.png', 0.24, APP_BG)

console.log(`[lion] ${width}×${height} → leon-asomado-{160,200,400,640}, favicons, PWA icons`)
