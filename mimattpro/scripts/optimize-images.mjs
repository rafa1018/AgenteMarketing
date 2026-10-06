// npm run images — builds web-sized versions of the brand images in public/images.
//   logo.png (1.4 MB source)  → logo-128.webp, logo-256.webp, logo-512.png (og), favicon-32.png, apple-touch-icon.png
//   descarga.png (robot)      → robot.webp
import sharp from 'sharp'

const dir = 'public/images'
const logo = sharp(`${dir}/logo.png`).trim() // remove empty transparent margins

await logo.clone().resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 90 }).toFile(`${dir}/logo-128.webp`)
await logo.clone().resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({ quality: 90 }).toFile(`${dir}/logo-256.webp`)
await logo.clone().resize(512, 512, { fit: 'contain', background: { r: 5, g: 11, b: 22, alpha: 1 } }).png({ compressionLevel: 9 }).toFile(`${dir}/logo-512.png`)
await logo.clone().resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(`${dir}/favicon-32.png`)
await logo.clone().resize(180, 180, { fit: 'contain', background: { r: 5, g: 11, b: 22, alpha: 1 } }).png().toFile(`${dir}/apple-touch-icon.png`)
await sharp(`${dir}/descarga.png`).webp({ quality: 92 }).toFile(`${dir}/robot.webp`)

console.log('[images] logo + robot optimized')
