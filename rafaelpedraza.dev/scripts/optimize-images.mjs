// Generates optimized web assets from the original photos in public/images.
// Run with: npm run images
// - Portrait: prefers rafael-pedraza-v2.png (transparent cut-out). The v1 photo only gets its
//   bottom 8% cropped (generator watermark). The face is never altered.
// - Produces WebP variants, an Open Graph card and favicons.
import sharp from 'sharp'
import { readFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'

const V2 = 'public/images/rafael-pedraza-v2.png'
const V1 = 'public/images/rafael-pedraza.png'
const SRC = existsSync(V2) ? V2 : V1
const isCutout = SRC === V2
const OUT = 'public/images'

if (!existsSync(SRC)) {
  console.warn(`[images] ${SRC} not found — skipping. Add your photo and re-run.`)
  process.exit(0)
}

await mkdir(OUT, { recursive: true })
const meta = await sharp(SRC).metadata()
const cropH = isCutout ? meta.height : Math.round(meta.height * 0.92) // v1: drop watermark area
const base = sharp(SRC).extract({ left: 0, top: 0, width: meta.width, height: cropH })

for (const w of [480, 760]) {
  await base.clone().resize({ width: w }).webp({ quality: 84, alphaQuality: 90 }).toFile(`${OUT}/rafael-pedraza-${w}.webp`)
}
await base.clone().resize({ width: 760 }).flatten({ background: '#03060c' }).jpeg({ quality: 80, mozjpeg: true }).toFile(`${OUT}/rafael-pedraza-760.jpg`)

// Face crop for the "Engineering Profile" card
const fx = Math.round(meta.width * (isCutout ? 0.27 : 0.29))
const fy = Math.round(meta.height * (isCutout ? 0.035 : 0.03))
const fs = Math.round(meta.width * (isCutout ? 0.44 : 0.42))
await sharp(SRC).flatten({ background: '#0a1426' }).extract({ left: fx, top: fy, width: fs, height: fs }).resize(320).webp({ quality: 82 }).toFile(`${OUT}/rafael-pedraza-face.webp`)

// Open Graph card 1200x630
const photo = await base.clone().resize({ height: 630 }).toBuffer()
const photoMeta = await sharp(photo).metadata()
const ogSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <radialGradient id="g" cx="78%" cy="40%" r="60%"><stop offset="0" stop-color="#0d2a55"/><stop offset="1" stop-color="#03060d"/></radialGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#1b3355" stroke-width="1" opacity=".35"/></pattern>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <rect width="1200" height="630" fill="url(#grid)"/>
  <text x="72" y="120" font-family="Consolas, monospace" font-size="20" letter-spacing="6" fill="#4fd1ff">INGENIERO DE SISTEMAS · +10 AÑOS</text>
  <text x="68" y="250" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="104" fill="#eef3fb">RAFAEL</text>
  <text x="68" y="360" font-family="Segoe UI, Arial, sans-serif" font-weight="700" font-size="104" fill="#2f8cff">PEDRAZA</text>
  <text x="72" y="430" font-family="Consolas, monospace" font-size="22" letter-spacing="3" fill="#9fb2cc">INGENIERO DE SOFTWARE · ARQUITECTURA</text>
  <text x="72" y="466" font-family="Consolas, monospace" font-size="22" letter-spacing="3" fill="#9fb2cc">.NET · ANGULAR · ORACLE · CLOUD</text>
  <rect x="72" y="520" width="120" height="2" fill="#2f8cff"/>
  <text x="72" y="566" font-family="Segoe UI, Arial, sans-serif" font-size="24" fill="#eef3fb">rafaelpedraza.dev</text>
</svg>`
const fade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${photoMeta.width}" height="630"><defs><linearGradient id="f" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".35" stop-color="#fff"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#f)"/></svg>`)
const maskedPhoto = await sharp(photo).composite([{ input: fade, blend: 'dest-in' }]).png().toBuffer()
await sharp(Buffer.from(ogSvg))
  .composite([{ input: maskedPhoto, left: 1200 - photoMeta.width, top: 0 }])
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(`${OUT}/og-image.jpg`)

// Favicons from SVG
const fav = await readFile('public/favicon.svg')
await sharp(fav, { density: 512 }).resize(180).png().toFile('public/apple-touch-icon.png')
await sharp(fav, { density: 512 }).resize(32).png().toFile('public/favicon-32.png')

console.log('[images] done')
