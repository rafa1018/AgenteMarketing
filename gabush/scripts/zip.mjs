// Packs dist/ into gabush-hostinger.zip (forward-slash paths, includes dotfiles like .htaccess).
// Upload the zip to Hostinger → public_html and extract it there.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'

const OUT = 'gabush-hostinger.zip'
if (!existsSync('dist/index.html')) {
  console.error('[zip] dist/ not found — run `npm run build` first')
  process.exit(1)
}
if (existsSync(OUT)) rmSync(OUT)
// bsdtar (Windows 10+ / macOS) writes a real zip with "/" separators when given -a and a .zip name
// list top-level entries explicitly (incl. dotfiles) so paths have no './' prefix
execFileSync('tar', ['-a', '-c', '-f', `../${OUT}`, ...readdirSync('dist')], { cwd: 'dist', stdio: 'inherit' })
console.log(`[zip] ${OUT} — ${(statSync(OUT).size / 1024 / 1024).toFixed(2)} MB`)
