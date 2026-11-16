// Saves a database's current state as demo mode's seeded state (docs/architecture.md, "Demo mode"):
// every photo in it becomes a showcase photo, and each night's reset brings back these photos'
// verdicts and challenges, the likes, station scores, settings and group names.
//   node scripts/demo-snapshot.ts                                    the local database
//   node scripts/demo-snapshot.ts --remote -c wrangler.demo.jsonc     a deployed demo's
// Run it again after changing the demo's photos, scores or settings on purpose.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DEMO_SEED_KEY, demoSeed, type DemoSeedRows } from '../shared/utils/demo.ts'

const ROOT = join(import.meta.dirname, '..')
const args = process.argv.slice(2)
const config = args.includes('-c') ? args[args.indexOf('-c') + 1] : undefined
const where = [args.includes('--remote') ? '--remote' : '--local', ...(config ? ['-c', config] : [])]
const wrangler = (...rest: string[]) => execFileSync('pnpm', ['-s', 'wrangler', 'd1', 'execute', 'DB', ...where, ...rest], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] })

// Read in one go, so the snapshot is of one moment.
const reads = [
  'select id, verdict, reject_reason rejectReason, checked_at checkedAt, challenge_id challengeId, label, removed, removed_at removedAt from photos',
  'select photo_id photoId, device_id deviceId, liked_at likedAt from photo_likes',
  'select group_id groupId, station_id stationId, raw, missed, updated_at updatedAt from station_scores',
  'select key, value, updated_at updatedAt from settings',
  'select id, name, leader from groups',
]
const [photos, likes, scores, settings, groups] = (JSON.parse(wrangler('--json', '--command', reads.join('; '))) as { results: never[] }[]).map(r => r.results)
const seed = demoSeed({ photos, likes, scores, settings, groups } as DemoSeedRows, Date.now())

const q = (s: string) => `'${s.replaceAll('\'', '\'\'')}'`
const outDir = join(ROOT, '.wrangler')
mkdirSync(outDir, { recursive: true })
const file = join(outDir, 'demo-seed.sql')
writeFileSync(file, `INSERT INTO settings (key, value, updated_at) VALUES (${q(DEMO_SEED_KEY)}, ${q(JSON.stringify(seed))}, ${seed.takenAt})
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at;\n`)
wrangler('--file', file)
console.log(`Saved the demo's seeded state: ${seed.photos.length} photos, ${seed.likes.length} likes, ${seed.scores.length} station scores, ${seed.settings.length} settings, ${seed.groups.length} groups.`)
