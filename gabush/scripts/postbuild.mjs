// Runs after `vite build`: removes source-only files from dist/ and checks deploy essentials.
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'

// Originals in public/ are only inputs for `npm run images`; the site uses the optimized versions.
const SOURCE_ONLY = readdirSync(join('public', 'images'))
  .filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && f !== 'og-image.jpg')
  .map((f) => join('images', f))
let removed = 0
for (const f of SOURCE_ONLY) {
  const p = join(DIST, f)
  if (existsSync(p)) {
    rmSync(p)
    removed++
  }
}
// Never ship local runtime data
const dataDir = join(DIST, 'api', 'data')
if (existsSync(dataDir)) for (const f of readdirSync(dataDir)) if (f.endsWith('.json')) rmSync(join(dataDir, f))
for (const d of ['photos', 'feed']) if (existsSync(join(dataDir, d))) rmSync(join(dataDir, d), { recursive: true })

const must = [
  'index.html',
  '.htaccess',
  'robots.txt',
  'sitemap.xml',
  'site.webmanifest',
  'favicon-32.png',
  'images/og-image.jpg',
  'images/opt/logo-480.webp',
  'images/opt/lion-400.webp',
  'images/feed/01-480.webp',
  'api/contact.php',
  'api/visits.php',
  'api/auth.php',
  'api/events.php',
  'api/settings.php',
  'api/students.php',
  'api/photo.php',
  'api/feed.php',
  'api/users.php',
  'api/attendance.php',
  'api/billing.php',
  'api/inscriptions.php',
  'api/push.php',
  'api/backup.php',
  'api/cron.php',
  'api/_push.php',
  'api/_reports.php',
  'admin/index.html',
  'admin/manifest.webmanifest',
  'admin/sw.js',
  'api/config.php',
]
const missing = must.filter((f) => !existsSync(join(DIST, f)))

const size = (dir) =>
  readdirSync(dir).reduce((n, f) => {
    const p = join(dir, f)
    const s = statSync(p)
    return n + (s.isDirectory() ? size(p) : s.size)
  }, 0)

console.log(`[postbuild] removed ${removed} source file(s); dist size ${(size(DIST) / 1024 / 1024).toFixed(2)} MB`)
if (missing.length) console.warn(`[postbuild] WARNING missing: ${missing.join(', ')}`)
else console.log('[postbuild] deploy checklist OK')

// The calendar admin needs a user + password hash in api/config.php
const cfg = join(DIST, 'api', 'config.php')
if (existsSync(cfg) && !/'admin_password_hash'\s*=>\s*'\$2y\$/.test(readFileSync(cfg, 'utf8')))
  console.warn('[postbuild] WARNING calendar admin not configured — run: npm run admin-password -- <usuario> <contraseña>')
