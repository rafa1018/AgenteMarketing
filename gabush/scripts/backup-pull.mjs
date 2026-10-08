// Brings the newest backups of the platform from the server to this computer (copy outside the hosting).
//   npm run backup:pull           → newest weekly + newest daily into .backups/ (git-ignored)
//   npm run backup:pull -- --all  → every backup that is not here yet
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'

const cfg = JSON.parse(readFileSync('.deploy.local.json', 'utf8'))
const key = cfg.key.replace(/^~/, homedir())
const remote = 'domains/gabushkids.com/gabush-data/backups/plataforma'
const local = '.backups'
mkdirSync(local, { recursive: true })

function run(cmd, args, capture = false) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit'] })
    let out = ''
    if (capture) p.stdout.on('data', (d) => (out += d))
    p.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${cmd} terminó con código ${code}`))))
  })
}

const list = (await run('ssh', ['-i', key, '-p', String(cfg.port), '-o', 'BatchMode=yes', `${cfg.user}@${cfg.host}`, `ls -1 ${remote} 2>/dev/null`], true))
  .split('\n')
  .map((s) => s.trim())
  .filter((s) => /^gabush-\d{8}-\d{6}-[a-z-]+\.zip$/.test(s))
  .sort()
  .reverse()
if (!list.length) {
  console.log('[copias] el servidor aún no tiene copias')
  process.exit(0)
}
const pick = process.argv.includes('--all') ? list : [list.find((n) => n.endsWith('-semanal.zip')), list.find((n) => n.endsWith('-diaria.zip')) ?? list[0]].filter(Boolean)
for (const name of [...new Set(pick)]) {
  if (existsSync(`${local}/${name}`)) {
    console.log(`[copias] ya está: ${name}`)
    continue
  }
  console.log(`[copias] descargando ${name}…`)
  await run('scp', ['-i', key, '-P', String(cfg.port), '-o', 'BatchMode=yes', '-q', `${cfg.user}@${cfg.host}:${remote}/${name}`, `${local}/${name}`])
}
console.log(`[copias] listo: guardadas en ${local}/`)
