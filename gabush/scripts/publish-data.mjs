// ONE-TIME: publishes the migrated school data (local MySQL + student photos) to production.
//   node scripts/publish-data.mjs           → checks the production database is reachable and EMPTY, then loads
//   node scripts/publish-data.mjs --check   → only the checks
// Safety:
// - The production database must be empty: load-sql.php refuses to write into one that already has tables.
// - Database credentials never leave the server (load-sql.php reads them from the production config.php).
// - Volatile local tables (test notifications, e-mail queue, portal accounts, audit) go empty.
// - Photos are copied into domains/gabushkids.com/gabush-data/students (private, outside the web).
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { createGzip } from 'node:zlib'

const cfg = JSON.parse(readFileSync('.deploy.local.json', 'utf8'))
const key = cfg.key.replace(/^~/, homedir())
const ssh = ['-i', key, '-p', String(cfg.port), '-o', 'BatchMode=yes', `${cfg.user}@${cfg.host}`]
const SITE = 'domains/gabushkids.com'
const MYSQL = 'C:/xampp/mysql/bin'
const LOCAL = ['--host=127.0.0.1', '--port=3307', '--user=gabush', '--password=gabush']
// emptied on publish: they only hold local tests / per-device state
const VOLATILE = ['audit_log', 'notifications', 'email_outbox', 'reminders_sent', 'push_subscriptions', 'portal_accounts', 'portal_password_resets', 'checkouts']

function run(cmd, args, { input, capture = false } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: [input ? 'pipe' : 'inherit', capture ? 'pipe' : 'inherit', 'inherit'] })
    let out = ''
    if (capture) p.stdout.on('data', (d) => (out += d))
    if (input) {
      for (const src of [].concat(input)) src.stdout.pipe(p.stdin, { end: false })
      let left = [].concat(input).length
      for (const src of [].concat(input)) src.stdout.on('end', () => --left === 0 && p.stdin.end())
    }
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(Object.assign(new Error(`${cmd} terminó con código ${code}`), { code }))))
  })
}

console.log('[datos] revisando la base de datos de producción…')
const check = await run('ssh', [...ssh, `php ${SITE}/server/bin/load-sql.php --check`], { capture: true }).catch((e) => {
  console.error('[datos] no se pudo revisar la base de producción (¿falta "db" en public_html/api/config.php o subir server/ con npm run deploy?)')
  process.exit(e.code || 1)
})
process.stdout.write('[datos] ' + check)
if (!/tablas: 0\b/.test(check)) {
  console.error('[datos] la base de producción NO está vacía: no se cargó nada.')
  process.exit(1)
}
if (process.argv.includes('--check')) process.exit(0)

// structure of every table + data of the stable ones, compressed on the way
const common = ['--single-transaction', '--skip-lock-tables', '--no-tablespaces', '--default-character-set=utf8mb4', '--skip-comments']
const schema = spawn(`${MYSQL}/mysqldump`, [...LOCAL, ...common, '--no-data', 'gabush'], { stdio: ['ignore', 'pipe', 'inherit'] })
const data = spawn(`${MYSQL}/mysqldump`, [...LOCAL, ...common, '--no-create-info', '--extended-insert', ...VOLATILE.map((t) => `--ignore-table=gabush.${t}`), 'gabush'], { stdio: ['ignore', 'pipe', 'inherit'] })
// schema first, then data, into one gzip stream
const gzip = createGzip()
schema.stdout.pipe(gzip, { end: false })
schema.stdout.on('end', () => {
  gzip.write('\nSET FOREIGN_KEY_CHECKS=0;\n')
  data.stdout.pipe(gzip, { end: false })
  data.stdout.on('end', () => gzip.end('\nSET FOREIGN_KEY_CHECKS=1;\n'))
})
console.log('[datos] subiendo y cargando la base de datos…')
await run('ssh', [...ssh, `gunzip -c | php ${SITE}/server/bin/load-sql.php`], { input: { stdout: gzip } })

// student photos
const photos = '.api-data/students'
if (existsSync(photos)) {
  console.log('[datos] subiendo fotos de estudiantes…')
  const tar = spawn('tar', ['-C', '.api-data', '-cf', '-', 'students'], { stdio: ['ignore', 'pipe', 'inherit'] })
  await run('ssh', [...ssh, `mkdir -p ${SITE}/gabush-data && chmod 750 ${SITE}/gabush-data && tar -xf - -C ${SITE}/gabush-data && echo "[datos] fotos en el servidor: $(ls ${SITE}/gabush-data/students | wc -l)"`], { input: tar })
}

// migrations (none pending: the dump carries them) and a short summary
await run('ssh', [...ssh, `php ${SITE}/server/bin/migrate.php && php -r 'require "${SITE}/server/bootstrap.php"; $d = Gabush\\App::boot()->db(); foreach (["students","families","guardians","enrollments","grade_entries","charges","payments"] as $t) echo "[datos] $t: ".$d->value("SELECT COUNT(*) FROM $t")."\\n";'`])
console.log('[datos] listo')
