// Runs after `vite build`: removes source-only files from dist/ and checks deploy essentials.
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = 'dist'

// Original photos live in public/images as sources for `npm run images`; the site only uses the optimized versions.
const SOURCE_ONLY = [/^ChatGPT Image/i, /^foto\.jpg$/i, /^perfil\.jpg$/i, /^rafael-pedraza\.png$/i, /^rafael-pedraza-v2\.png$/i, /^front-rafael\.png$/i]
const imagesDir = join(DIST, 'images')
let removed = 0
if (existsSync(imagesDir)) {
  for (const f of readdirSync(imagesDir)) {
    if (SOURCE_ONLY.some((re) => re.test(f))) {
      rmSync(join(imagesDir, f))
      removed++
    }
  }
}
// Never ship local runtime data
const dataDir = join(DIST, 'api', 'data')
if (existsSync(dataDir)) for (const f of readdirSync(dataDir)) if (f.endsWith('.json')) rmSync(join(dataDir, f))

const must = [
  'index.html', '.htaccess', 'robots.txt', 'sitemap.xml', 'site.webmanifest', 'images/og-image.jpg', 'cv/Rafael-Pedraza-CV.pdf', 'cv/.htaccess',
  'api/config.php', 'api/contact.php', 'api/visits.php', 'api/cv.php', 'api/site.php', 'api/auth.php', 'api/experience.php', 'api/stack.php', 'api/subscribe.php', 'api/subscribers.php',
  'api/seed/experience.json', 'api/seed/stack.json',
  'admin/index.html', 'admin/sw.js', 'admin/manifest.webmanifest',
]
const missing = must.filter((f) => !existsSync(join(DIST, f)))

// the admin panel needs a bcrypt hash in config.php
const config = existsSync(join(DIST, 'api/config.php')) ? readFileSync(join(DIST, 'api/config.php'), 'utf8') : ''
if (!/'admin_password_hash'\s*=>\s*'\$2y\$/.test(config)) console.warn('[postbuild] WARNING config.php: admin_password_hash no es un hash bcrypt — el panel no permitirá ingresar')

const size = (dir) => readdirSync(dir).reduce((n, f) => {
  const p = join(dir, f)
  const s = statSync(p)
  return n + (s.isDirectory() ? size(p) : s.size)
}, 0)

console.log(`[postbuild] removed ${removed} source image(s); dist size ${(size(DIST) / 1024 / 1024).toFixed(2)} MB`)
if (missing.length) console.warn(`[postbuild] WARNING missing: ${missing.join(', ')}`)
else console.log('[postbuild] deploy checklist OK')
