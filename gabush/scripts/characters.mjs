// Gabush characters (lion, elephant, tiger, rabbit, bear, owl) for the blinking-mascot component.
// Run with: npm run characters   (also at the end of `npm run images`)
//
// Source: public/images/animals/<animal>-saludo-ojos-abiertos.png / -ojos-cerrados.png (white background).
// The two AI-drawn frames differ slightly all over (outlines a few px apart), so swapping whole images
// would make the body "shake" on every blink. Instead the closed frame is built from the OPEN one with
// only the eyes pasted in from the closed image (soft-edged patch), and both share one cut-out mask:
// everything except the eyes is identical pixel for pixel.
//
// Output: public/images/characters/<animal>-{open|closed}-{480|800}.webp  (transparent background)
import sharp from 'sharp'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'

const IN = 'public/images/animals'
const OUT = 'public/images/characters'
const ANIMALS = ['leon', 'elefante', 'tigre', 'conejo', 'oso', 'buho']
const WIDTHS = [480, 800]
// Manual eye boxes [x0, y0, x1, y1] (source pixels) where auto-detection fails: the tiger's stripes
// differ a lot between its two drawings, so the difference blobs don't land on the eyes.
const EYES = {
  tigre: [
    [398, 238, 520, 362],
    [662, 292, 786, 418],
  ],
}
await mkdir(OUT, { recursive: true })

/**
 * Background = light, grey (unsaturated) pixels connected to the image border (flood fill). Pure white
 * becomes transparent; the soft grey floor shadow keeps a partial alpha so it stays a real shadow.
 * Returns alpha 0..255.
 */
function cutoutAlpha(data, w, h, c, keepShadow = true) {
  const isBg = (i) => {
    const r = data[i], g = data[i + 1], b = data[i + 2]
    const max = Math.max(r, g, b), min = Math.min(r, g, b)
    return min > 170 && max - min < 22
  }
  const bgAlpha = (i) => {
    const light = (data[i] + data[i + 1] + data[i + 2]) / 3
    return light >= 244 || !keepShadow ? 0 : Math.min(150, Math.round((244 - light) * 5))
  }
  const alpha = new Uint8Array(w * h).fill(255)
  const seen = new Uint8Array(w * h)
  const stack = []
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x)
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1)
  while (stack.length) {
    const p = stack.pop()
    if (seen[p]) continue
    seen[p] = 1
    if (!isBg(p * c)) continue
    alpha[p] = bgAlpha(p * c)
    const x = p % w, y = (p / w) | 0
    if (x > 0) stack.push(p - 1)
    if (x < w - 1) stack.push(p + 1)
    if (y > 0) stack.push(p - w)
    if (y < h - 1) stack.push(p + w)
  }
  // soften the edge: border pixels next to background get partial alpha by how light they are
  const out = new Uint8Array(alpha)
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x
      if (alpha[p] !== 255) continue // background / shadow pixels keep their alpha
      if (alpha[p - 1] === 255 && alpha[p + 1] === 255 && alpha[p - w] === 255 && alpha[p + w] === 255) continue
      const i = p * c
      const light = (data[i] + data[i + 1] + data[i + 2]) / 3
      out[p] = light > 200 ? Math.max(60, Math.round(255 - (light - 200) * 3.5)) : 255
    }
  return out
}

/** Eye areas: dense blobs of difference between the two frames inside the head. Returns a soft mask 0..1. */
function eyeMask(A, B, w, h, c, override) {
  const CELL = 12
  const gw = Math.ceil(w / CELL), gh = Math.ceil(h / CELL)
  const dens = new Float32Array(gw * gh)
  const y0 = Math.round(h * 0.06), y1 = Math.round(h * 0.5), x0 = Math.round(w * 0.1), x1 = Math.round(w * 0.9)
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * c
      const d = Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2])
      if (d > 70) dens[((y / CELL) | 0) * gw + ((x / CELL) | 0)] += 1 / (CELL * CELL)
    }
  // connected groups of dense cells
  const hot = dens.map((v) => (v > 0.3 ? 1 : 0))
  const label = new Int32Array(gw * gh).fill(-1)
  const blobs = []
  for (let k = 0; k < gw * gh; k++) {
    if (!hot[k] || label[k] >= 0) continue
    const st = [k]
    const b = { n: 0, x0: 1e9, y0: 1e9, x1: -1, y1: -1 }
    label[k] = blobs.length
    while (st.length) {
      const q = st.pop()
      const qx = q % gw, qy = (q / gw) | 0
      b.n++
      b.x0 = Math.min(b.x0, qx); b.x1 = Math.max(b.x1, qx); b.y0 = Math.min(b.y0, qy); b.y1 = Math.max(b.y1, qy)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = qx + dx, ny = qy + dy
        if (nx < 0 || ny < 0 || nx >= gw || ny >= gh) continue
        const nq = ny * gw + nx
        if (hot[nq] && label[nq] < 0) {
          label[nq] = blobs.length
          st.push(nq)
        }
      }
    }
    blobs.push(b)
  }
  const eyes = blobs.sort((a, b) => b.n - a.n).slice(0, 2).map((b) => [b.x0 * CELL, b.y0 * CELL, (b.x1 + 1) * CELL, (b.y1 + 1) * CELL])
  return softEyes(override ?? eyes, w, h)
}

/** Soft mask 0..1: a padded, feathered ellipse around each eye box [x0, y0, x1, y1]. */
function softEyes(eyes, w, h) {
  const mask = new Float32Array(w * h)
  for (const [x0, y0, x1, y1] of eyes) {
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
    const rx = (x1 - x0) / 2 + 22, ry = (y1 - y0) / 2 + 22
    for (let y = Math.max(0, Math.floor(cy - ry - 16)); y < Math.min(h, cy + ry + 16); y++)
      for (let x = Math.max(0, Math.floor(cx - rx - 16)); x < Math.min(w, cx + rx + 16); x++) {
        const d = Math.hypot((x - cx) / rx, (y - cy) / ry) // 1 = ellipse edge
        const m = d <= 0.85 ? 1 : d >= 1.15 ? 0 : 1 - (d - 0.85) / 0.3
        const p = y * w + x
        if (m > mask[p]) mask[p] = m
      }
  }
  return { mask, eyes }
}

for (const name of ANIMALS) {
  const openF = `${IN}/${name}-saludo-ojos-abiertos.png`
  const closedF = `${IN}/${name}-saludo-ojos-cerrados.png`
  if (!existsSync(openF) || !existsSync(closedF)) {
    console.warn(`[characters] falta ${name}`)
    continue
  }
  const A = await sharp(openF).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const B = await sharp(closedF).removeAlpha().resize(A.info.width, A.info.height).raw().toBuffer()
  const { width: w, height: h, channels: c } = A.info
  const alpha = cutoutAlpha(A.data, w, h, c)
  const { mask, eyes } = eyeMask(A.data, B, w, h, c, EYES[name])

  const open = Buffer.alloc(w * h * 4)
  const closed = Buffer.alloc(w * h * 4)
  for (let p = 0; p < w * h; p++) {
    const i = p * c, o = p * 4, m = mask[p]
    for (let k = 0; k < 3; k++) {
      open[o + k] = A.data[i + k]
      closed[o + k] = Math.round(A.data[i + k] * (1 - m) + B[i + k] * m)
    }
    open[o + 3] = closed[o + 3] = alpha[p]
  }
  // trim both with the SAME box so they stay aligned
  const meta = await sharp(open, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 1 }).toBuffer({ resolveWithObject: true })
  const box = { left: -meta.info.trimOffsetLeft, top: -meta.info.trimOffsetTop, width: meta.info.width, height: meta.info.height }
  for (const [frame, buf] of [['open', open], ['closed', closed]]) {
    for (const width of WIDTHS) {
      await sharp(buf, { raw: { width: w, height: h, channels: 4 } }).extract(box).resize({ width }).webp({ quality: 86, alphaQuality: 92 }).toFile(`${OUT}/${name}-${frame}-${width}.webp`)
    }
  }
  console.log(`[characters] ${name}: ${box.width}×${box.height} · ojos ${JSON.stringify(eyes)}`)
}

// Single poses (no blink): cut out without the floor shadow — the page draws its own, so a jumping
// character can move away from it. Output: public/images/characters/<pose>-{240|480}.webp
const POSES = ['leon-saltando', 'tigre-saltando']
for (const pose of POSES) {
  const { data, info } = await sharp(`${IN}/${pose}.png`).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width: w, height: h, channels: c } = info
  const alpha = cutoutAlpha(data, w, h, c, false)
  const rgba = Buffer.alloc(w * h * 4)
  for (let p = 0; p < w * h; p++) {
    for (let k = 0; k < 3; k++) rgba[p * 4 + k] = data[p * c + k]
    rgba[p * 4 + 3] = alpha[p]
  }
  const img = sharp(rgba, { raw: { width: w, height: h, channels: 4 } }).trim({ threshold: 1 })
  const buf = await img.png().toBuffer()
  for (const width of [240, 480]) await sharp(buf).resize({ width }).webp({ quality: 86, alphaQuality: 92 }).toFile(`${OUT}/${pose}-${width}.webp`)
  const m = await sharp(buf).metadata()
  console.log(`[characters] ${pose}: ${m.width}×${m.height}`)
}
