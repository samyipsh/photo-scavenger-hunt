// Fills the LOCAL app with realistic demo data for screenshots and UX reviews.
//   node scripts/demo-data.ts
// Needs the dev server running (pnpm dev) and NUXT_COMMITTEE_PASSPHRASE in .env.
// Never point this at the live app.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { EVENT_DATE, GROUP_LEADERS, UTC_OFFSET } from '../data/event.ts'
import { closePhotos, photoBytes } from './photos.ts'
import { uploadPhoto } from './upload-photo.ts'

// Local only: it also writes straight to the local database. DEMO_URL picks another local port.
const BASE = process.env.DEMO_URL ?? 'http://localhost:3000'
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error('demo-data only runs against a local app.')
  process.exit(1)
}
const ROOT = new URL('..', import.meta.url).pathname
const tokens: Record<string, string> = JSON.parse(readFileSync(join(ROOT, 'data/tokens.local.json'), 'utf8'))
const passphrase = readFileSync(join(ROOT, '.env'), 'utf8').match(/NUXT_COMMITTEE_PASSPHRASE=(.*)/)?.[1]?.trim()

// Recce photos checked by eye to show no people, so the screenshots show no one.
// 13.29.32 and 13.29.33 (2) have committee members in them, so they're left out.
const pics = {
  squirrel: 'WhatsApp Image 2026-10-10 at 10.43.49.jpeg',
  lizard: 'WhatsApp Image 2026-10-10 at 10.44.58.jpeg',
  lily: 'WhatsApp Image 2026-10-10 at 11.19.14.jpeg',
  yellow: 'WhatsApp Image 2026-10-10 at 13.29.31 (1).jpeg',
  white: 'WhatsApp Image 2026-10-10 at 13.29.31 (2).jpeg',
  berries: 'WhatsApp Image 2026-10-10 at 13.29.32 (1).jpeg',
  hornbill: 'WhatsApp Image 2026-10-10 at 13.29.34 (2).jpeg',
  swan: 'WhatsApp Image 2026-10-10 at 13.29.34.jpeg',
  swan2: 'WhatsApp Image 2026-10-10 at 13.29.35.jpeg',
  lizard2: 'WhatsApp Image 2026-11-03 at 10.37.01.jpeg',
  red: 'WhatsApp Image 2026-11-03 at 10.37.02 (1).jpeg',
  orchid: 'WhatsApp Image 2026-11-03 at 10.37.02.jpeg',
  berries2: 'WhatsApp Image 2026-11-03 at 10.37.03.jpeg',
  tiny: 'WhatsApp Image 2026-11-03 at 10.37.04.jpeg',
  hornbills: 'WhatsApp Image 2026-11-03 at 10.37.09.jpeg',
  // Three real cheats from the outing, for the photos the committee didn't count. They show other
  // people's designs (a poster, a sign, a game card), so like the rest they stay out of git.
  poster: 'Cheat - blue flower poster.jpg',
  sign: 'Cheat - chicken sign.jpg',
  card: 'Cheat - worm card.jpg',
} as const
type Pic = keyof typeof pics

// The recce photo at this size, or a stand-in where the recce photos aren't available.
const sized = (pic: Pic, edge: number) => photoBytes(`${pic}-${edge}`, pics[pic], edge)

const headers = { 'origin': BASE, 'x-device-id': crypto.randomUUID() }
let cookie = ''

// Photo credits, as people would type them, with made-up names. A few photos go up without a name.
const BY: Record<string, (string | null)[]> = {
  g1: ['Alex', 'Jordan', null], g2: ['Priya', 'Wei Jie'], g3: ['Mei', 'Hana', 'Ken', null],
  g4: ['Siti'], g5: ['Ben', 'Zara', null], recce: [null],
}
let uploads = 0

async function upload(group: string, pic: Pic, challenge: string | null, label?: string) {
  const id = crypto.randomUUID()
  // A fingerprint like the phone's. The demo reuses pictures across groups and challenges, so
  // both are mixed in: only the same picture, group and challenge matches.
  const hash = createHash('sha256').update(await sized(pic, 2048)).update(`${group}:${challenge}:${label ?? ''}`).digest('hex')
  const names = BY[group] ?? [null]
  const by = names[uploads++ % names.length]
  await uploadPhoto({
    base: BASE,
    token: tokens[group]!,
    id,
    thumb: await sized(pic, 400),
    large: await sized(pic, 2048),
    deviceId: headers['x-device-id'],
    details: { challengeId: challenge, label: label ?? null, hash, width: 2048, height: 1536, by },
  })
  return id
}

async function committee(path: string, method: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { ...headers, 'content-type': 'application/json', cookie }, body: JSON.stringify(body) })
  if (!res.ok) throw new Error(`${path} ${res.status} ${await res.text()}`)
  return res.json()
}

async function main() {
  execFileSync('pnpm', ['wrangler', 'd1', 'execute', 'DB', '--local', '--command',
    'DELETE FROM photos; DELETE FROM photo_likes; DELETE FROM blocked_devices; DELETE FROM station_scores; DELETE FROM login_attempts; DELETE FROM settings WHERE key != \'uploads_open\'; UPDATE settings SET value = \'true\' WHERE key = \'uploads_open\';'], { cwd: ROOT, stdio: 'ignore' })

  const login = await fetch(`${BASE}/api/committee/login`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ passphrase }) })
  cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]!
  if (!login.ok) throw new Error(`login ${login.status}`)

  // Group 1's first upload is an animal, so the judge's first photo shows the animal-name fix.
  await upload('g1', 'hornbills', 'animals', 'hornbil')

  // Group 3 is the group the screenshots follow.
  const g3: [Pic, string | null, string?][] = [
    ['swan', 'swan'], ['squirrel', 'squirrel'], ['orchid', 'orchid'], ['lily', 'lily'],
    ['berries2', 'fruit'], ['berries', 'holey-leaves'], ['tiny', 'tiny'],
    ['swan2', 'animals', 'black swan'], ['squirrel', 'animals', 'squirrel'], ['lizard', 'animals', 'monitor lizard'],
    ['red', 'colours', 'red'], ['yellow', 'colours', 'yellow'], ['white', 'colours', 'white'],
    ['hornbills', null],
  ]
  const ids: Record<string, string> = {}
  for (const [pic, ch, label] of g3) ids[`${pic}-${ch}`] = await upload('g3', pic, ch, label)
  // Cheats the judges turn down below (a chicken on a sign, a drawn flower, a word on a card),
  // with reasons the way judges really type them.
  const cheats: [string, string, Pic, string, string?][] = [
    ['THIS ISN\'T REAL NIC', 'g3', 'sign', 'rooster'],
    ['real flowers only pls', 'g4', 'poster', 'colours', 'blue'],
    ['=.= cards not allowed', 'g5', 'card', 'worm'],
  ]
  const cheatIds = new Map<string, string>()
  for (const [reason, g, pic, ch, label] of cheats) cheatIds.set(reason, await upload(g, pic, ch, label))

  const others: [string, Pic, string | null, string?][] = [
    ['g1', 'hornbill', 'hornbill'], ['g1', 'swan', 'swan'], ['g1', 'lizard2', 'monitor-lizard'], ['g1', 'swan', 'animals', 'swan'],
    ['g1', 'hornbill', 'animals', 'hornbill'], ['g1', 'lizard2', 'animals', 'monitor lizard'], ['g1', 'squirrel', 'animals', 'squirrel'],
    ['g2', 'swan2', 'swan'], ['g2', 'orchid', 'orchid'], ['g2', 'red', 'colours', 'red'], ['g2', 'hornbills', null],
    ['g5', 'squirrel', 'squirrel'], ['g5', 'swan2', 'animals', 'Black Swan'],
    ['g5', 'berries', 'holey-leaves'], ['g5', 'yellow', 'colours', 'yellow'],
  ]
  for (const [g, pic, ch, label] of others) await upload(g, pic, ch, label)

  // Judge some: the cheats don't count, each with its reason.
  for (const [reason, id] of cheatIds) await committee(`/api/committee/photos/${id}`, 'PATCH', { action: 'reject', reason })
  for (const key of ['swan-swan', 'squirrel-squirrel', 'orchid-orchid']) {
    await committee(`/api/committee/photos/${ids[key]}`, 'PATCH', { action: 'pass' })
  }
  // Likes from other phones, so the gallery puts its most-liked photos first.
  const like = (id: string, times: number) => Promise.all(Array.from({ length: times }, async () => {
    const res = await fetch(`${BASE}/api/photos/${id}/like`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json', 'x-device-id': crypto.randomUUID() }, body: JSON.stringify({ liked: true }) })
    if (!res.ok) throw new Error(`like ${id}: ${res.status} ${await res.text()}`)
  }))
  await like(ids['swan-swan']!, 5)
  await like(ids['squirrel-squirrel']!, 3)
  await like(cheatIds.get('THIS ISN\'T REAL NIC')!, 1)

  // Group 4's photos are all checked, so the judge's group filter can show an empty group.
  const queue = await (await fetch(`${BASE}/api/committee/queue?group=g4`, { headers: { cookie } })).json() as { photos: { id: string }[] }
  for (const p of queue.photos) await committee(`/api/committee/photos/${p.id}`, 'PATCH', { action: 'pass' })

  // Station scores for rounds 1 and 2, with one left out so the grid shows a gap.
  const rounds12: [string, string, number][] = [
    ['g1', 'codenames', 7], ['g3', 'charades', 6], ['g4', 'riddles', 5.5], ['g5', 'poetry', 19],
    ['g1', 'mind', 41], ['g2', 'charades', 4], ['g4', 'poetry', 15],
  ]
  for (const [groupId, station, raw] of rounds12) {
    await committee(`/api/committee/stations/${station}`, 'POST', { groupId, raw, missed: false, expectedUpdatedAt: null })
  }
  await committee('/api/committee/stations/riddles', 'POST', { groupId: 'g5', raw: null, missed: true, expectedUpdatedAt: null })

  // The event's group ICs (data/event.ts), or made-up ones where none are set, set the way the
  // committee does it in the app.
  const examples = ['Alex', 'Priya', 'Hana', 'Siti', 'Ben']
  for (const [i, l] of examples.entries()) {
    await committee(`/api/committee/groups/g${i + 1}`, 'POST', { leader: GROUP_LEADERS[i + 1] ?? l })
  }

  // Move every timestamp to the morning of the outing, so screenshots show event times; before
  // the outing, to the same spread ending now. Never later than now: the gallery shows the
  // newest first, so a photo dated in the future would sit above every photo sent after it.
  const now = Date.now()
  const from = (event: string, step: number, extra: number, table: string) =>
    `(SELECT min(${Date.parse(event)}, ${now} - ${extra} - max(rowid) * ${step}) FROM ${table})`
  const photosFrom = from(`${EVENT_DATE}T09:40:00${UTC_OFFSET}`, 70000, 120000, 'photos')
  const scoresFrom = from(`${EVENT_DATE}T10:05:00${UTC_OFFSET}`, 45000, 0, 'station_scores')
  execFileSync('pnpm', ['wrangler', 'd1', 'execute', 'DB', '--local', '--command',
    `UPDATE photos SET uploaded_at = ${photosFrom} + rowid * 70000, checked_at = CASE WHEN checked_at IS NULL THEN NULL ELSE ${photosFrom} + rowid * 70000 + 120000 END; UPDATE station_scores SET updated_at = ${scoresFrom} + rowid * 45000;`], { cwd: ROOT, stdio: 'ignore' })

  console.log('Demo data loaded. Group 3:', `${BASE}/g/${tokens.g3}`)
  await closePhotos()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
