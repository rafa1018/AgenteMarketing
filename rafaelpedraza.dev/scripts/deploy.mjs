// Publishes dist/ to Hostinger over SSH (key auth, no passwords):
//   npm run deploy        → build + upload + check
// Settings live in .deploy.local.json (never committed):
//   { "host": "IP", "port": 65002, "user": "u668220027", "remoteDir": "domains/rafaelpedraza.dev/public_html",
//     "key": "~/.ssh/hostinger_grandesgenios", "url": "https://rafaelpedraza.dev" }
// Only public_html is written. The data folder (rp-data, next to public_html) is never touched.
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const CFG_FILE = '.deploy.local.json'
if (!existsSync(CFG_FILE)) {
  console.error(`[deploy] falta ${CFG_FILE} (host, port, user, remoteDir, key, url)`)
  process.exit(1)
}
const cfg = JSON.parse(readFileSync(CFG_FILE, 'utf8'))
for (const k of ['host', 'port', 'user', 'remoteDir', 'key', 'url']) {
  if (!cfg[k]) {
    console.error(`[deploy] ${CFG_FILE}: falta "${k}"`)
    process.exit(1)
  }
}
if (!existsSync('dist/index.html') || !existsSync('dist/admin/index.html') || !existsSync('dist/api/config.php')) {
  console.error('[deploy] dist/ incompleto — corre `npm run build` primero')
  process.exit(1)
}

const key = cfg.key.replace(/^~/, homedir())
const dir = cfg.remoteDir.replace(/[^\w./-]/g, '')
const ssh = ['-i', key, '-p', String(cfg.port), '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=accept-new', `${cfg.user}@${cfg.host}`]

function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: [input ? 'pipe' : 'inherit', 'inherit', 'inherit'] })
    if (input) input.stdout.pipe(p.stdin)
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} terminó con código ${code}`))))
  })
}

// Safety: this hosting account has several sites. Only ever write into the rafaelpedraza.dev folder,
// and only if what is there now is this site (or the folder is empty).
if (!dir.includes('rafaelpedraza.dev/public_html')) {
  console.error(`[deploy] destino inesperado "${dir}" — debe ser domains/rafaelpedraza.dev/public_html`)
  process.exit(1)
}
await run('ssh', [...ssh, `test -d '${dir}' || exit 3; [ -z "$(ls -A '${dir}')" ] && exit 0; grep -q 'Rafael Pedraza' '${dir}/index.html' || exit 4`]).catch(() => {
  console.error(`[deploy] ${dir} no existe o no contiene el sitio de Rafael Pedraza — no se subió nada`)
  process.exit(1)
})

const started = Date.now()
console.log(`[deploy] subiendo dist/ → ${cfg.user}@${cfg.host}:${dir}`)
// stream a tar of dist/ through ssh and unpack it over public_html (existing files are replaced, data is elsewhere)
const tar = spawn('tar', ['-C', 'dist', '-cf', '-', '.'], { stdio: ['ignore', 'pipe', 'inherit'] })
await run('ssh', [...ssh, `mkdir -p '${dir}' && tar -xf - -C '${dir}' && find '${dir}/assets' -type f -mtime +7 -delete 2>/dev/null; echo "[deploy] archivos en el servidor: $(find '${dir}' -type f | wc -l)"`], tar)

// quick health check of the live site
for (const path of ['/', '/admin/', '/api/site.php', '/api/visits.php']) {
  const res = await fetch(cfg.url + path, { cache: 'no-store' }).catch(() => null)
  console.log(`[deploy] ${path.padEnd(18)} ${res ? res.status : 'sin respuesta'}`)
}
console.log(`[deploy] listo en ${((Date.now() - started) / 1000).toFixed(1)} s`)
