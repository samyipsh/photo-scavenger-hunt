// Everything CI runs, in one command: typecheck (app and scripts), unit tests, a production
// build, then a fresh local database, the dev server and the API check against it.
//   pnpm check:all
// It resets the local database, and refuses to start while another dev server is on port 3000.
import { execSync, spawn } from 'node:child_process'

const run = (cmd: string) => execSync(cmd, { stdio: 'inherit' })

const busy = await fetch('http://localhost:3000/api/groups').then(() => true, () => false)
if (busy) {
  console.error('Stop the dev server on port 3000 first: this check starts its own, on a fresh database.')
  process.exit(1)
}

run('pnpm verify')
run('pnpm build')
run('pnpm db:reset:local')

const dev = spawn('pnpm', ['dev'], { stdio: 'ignore', detached: true })
try {
  let up = false
  for (let i = 0; i < 90 && !up; i++) {
    up = await fetch('http://localhost:3000/api/groups').then(r => r.ok, () => false)
    if (!up) await new Promise(r => setTimeout(r, 2000))
  }
  if (!up) throw new Error('The dev server didn\'t start within 3 minutes.')
  run('node scripts/api-check.ts')
}
finally {
  // The dev server runs as its own process group, so this stops it and everything it started.
  if (dev.pid) process.kill(-dev.pid)
}
