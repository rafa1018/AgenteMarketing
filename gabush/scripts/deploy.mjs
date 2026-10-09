// Publishes dist/ to Hostinger over SSH (key auth, no passwords):
//   npm run deploy                        → build + upload + check
//   npm run deploy -- --replace-wordpress → ONLY the first time: moves the old WordPress site
//                                           (files + database dump) to ~/backups/gabushkids/ and publishes
// Settings live in .deploy.local.json (never committed):
//   { "host": "IP", "port": 65002, "user": "u668220027", "remoteDir": "domains/gabushkids.com/public_html",
//     "key": "~/.ssh/hostinger_grandesgenios", "url": "https://gabushkids.com" }
//
// Data safety:
// - Only public_html is written. The data folder (domains/gabushkids.com/gabush-data: students, attendance,
//   payments, users, feed photos…) is NEVER touched by a deploy, and local test data is never uploaded.
// - api/config.php on the server (production secrets, owner password) is kept: it is only uploaded
//   when it does not exist yet.
// - Nothing is deleted: the old WordPress is moved (not removed) to a dated backup folder outside the web.
import { spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const CFG_FILE = '.deploy.local.json'
const REPLACE_WP = process.argv.includes('--replace-wordpress')
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
    p.on('close', (code) => (code === 0 ? resolve(code) : reject(Object.assign(new Error(`${cmd} terminó con código ${code}`), { code }))))
  })
}

// Safety: this hosting account has several sites. Only ever write into the Gabush Kids folder.
if (dir !== 'domains/gabushkids.com/public_html') {
  console.error(`[deploy] destino inesperado "${dir}" — debe ser domains/gabushkids.com/public_html`)
  process.exit(1)
}

// What is there now? 0 = empty or our site · 5 = the old WordPress · 4 = something else
const state = await run('ssh', [...ssh, `test -d '${dir}' || exit 0; [ -z "$(ls -A '${dir}')" ] && exit 0; grep -qs 'Gabush Kids' '${dir}/index.html' && exit 0; test -f '${dir}/wp-config.php' && exit 5; exit 4`]).catch((e) => e.code)

if (state === 5 && !REPLACE_WP) {
  console.error('[deploy] En el servidor está el WordPress anterior. No se subió nada.')
  console.error('         Para reemplazarlo (se guarda una copia completa primero): npm run deploy -- --replace-wordpress')
  process.exit(1)
}
if (state === 4) {
  console.error(`[deploy] ${dir} tiene contenido desconocido — no se subió nada. Revísalo a mano.`)
  process.exit(1)
}

if (state === 5) {
  // Move (not delete) the WordPress site out of the web + dump its database, into ~/backups/gabushkids/<fecha>
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
  const bk = `backups/gabushkids/wordpress-${stamp}`
  console.log(`[deploy] respaldando WordPress → ~/${bk} (archivos + base de datos)`)
  await run('ssh', [
    ...ssh,
    `set -e; mkdir -p '${bk}'; chmod 700 backups backups/gabushkids '${bk}';
     cfg='${dir}/wp-config.php';
     v() { sed -n "s/.*define( *.$1., *.\\([^']*\\).*/\\1/p" "$cfg" | head -1; };
     DBN=$(v DB_NAME); DBU=$(v DB_USER); DBP=$(v DB_PASSWORD); DBH=$(v DB_HOST);
     MYSQL_PWD="$DBP" mysqldump -h "\${DBH:-localhost}" -u "$DBU" --single-transaction --no-tablespaces "$DBN" | gzip > '${bk}/wordpress-db.sql.gz';
     test -s '${bk}/wordpress-db.sql.gz';
     mv '${dir}' '${bk}/public_html';
     mkdir -p '${dir}';
     echo "[deploy] respaldo listo: $(du -sh '${bk}' | cut -f1) — para restaurar: mover ${bk}/public_html de vuelta a ${dir}"`,
  ])
}

// Keep the production api/config.php when it already exists
const hasConfig = await run('ssh', [...ssh, `test -f '${dir}/api/config.php'`]).then(() => true).catch(() => false)

const started = Date.now()
console.log(`[deploy] subiendo dist/ → ${cfg.user}@${cfg.host}:${dir}${hasConfig ? ' (se conserva api/config.php del servidor)' : ' (primera vez: se sube api/config.php)'}`)
// 1) everything except the HTML pages (new CSS/JS/images land first) · 2) then the HTML pages.
// Uploading index.html before its assets let a visitor request /assets/x.css while it didn't exist yet, and
// Hostinger's CDN cached that 404 — the site showed up without styles.
const htmlPages = readdirSync('dist', { recursive: true }).map(String).filter((f) => f.endsWith('.html')).map((f) => './' + f.replaceAll('\\', '/'))
const tarArgs = ['-C', 'dist', '-cf', '-', ...(hasConfig ? ['--exclude=./api/config.php'] : []), ...htmlPages.map((f) => `--exclude=${f}`), '.']
const tar = spawn('tar', tarArgs, { stdio: ['ignore', 'pipe', 'inherit'] })
await run('ssh', [...ssh, `mkdir -p '${dir}' && tar -xf - -C '${dir}'`], tar)
const tarHtml = spawn('tar', ['-C', 'dist', '-cf', '-', ...htmlPages], { stdio: ['ignore', 'pipe', 'inherit'] })
await run('ssh', [...ssh, `tar -xf - -C '${dir}' && find '${dir}/assets' -type f -mtime +7 -delete 2>/dev/null; echo "[deploy] archivos en el servidor: $(find '${dir}' -type f | wc -l) (páginas HTML al final: ${htmlPages.length})"`], tarHtml)

// Fase 2 backend: server/ lives next to public_html, outside the web (code only: config and data stay on the server)
const site = dir.replace(/\/public_html$/, '')
console.log(`[deploy] subiendo server/ → ${site}/server`)
const srv = spawn('tar', ['-C', 'server', '--exclude=./tests', '-cf', '-', '.'], { stdio: ['ignore', 'pipe', 'inherit'] })
await run('ssh', [...ssh, `mkdir -p '${site}/server' && tar -xf - -C '${site}/server' && chmod -R go-w '${site}/server'`], srv)
// database migrations — skipped while the database is still empty (the migrated data is loaded first with
// `node scripts/publish-data.mjs`) or when config.php has no database yet
await run('ssh', [
  ...ssh,
  `cd '${site}'; out=$(php server/bin/load-sql.php --check 2>&1) || { echo "[deploy] base de datos no disponible: $out"; exit 0; };
   case "$out" in *"tablas: 0"*) echo "[deploy] base de datos vacía: carga los datos con node scripts/publish-data.mjs";; *) php server/bin/migrate.php;; esac`,
]).catch(() => console.log('[deploy] no se pudieron revisar las migraciones'))

// data folder: report only (never written by a deploy)
await run('ssh', [...ssh, `d='domains/gabushkids.com/gabush-data'; if [ -d "$d" ]; then echo "[deploy] datos intactos en $d: $(ls "$d"/*.json 2>/dev/null | wc -l) archivos"; else echo "[deploy] aún no hay datos (se crean solos al primer uso)"; fi`]).catch(() => {})

// quick health check of the live site
for (const path of ['/', '/admin/', '/familia/', '/api/settings.php', '/api/feed.php', '/api/v2/portal/me']) {
  const res = await fetch(cfg.url + path, { cache: 'no-store' }).catch(() => null)
  console.log(`[deploy] ${path.padEnd(18)} ${res ? res.status : 'sin respuesta'}`)
}
console.log(`[deploy] listo en ${((Date.now() - started) / 1000).toFixed(1)} s`)
