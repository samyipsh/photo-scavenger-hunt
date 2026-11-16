// Checks the API's rules end to end against a running app: uploads, retries, duplicates,
// refusals, a phone's own photos, judging, score conflicts, likes, deletion, blocking and showing
// the Types of Christ. Run it after changing anything on the server, against `pnpm dev` (after
// `pnpm db:reset:local`) or staging:
//   node scripts/api-check.ts                     # http://localhost:3000
//   node scripts/api-check.ts https://<staging address>
// It writes test photos, likes and one station score, so never point it at the live app.
// Committee checks need the passphrase: COMMITTEE_PASSPHRASE, or NUXT_COMMITTEE_PASSPHRASE in .env.
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { closePhotos, photoBytes } from './photos.ts'
import { uploadPhoto } from './upload-photo.ts'

const ROOT = join(import.meta.dirname, '..')
const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
const LIVE = JSON.parse(readFileSync(join(ROOT, 'wrangler.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, '')).name
if (new URL(BASE).hostname.startsWith(`${LIVE}.`)) {
  console.error('Refusing to run against the live app.')
  process.exit(1)
}
const tokens: Record<string, string> = JSON.parse(readFileSync(join(ROOT, 'data/tokens.local.json'), 'utf8'))
const passphrase = process.env.COMMITTEE_PASSPHRASE
  ?? readFileSync(join(ROOT, '.env'), 'utf8').match(/NUXT_COMMITTEE_PASSPHRASE=(.*)/)?.[1]?.trim() ?? ''
const SWAN = 'WhatsApp Image 2026-10-10 at 13.29.34.jpeg'
const base: { thumb: Buffer, large: Buffer } = { thumb: Buffer.alloc(0), large: Buffer.alloc(0) }

let failures = 0
function check(name: string, ok: boolean, detail = '') {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `: ${detail}`}`)
}

// A unique pair of files each time, so duplicates are only the ones a check makes on purpose.
function photo() {
  const tag = Buffer.from(randomUUID())
  const thumb = Buffer.concat([base.thumb, tag])
  const large = Buffer.concat([base.large, tag])
  return { thumb, large, hash: createHash('sha256').update(large).digest('hex') }
}

async function call(path: string, init: { method?: string, body?: unknown, device?: string, cookie?: string, origin?: string } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers: {
      'origin': init.origin ?? BASE,
      'content-type': 'application/json',
      ...(init.device ? { 'x-device-id': init.device } : {}),
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  const text = await res.text()
  let json: any = null
  try {
    json = JSON.parse(text)
  }
  catch {}
  return { status: res.status, json, headers: res.headers }
}

const photoPath = (group: string, id: string) => `/api/g/${tokens[group]}/photos/${id}`

async function main() {
  base.thumb = await photoBytes('swan-400', SWAN, 400)
  base.large = await photoBytes('swan-2048', SWAN, 2048)
  await closePhotos()
  const device = randomUUID()

  // Uploads.
  const a = photo()
  const id = randomUUID()
  await uploadPhoto({ base: BASE, token: tokens.g1!, id, thumb: a.thumb, large: a.large, deviceId: device, details: { hash: a.hash } })
  const gallery = await call('/api/gallery')
  check('an upload is saved and shows in the gallery', gallery.json?.photos?.some((p: any) => p.id === id))
  // Newest first, so a photo just sent leads. One dated later than now (a script that wrote a
  // future uploaded_at) would sit above it: the hippo on staging, 13 Nov 2026.
  const first = gallery.json?.photos?.[0]
  check('a photo just sent is first in the gallery', first?.id === id, first ? `first is ${first.id}, saved ${new Date(first.uploadedAt).toISOString()}` : 'no photos')
  // The gallery is one answer for everyone: nothing in it depends on the phone asking, and asking
  // again with its ETag gets 304 and no body. This phone's own come from /api/gallery/mine.
  const shared = gallery.json?.photos?.find((p: any) => p.id === id)
  check('the gallery is the same for every phone (no liked or mine in it)', !!shared && !('liked' in shared) && !('mine' in shared))
  const tag = gallery.headers.get('etag')
  const unchanged = tag ? await fetch(`${BASE}/api/gallery`, { headers: { 'if-none-match': tag } }) : null
  check('the gallery answers 304 when nothing changed', unchanged?.status === 304, `etag ${tag}, ${unchanged?.status}`)
  const mine = await call('/api/gallery/mine', { device })
  const notMine = await call('/api/gallery/mine', { device: randomUUID() })
  check('a phone\'s own photos come from /api/gallery/mine, and only its own', mine.json?.sent?.includes(id) && !notMine.json?.sent?.includes(id), `${JSON.stringify(mine.json?.sent?.length)}, ${notMine.json?.sent?.includes(id)}`)
  const groupPage = await call(`/api/g/${tokens.g1}`, { device })
  check('the group page loads with a phone\'s likes', groupPage.status === 200, String(groupPage.status))
  const again = await call(`${photoPath('g1', id)}/start`, { method: 'POST', device, body: { hash: a.hash, thumbBytes: a.thumb.length, largeBytes: a.large.length } })
  check('starting the same photo again says it\'s saved', again.json?.status === 'saved', JSON.stringify(again.json))
  const refinish = await call(`${photoPath('g1', id)}/finish`, { method: 'POST', device, body: { hash: a.hash } })
  check('finishing it again says it\'s saved', refinish.status === 200 && refinish.json?.status === 'saved', String(refinish.status))

  const twice = await call(`${photoPath('g1', randomUUID())}/start`, { method: 'POST', device, body: { hash: a.hash, thumbBytes: 10, largeBytes: 10 } })
  check('the same file twice in a group is refused with the first photo', twice.status === 422 && twice.json?.data?.photoId === id, JSON.stringify(twice.json?.statusMessage))
  const elsewhere = await call(`${photoPath('g2', randomUUID())}/start`, { method: 'POST', device, body: { hash: a.hash, thumbBytes: 10, largeBytes: 10 } })
  check('a file another group sent is refused', elsewhere.status === 422 && /Another group/.test(elsewhere.json?.statusMessage ?? ''), JSON.stringify(elsewhere.json?.statusMessage))

  const b = photo()
  const lonely = randomUUID()
  const started = await call(`${photoPath('g1', lonely)}/start`, { method: 'POST', device, body: { hash: b.hash, thumbBytes: b.thumb.length, largeBytes: b.large.length } })
  const early = await call(`${photoPath('g1', lonely)}/finish`, { method: 'POST', device, body: { hash: b.hash } })
  check('finishing before the files arrive asks to send again (409)', early.status === 409, String(early.status))
  const wrongSize = await fetch(new URL(started.json.thumb.url, BASE), { method: 'PUT', headers: started.json.thumb.headers, body: Buffer.concat([b.thumb, Buffer.from('x')]) })
  check('a file of the wrong size is refused by storage', wrongSize.status === 403, String(wrongSize.status))
  const noDevice = await call(`${photoPath('g1', randomUUID())}/start`, { method: 'POST', body: { thumbBytes: 10, largeBytes: 10 } })
  check('an upload without a phone ID is refused', noDevice.status === 400, String(noDevice.status))
  const foreign = await call(`${photoPath('g1', randomUUID())}/start`, { method: 'POST', device, origin: 'https://example.com', body: { thumbBytes: 10, largeBytes: 10 } })
  check('a request from another site is refused (403)', foreign.status === 403, String(foreign.status))

  // A file that isn't a JPEG gets through storage (right size and type header) but not finish.
  const fake = randomUUID()
  const fakeThumb = Buffer.alloc(b.thumb.length, 1)
  const fakeLarge = Buffer.alloc(b.large.length, 1)
  const fakeStart = await call(`${photoPath('g1', fake)}/start`, { method: 'POST', device, body: { thumbBytes: fakeThumb.length, largeBytes: fakeLarge.length } })
  for (const [t, body] of [[fakeStart.json.thumb, fakeThumb], [fakeStart.json.large, fakeLarge]] as const) {
    await fetch(new URL(t.url, BASE), { method: 'PUT', headers: t.headers, body })
  }
  const fakeFinish = await call(`${photoPath('g1', fake)}/finish`, { method: 'POST', device, body: {} })
  check('a file that isn\'t a JPEG is refused at finish (415)', fakeFinish.status === 415, String(fakeFinish.status))

  // Three finishes for one photo at once: one photo, and its files load.
  const e = photo()
  const twin = randomUUID()
  const twinStart = await call(`${photoPath('g1', twin)}/start`, { method: 'POST', device, body: { hash: e.hash, thumbBytes: e.thumb.length, largeBytes: e.large.length } })
  for (const [t, body] of [[twinStart.json.thumb, e.thumb], [twinStart.json.large, e.large]] as const) {
    await fetch(new URL(t.url, BASE), { method: 'PUT', headers: t.headers, body })
  }
  const finishes = await Promise.all([1, 2, 3].map(() => call(`${photoPath('g1', twin)}/finish`, { method: 'POST', device, body: { hash: e.hash } })))
  const kept = (await call('/api/gallery')).json?.photos?.filter((p: any) => p.id === twin) ?? []
  const loads = kept[0] ? (await fetch(new URL(kept[0].largeUrl, BASE))).status : 0
  check('three finishes at once keep one photo, and it loads', finishes.some(f => f.status === 201) && kept.length === 1 && loads === 200, `${finishes.map(f => f.status)}, kept ${kept.length}, load ${loads}`)
  if (!BASE.startsWith('http://localhost')) {
    const keyPath = new URL(kept[0]?.largeUrl ?? BASE).pathname.split('/').slice(2).join('/')
    const viaApp = await fetch(`${BASE}/img/${keyPath}`)
    check('the /img route is shut on a built app (404)', viaApp.status === 404, String(viaApp.status))
  }

  // A phone's own photos: it can move and remove them; another phone can't.
  const challengeList = (await call(`/api/g/${tokens.g1}`, { device })).json?.challenges ?? []
  const spot = challengeList.find((c: any) => c.type === 'spot')
  const f = photo()
  const own = randomUUID()
  await uploadPhoto({ base: BASE, token: tokens.g1!, id: own, thumb: f.thumb, large: f.large, deviceId: device, details: { hash: f.hash } })
  const stranger = await call(`/api/photos/${own}`, { method: 'PATCH', device: randomUUID(), body: { action: 'move', challengeId: spot?.id } })
  const moved = await call(`/api/photos/${own}`, { method: 'PATCH', device, body: { action: 'move', challengeId: spot?.id } })
  check('a phone can move its own photo, another phone can\'t (403)', stranger.status === 403 && moved.status === 200, `${stranger.status}, ${moved.status}`)
  const removed = await call(`/api/photos/${own}`, { method: 'PATCH', device, body: { action: 'remove' } })
  const gone = !(await call('/api/gallery')).json?.photos?.some((p: any) => p.id === own)
  check('a phone can remove its own photo', removed.status === 200 && gone, String(removed.status))

  // "Use it for a challenge": a just-a-photo moves to a challenge.
  const g = photo()
  const loose = randomUUID()
  await uploadPhoto({ base: BASE, token: tokens.g1!, id: loose, thumb: g.thumb, large: g.large, deviceId: device, details: { hash: g.hash } })
  const anonymous = await call(`${photoPath('g1', loose)}/claim`, { method: 'POST', body: { challengeId: spot?.id } })
  check('using a photo for a challenge needs a phone ID', anonymous.status === 400, String(anonymous.status))
  const otherPhone = await call(`${photoPath('g1', loose)}/claim`, { method: 'POST', device: randomUUID(), body: { challengeId: spot?.id } })
  const claimed = await call(`${photoPath('g1', loose)}/claim`, { method: 'POST', device, body: { challengeId: spot?.id } })
  check('only the phone that sent a just-a-photo can use it for a challenge (403)', otherPhone.status === 403 && claimed.status === 200, `${otherPhone.status}, ${claimed.status}`)

  // Two groups sending the same file at the same moment: exactly one gets in.
  const c = photo()
  const race = await Promise.all(['g1', 'g2'].map(async (g) => {
    try {
      await uploadPhoto({ base: BASE, token: tokens[g]!, id: randomUUID(), thumb: c.thumb, large: c.large, deviceId: randomUUID(), details: { hash: c.hash } })
      return 'saved'
    }
    catch (err) {
      return /422/.test(String(err)) ? 'refused' : String(err)
    }
  }))
  check('the same file from two groups at once: one saved, one refused', race.sort().join() === 'refused,saved', race.join())

  // Likes.
  await call(`/api/photos/${id}/like`, { method: 'POST', device, body: { liked: true } })
  const liked = await call(`/api/photos/${id}/like`, { method: 'POST', device, body: { liked: true } })
  check('liking twice counts one like', liked.json?.likes === 1, JSON.stringify(liked.json))
  const likedHere = (await call('/api/gallery/mine', { device })).json?.liked ?? []
  check('a phone\'s likes come from /api/gallery/mine', likedHere.includes(id), JSON.stringify(likedHere))
  const unliked = await call(`/api/photos/${id}/like`, { method: 'POST', device, body: { liked: false } })
  check('unliking takes it back', unliked.json?.likes === 0, JSON.stringify(unliked.json))

  // Committee.
  const login = await call('/api/committee/login', { method: 'POST', body: { passphrase } })
  const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0]
  check('the committee can sign in (needed for the checks below)', login.status === 200 && !!cookie, String(login.status))
  if (login.status === 200 && cookie) {
    const judge = (photoId: string, body: unknown) => call(`/api/committee/photos/${photoId}`, { method: 'PATCH', cookie, body })
    const first = await judge(id, { action: 'pass' })
    const second = await judge(id, { action: 'pass' })
    check('a second judge passing the same photo gets a conflict', first.status === 200 && second.status === 409, `${first.status}, ${second.status}`)
    // The committee moves any photo, whichever phone sent it, and it goes back to be judged.
    const committeeMove = await judge(id, { action: 'challenge', challengeId: spot?.id })
    const movedRow = (await call(`/api/committee/photos/${id}`, { cookie })).json
    check('the committee can move any phone\'s photo to another challenge', committeeMove.status === 200 && movedRow?.challengeId === spot?.id && movedRow?.verdict === 'pending', `${committeeMove.status}, ${movedRow?.challengeId}, ${movedRow?.verdict}`)

    const scores = await call('/api/committee/stations/codenames', { cookie })
    // The last group, so the score lands away from the groups the checks above use.
    const row = scores.json?.groups?.at(-1)
    const saved = await call('/api/committee/stations/codenames', { method: 'POST', cookie, body: { groupId: row?.id, raw: row?.raw ?? 1, missed: false, expectedUpdatedAt: row?.updatedAt ?? null } })
    const stale = await call('/api/committee/stations/codenames', { method: 'POST', cookie, body: { groupId: row?.id, raw: 99, missed: false, expectedUpdatedAt: row?.updatedAt ?? null } })
    check('saving over a score someone else just changed gets a conflict', saved.status === 200 && stale.status === 409, `${saved.status}, ${stale.status}`)

    try {
      await call('/api/committee/settings', { method: 'POST', cookie, body: { uploadsOpen: false } })
      const closed = await call(`${photoPath('g1', randomUUID())}/start`, { method: 'POST', device, body: { thumbBytes: 10, largeBytes: 10 } })
      check('uploads closed are refused (423)', closed.status === 423, String(closed.status))
    }
    finally {
      await call('/api/committee/settings', { method: 'POST', cookie, body: { uploadsOpen: true } })
    }

    const blockedPhone = randomUUID()
    await call('/api/committee/blocks', { method: 'POST', cookie, body: { deviceId: blockedPhone, groupId: 'g1' } })
    try {
      const blocked = await call(`${photoPath('g1', randomUUID())}/start`, { method: 'POST', device: blockedPhone, body: { thumbBytes: 10, largeBytes: 10 } })
      check('a blocked phone is refused (403)', blocked.status === 403, String(blocked.status))
    }
    finally {
      await call(`/api/committee/blocks/${blockedPhone}`, { method: 'DELETE', cookie })
    }

    // A photo for a challenge the group hasn't done adds its points, and the group page and the
    // committee's freshly built scoreboard agree on every group's total.
    const page = (await call(`/api/g/${tokens.g4}`, { device })).json
    const done = new Set(page.photos.filter((p: any) => p.verdict !== 'rejected').map((p: any) => p.challengeId))
    const todo = page.challenges.find((c: any) => c.type !== 'award' && c.points > 0 && !done.has(c.id))
    const k = photo()
    await uploadPhoto({ base: BASE, token: tokens.g4!, id: randomUUID(), thumb: k.thumb, large: k.large, deviceId: device, details: { hash: k.hash, challengeId: todo.id } })
    const after = (await call(`/api/g/${tokens.g4}`, { device })).json
    check('a photo for a new challenge adds its points', after.totals.points === page.totals.points + todo.points, `${page.totals.points} + ${todo.points} -> ${after.totals.points}`)
    const board = (await call('/api/committee/overview', { cookie })).json.board
    const pages = await Promise.all(board.groups.map((g: any) => call(`/api/g/${tokens[g.id]}`, { device })))
    const disagree = board.groups.filter((g: any, i: number) => pages[i].json?.totals?.points !== g.photoPoints).map((g: any) => g.id)
    check('the group pages and the scoreboard agree on photo points', disagree.length === 0, disagree.join(', '))

    // Merging animal names: one rename covers every photo with the old name.
    const h = photo()
    const otter = randomUUID()
    const oddName = `Otter${randomUUID().slice(0, 4)}`
    await uploadPhoto({ base: BASE, token: tokens.g1!, id: otter, thumb: h.thumb, large: h.large, deviceId: device, details: { hash: h.hash, challengeId: 'animals', label: oddName } })
    const merged = await call('/api/committee/labels', { method: 'POST', cookie, body: { from: oddName.toLowerCase(), to: 'otter' } })
    const relabelled = (await call('/api/gallery')).json?.photos?.find((p: any) => p.id === otter)
    check('renaming an animal merges it everywhere', merged.status === 200 && relabelled?.label === 'otter', `${merged.status}, ${relabelled?.label}`)

    // Pausing the scoreboard shows the frozen copy until it's resumed.
    try {
      await call('/api/committee/settings', { method: 'POST', cookie, body: { frozen: true } })
      const paused = await call('/api/scoreboard')
      check('pausing the scoreboard freezes it', typeof paused.json?.frozenAt === 'number' && !!paused.headers.get('server-timing')?.startsWith('frozen'), `${JSON.stringify(paused.json?.frozenAt)}, ${paused.headers.get('server-timing')}`)
    }
    finally {
      await call('/api/committee/settings', { method: 'POST', cookie, body: { frozen: false } })
    }
    const resumed = await call('/api/scoreboard')
    check('resuming shows the live scoreboard again', resumed.json?.frozenAt === null, JSON.stringify(resumed.json?.frozenAt))
    // A rebuilt board is saved after it's sent, and the next asks get that saved copy. The
    // Server-Timing header says which each answer was.
    let again = await call('/api/scoreboard')
    for (let i = 0; i < 10 && !again.headers.get('server-timing')?.includes('cached'); i++) {
      await new Promise(resolve => setTimeout(resolve, 300))
      again = await call('/api/scoreboard')
    }
    check('the scoreboard is saved and answered from its copy', !!again.headers.get('server-timing')?.includes('cached') && again.json?.builtAt === resumed.json?.builtAt, `${again.headers.get('server-timing')}, built ${again.json?.builtAt} vs ${resumed.json?.builtAt}`)

    // How photo times read: one choice, carried by every list that shows photo times, Controls
    // included. A phone holding the gallery from before the change gets the new answer, not 304.
    const timesBefore = (await call('/api/committee/overview', { cookie })).json?.photoTimes
    const style = timesBefore === 'date' ? 'day' : 'date'
    try {
      const oldTag = (await call('/api/gallery')).headers.get('etag')
      const set = await call('/api/committee/settings', { method: 'POST', cookie, body: { photoTimes: style } })
      const odd = await call('/api/committee/settings', { method: 'POST', cookie, body: { photoTimes: 'fortnight' } })
      const [gallery, groupPage, queue, overview] = await Promise.all([call('/api/gallery'), call(`/api/g/${tokens.g1}`, { device }), call('/api/committee/queue', { cookie }), call('/api/committee/overview', { cookie })])
      const seen = [gallery.json?.photoTimes, groupPage.json?.photoTimes, queue.json?.photoTimes, overview.json?.photoTimes]
      check('photo times are set once and every list carries them', set.status === 200 && odd.status === 400 && seen.every(s => s === style), `${set.status}, ${odd.status}, ${seen.join(' ')}`)
      const held = oldTag ? await fetch(`${BASE}/api/gallery`, { headers: { 'if-none-match': oldTag } }) : null
      check('a gallery from before the change is sent again, not 304', held?.status === 200 && (await held.json()).photoTimes === style, `etag ${oldTag}, ${held?.status}`)
    }
    finally {
      await call('/api/committee/settings', { method: 'POST', cookie, body: { photoTimes: timesBefore ?? 'time' } })
    }

    // The Types of Christ answers: refused while hidden, sent once the committee shows them, and
    // refused again once hidden, even to a phone that holds them (no 304). Only the committee
    // can show them.
    const typesBefore = (await call('/api/committee/overview', { cookie })).json?.typesShown
    try {
      await call('/api/committee/settings', { method: 'POST', cookie, body: { typesShown: false } })
      const [hidden, hiddenFlag] = await Promise.all([call('/api/types'), call('/api/types/shown')])
      check('the Types of Christ are refused while hidden', hidden.status === 403 && hidden.json?.data?.code === 'types-hidden' && !hidden.json?.types && hiddenFlag.json?.shown === false, `${hidden.status} ${hidden.json?.data?.code}, shown ${hiddenFlag.json?.shown}`)
      const outsider = await call('/api/committee/settings', { method: 'POST', body: { typesShown: true } })
      check('only the committee can show the Types of Christ', outsider.status === 401 && (await call('/api/types')).status === 403, String(outsider.status))
      const set = await call('/api/committee/settings', { method: 'POST', cookie, body: { typesShown: true } })
      const [shown, shownFlag, overview] = await Promise.all([call('/api/types'), call('/api/types/shown'), call('/api/committee/overview', { cookie })])
      check('once shown, the Types of Christ come with their verses', set.status === 200 && shown.status === 200 && shown.json?.types?.length > 0 && Object.keys(shown.json?.verses ?? {}).length > 0 && shownFlag.json?.shown === true && overview.json?.typesShown === true, `${set.status}, ${shown.status}, ${shown.json?.types?.length} types, shown ${shownFlag.json?.shown}`)
      const tag = shown.headers.get('etag')
      const again = tag ? await fetch(`${BASE}/api/types`, { headers: { 'if-none-match': tag } }) : null
      await call('/api/committee/settings', { method: 'POST', cookie, body: { typesShown: false } })
      const rehidden = tag ? await fetch(`${BASE}/api/types`, { headers: { 'if-none-match': tag } }) : null
      check('a phone holding the Types of Christ gets 304, then a refusal once they\'re hidden again', again?.status === 304 && rehidden?.status === 403, `etag ${tag}, ${again?.status}, ${rehidden?.status}`)
    }
    finally {
      await call('/api/committee/settings', { method: 'POST', cookie, body: { typesShown: typesBefore ?? false } })
    }

    // Inappropriate, with the phone blocked: the photo goes and the phone can't send more.
    const i = photo()
    const rude = randomUUID()
    const ruder = randomUUID()
    await uploadPhoto({ base: BASE, token: tokens.g1!, id: rude, thumb: i.thumb, large: i.large, deviceId: ruder, details: { hash: i.hash } })
    try {
      const flagged = await judge(rude, { action: 'inappropriate', block: true })
      const after = await call(`${photoPath('g1', randomUUID())}/start`, { method: 'POST', device: ruder, body: { thumbBytes: 10, largeBytes: 10 } })
      check('marking a photo inappropriate can block its phone', flagged.status === 200 && after.status === 403 && after.json?.data?.code === 'phone-blocked', `${flagged.status}, ${after.status}`)
    }
    finally {
      await call(`/api/committee/blocks/${ruder}`, { method: 'DELETE', cookie })
    }

    const d = photo()
    const doomed = randomUUID()
    await uploadPhoto({ base: BASE, token: tokens.g1!, id: doomed, thumb: d.thumb, large: d.large, deviceId: device, details: { hash: d.hash } })
    const deleted = await judge(doomed, { action: 'delete' })
    // The same reason as Delete for good from Hidden photos: nobody asked for it.
    check('the committee\'s Delete records "Deleted by the committee"', deleted.json?.rejectReason === 'Deleted by the committee', JSON.stringify(deleted.json?.rejectReason))
    const restore = await judge(doomed, { action: 'restore' })
    const pass = await judge(doomed, { action: 'pass', force: true })
    check('a photo deleted for good can\'t be restored or judged', deleted.status === 200 && restore.status === 409 && pass.status === 409, `${deleted.status}, ${restore.status}, ${pass.status}`)

    // The gallery's Select, for the committee: Delete moves photos out of the gallery into
    // Hidden with their files, Unhide brings them back, and Delete for good works only there.
    const batch = (action: string, ids: string[], c = cookie) => call('/api/committee/photos/batch', { method: 'POST', cookie: c, body: { action, ids } })
    const idsIn = async (path: string) => new Set<string>(((await call(path, { cookie })).json?.photos ?? []).map((p: any) => p.id))
    const picked = [randomUUID(), randomUUID()]
    for (const pid of picked) {
      const p = photo()
      await uploadPhoto({ base: BASE, token: tokens.g1!, id: pid, thumb: p.thumb, large: p.large, deviceId: device, details: { hash: p.hash } })
    }
    const [outsider, outsiderList] = await Promise.all([batch('remove', picked, ''), call('/api/committee/photos/hidden')])
    check('only the committee can hide in bulk or see Hidden photos', outsider.status === 401 && outsiderList.status === 401, `${outsider.status}, ${outsiderList.status}`)
    const tooSoon = await batch('delete', picked)
    check('photos still in the gallery can\'t be deleted for good in bulk', tooSoon.status === 200 && !tooSoon.json?.done?.length && tooSoon.json?.refused?.length === 2 && tooSoon.json.refused.every((r: any) => r.reason === 'in-gallery'), JSON.stringify(tooSoon.json))
    const stranger = randomUUID()
    const hid = await batch('remove', [...picked, stranger])
    const [gallery1, hidden1] = await Promise.all([idsIn('/api/gallery'), idsIn('/api/committee/photos/hidden')])
    check('Hide in bulk moves photos from the gallery to Hidden photos', hid.json?.done?.length === 2 && hid.json?.refused?.[0]?.id === stranger && hid.json.refused[0].reason === 'not-found' && picked.every(x => !gallery1.has(x) && hidden1.has(x)), JSON.stringify(hid.json))
    // Done is only what that request changed, so an Undo can't bring back what someone else hid.
    const twice = await batch('remove', picked)
    check('Hide in bulk again changes nothing, and says they were already hidden', twice.json?.done?.length === 0 && twice.json?.refused?.length === 2 && twice.json.refused.every((r: any) => r.reason === 'already-hidden'), JSON.stringify(twice.json))
    const back = await batch('restore', [picked[0]!])
    const [gallery2, hidden2] = await Promise.all([idsIn('/api/gallery'), idsIn('/api/committee/photos/hidden')])
    check('Unhide in bulk puts photos back in the gallery', back.json?.done?.[0] === picked[0] && gallery2.has(picked[0]!) && !hidden2.has(picked[0]!), JSON.stringify(back.json))
    // A copy of the same file sent again since: the hidden one can't come back.
    const t = photo()
    const original = randomUUID()
    const resent = randomUUID()
    await uploadPhoto({ base: BASE, token: tokens.g1!, id: original, thumb: t.thumb, large: t.large, deviceId: device, details: { hash: t.hash } })
    await batch('remove', [original])
    await uploadPhoto({ base: BASE, token: tokens.g1!, id: resent, thumb: t.thumb, large: t.large, deviceId: device, details: { hash: t.hash } })
    const blocked = await batch('restore', [original])
    check('Unhide leaves a photo hidden when a copy is in the gallery', blocked.json?.refused?.[0]?.reason === 'copy-in-gallery' && (await idsIn('/api/committee/photos/hidden')).has(original), JSON.stringify(blocked.json))
    // Two copies of one file asked back together: the first comes back, the other stays.
    const c = photo()
    const copies = [randomUUID(), randomUUID()]
    for (const cid of copies) {
      await uploadPhoto({ base: BASE, token: tokens.g1!, id: cid, thumb: c.thumb, large: c.large, deviceId: device, details: { hash: c.hash } })
      await batch('remove', [cid])
    }
    const both = await batch('restore', copies)
    check('of two copies unhidden together, one comes back', both.json?.done?.length === 1 && both.json?.refused?.length === 1 && both.json.refused[0].reason === 'copy-in-gallery', JSON.stringify(both.json))
    // Hidden photos lists the latest hidden first: an older photo hidden now comes before a newer
    // one hidden earlier.
    await batch('remove', [picked[0]!])
    const order = ((await call('/api/committee/photos/hidden', { cookie })).json?.photos ?? []).map((p: any) => p.id)
    check('Hidden photos lists the latest hidden first', order.indexOf(picked[0]) >= 0 && order.indexOf(picked[0]) < order.indexOf(original), `${order.indexOf(picked[0])}, ${order.indexOf(original)}`)
    // Delete for good: out of Hidden photos, its files gone, and it can't come back.
    const doomedLink = ((await call('/api/committee/photos/hidden', { cookie })).json?.photos ?? []).find((p: any) => p.id === picked[1])?.thumbUrl
    const purged = await batch('delete', [picked[1]!])
    const [gallery3, hidden3] = await Promise.all([idsIn('/api/gallery'), idsIn('/api/committee/photos/hidden')])
    const file = doomedLink ? await fetch(new URL(doomedLink, BASE)) : null
    const revived = await batch('restore', [picked[1]!])
    check('Delete for good in bulk takes photos out of Hidden photos with their files', purged.json?.done?.[0] === picked[1] && !hidden3.has(picked[1]!) && !gallery3.has(picked[1]!) && file?.status === 404 && revived.json?.refused?.[0]?.reason === 'deleted-for-good', `${JSON.stringify(purged.json)}, file ${file?.status}, ${JSON.stringify(revived.json)}`)
    const retried = await batch('delete', [picked[1]!])
    check('Delete for good in bulk is safe to repeat', retried.json?.done?.[0] === picked[1], JSON.stringify(retried.json))
    const big = await batch('remove', Array.from({ length: 51 }, () => randomUUID()))
    check('a bulk request takes at most 50 photos', big.status === 400, String(big.status))
    await batch('delete', [original, picked[0]!, ...copies])
  }

  console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed')
  process.exit(failures ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
