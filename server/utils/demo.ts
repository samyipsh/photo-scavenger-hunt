// Demo mode (docs/architecture.md, "Demo mode"): a public copy of the app that strangers can try,
// committee pages included. Off unless DEMO_MODE is "true" (isDemo in platform.ts); then nothing
// here does anything.
//
// The demo's seeded state is a snapshot in the settings table (scripts/demo-snapshot.ts). Its
// photos are the showcase, which everyone sees. A visitor's photo shows only on the phone that
// sent it, at most DEMO_PHOTO_LIMIT of them are kept at once, and every night the first request
// puts the snapshot back and deletes visitors' photos.
import type { H3Event } from 'h3'
import { and, count, eq, isNull, not, or, sql, type SQL } from 'drizzle-orm'
import { photos, settings } from '../db/schema'
import { DEMO_DAY_KEY, DEMO_SEED_KEY, demoDay, demoFull, isDemoSeed, type DemoSeed } from '#shared/utils/demo'

// Demo mode's keys written into the SQL rather than sent as values: drizzle can't batch raw SQL
// that has values (the reset's statements).
const seedKey = sql.raw(`'${DEMO_SEED_KEY}'`)
const dayKey = sql.raw(`'${DEMO_DAY_KEY}'`)

// A photo in the snapshot. Its IDs are read from the snapshot inside the query, so no list of IDs
// is sent (D1 takes at most 100 values in one query).
const showcasePhoto = sql`${photos.id} in (select json_extract(j.value, '$.id') from ${settings}, json_each(${settings.value}, '$.photos') j where ${settings.key} = ${seedKey})`
// A photo a visitor sent.
export const visitorPhoto = not(showcasePhoto)

// The photos someone may see, for every query that lists or counts photos for them: the showcase,
// and, unless the answer is shared by `everyone`, the photos this phone sent (x-device-id).
// Undefined when demo mode is off, which and() and where() skip: every photo.
export function demoPhotos(event: H3Event, scope: 'asker' | 'everyone' = 'asker'): SQL | undefined {
  if (!isDemo(event)) return undefined
  const deviceId = scope === 'asker' ? readDeviceId(event) : null
  return deviceId ? or(showcasePhoto, eq(photos.deviceId, deviceId)) : showcasePhoto
}

// Refuses a visitor's photo once the demo holds DEMO_PHOTO_LIMIT of them. Checked with the other
// upload checks, on start and finish.
export async function assertDemoRoom(event: H3Event, db: Db) {
  if (!isDemo(event)) return
  const held = await db.select({ n: count() }).from(photos).where(and(visitorPhoto, isNull(photos.filesDeletedAt))).get()
  if (demoFull(held?.n ?? 0)) {
    throw createError({ statusCode: 429, statusMessage: 'The demo is full for today. Try again tomorrow.', data: { code: 'demo-full' } })
  }
}

// Showcase photos can't be deleted for good in demo mode: the nightly reset can't bring their
// files back. Every route that deletes photos' files calls this first.
export async function refuseShowcaseDelete(event: H3Event, db: Db, ids: string[]) {
  if (!isDemo(event)) return
  const showcase = new Set((await readDemoSeed(db))?.photos.map(p => p.id))
  if (ids.some(id => showcase.has(id))) {
    throw createError({ statusCode: 403, statusMessage: 'Demo photos can\'t be deleted for good' })
  }
}

async function readDemoSeed(db: Db): Promise<DemoSeed | null> {
  const row = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, DEMO_SEED_KEY)).get()
  try {
    const seed: unknown = row ? JSON.parse(row.value) : null
    return isDemoSeed(seed) ? seed : null
  }
  catch {
    return null
  }
}

// Each Worker instance looks at most once a minute, so nearly every request costs nothing.
const CHECK_EVERY_MS = 60_000
let checkedAt = 0

// The nightly reset, run by the first API request of each day at the event (server/middleware).
// Moving the day on is one conditional write, and only the request whose write changed the row
// gets it back, so one request runs the reset while the others carry on.
export async function resetDemoIfNewDay(event: H3Event) {
  const now = Date.now()
  if (now - checkedAt < CHECK_EVERY_MS || !isDemo(event)) return
  checkedAt = now
  const db = useDb(event)
  try {
    const day = JSON.stringify(demoDay(now))
    const moved = await db.insert(settings).values({ key: DEMO_DAY_KEY, value: day, updatedAt: now })
      .onConflictDoUpdate({ target: settings.key, set: { value: day, updatedAt: now }, setWhere: sql`${settings.value} <> excluded.value` })
      .returning({ key: settings.key })
    if (!moved.length) return
    try {
      await resetDemo(event, db)
    }
    catch (error) {
      // The next look, a minute on, tries again: every step can safely run twice.
      await db.delete(settings).where(eq(settings.key, DEMO_DAY_KEY)).run()
      throw error
    }
  }
  catch (error) {
    console.error('Demo reset failed', error)
  }
}

// Puts the snapshot back. Visitors' files go first, so a reset that fails partway leaves their
// rows to try again from, never files nothing points to.
async function resetDemo(event: H3Event, db: Db) {
  if (!(await readDemoSeed(db))) {
    console.error('Demo mode is on but has no snapshot: run scripts/demo-snapshot.ts')
    return
  }
  const sent = await db.select({ thumbKey: photos.thumbKey, largeKey: photos.largeKey }).from(photos)
    .where(and(visitorPhoto, isNull(photos.filesDeletedAt))).all()
  await removePhotoFiles(event, ...sent.flatMap(p => [p.thumbKey, p.largeKey]))

  // One list from the snapshot, as rows of JSON (`j.value`), read inside each statement.
  const seed = (list: keyof DemoSeed) => sql.raw(`settings, json_each(settings.value, '$.${list}') j where settings.key = '${DEMO_SEED_KEY}'`)
  const field = (name: string) => sql.raw(`json_extract(j.value, '$.${name}')`)
  // One transaction. No values in these statements (see seedKey).
  await db.batch([
    db.run(sql`delete from photo_likes`),
    db.run(sql`delete from photos where ${visitorPhoto}`),
    // Removed ones first: two copies of one file can't both be in the gallery (photos_active_hash),
    // so a copy the snapshot removed must go before one it shows comes back.
    db.run(sql`update photos set removed = 1 where id in (select ${field('id')} from ${seed('photos')} and ${field('removed')})`),
    db.run(sql`update photos set verdict = s.verdict, reject_reason = s.reject_reason, checked_at = s.checked_at, challenge_id = s.challenge_id, label = s.label,
        removed = s.removed, removed_at = s.removed_at
      from (select ${field('id')} id, ${field('verdict')} verdict, ${field('rejectReason')} reject_reason, ${field('checkedAt')} checked_at,
        ${field('challengeId')} challenge_id, ${field('label')} label, ${field('removed')} removed, ${field('removedAt')} removed_at from ${seed('photos')}) s
      where photos.id = s.id`),
    db.run(sql`insert into photo_likes (photo_id, device_id, liked_at) select ${field('photoId')}, ${field('deviceId')}, ${field('likedAt')} from ${seed('likes')}`),
    db.run(sql`update photos set likes = (select count(*) from photo_likes where photo_likes.photo_id = photos.id)`),
    db.run(sql`delete from station_scores`),
    db.run(sql`insert into station_scores (group_id, station_id, raw, missed, updated_at) select ${field('groupId')}, ${field('stationId')}, ${field('raw')}, ${field('missed')}, ${field('updatedAt')} from ${seed('scores')}`),
    // Every setting but demo mode's own, the scoreboard cache with them.
    db.run(sql`delete from settings where key not in (${seedKey}, ${dayKey})`),
    db.run(sql`insert into settings (key, value, updated_at) select ${field('key')}, ${field('value')}, ${field('updatedAt')} from ${seed('settings')}`),
    db.run(sql`update groups set name = s.name, leader = s.leader
      from (select ${field('id')} id, ${field('name')} name, ${field('leader')} leader from ${seed('groups')}) s where groups.id = s.id`),
    db.run(sql`delete from blocked_devices`),
    db.run(sql`delete from login_attempts`),
  ])
  console.log(`Demo reset: ${sent.length} visitors' photos deleted`)
}
