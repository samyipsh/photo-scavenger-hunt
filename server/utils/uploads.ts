import type { H3Event } from 'h3'
import { and, count, eq, isNull, ne } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { challenges, groups, photos } from '../db/schema'

export interface Admission {
  id: string
  // Already saved for this group: a retry after a lost response, so there's nothing to do.
  saved: boolean
  challengeId: string | null
  label: string | null
  hash: string | null
  deviceId: string | null
}

// What the phone says about a photo, on both start and finish.
export interface PhotoDetails {
  challengeId?: unknown
  label?: unknown
  hash?: unknown
}

// Every check a photo must pass. Start runs them before the phone sends any bytes, so a refused
// photo (a duplicate, closed uploads, a blocked phone) never sends its 1 to 3 MB album copy;
// finish runs them again, plus the group limits, in case anything changed in between.
export async function admitUpload(event: H3Event, db: Db, group: typeof groups.$inferSelect, details: PhotoDetails, options: { countLimits: boolean }): Promise<Admission> {
  const id = getRouterParam(event, 'id') ?? ''
  if (!UUID_PATTERN.test(id)) throw createError({ statusCode: 400, statusMessage: 'Bad photo ID' })

  const existing = await db.select({ groupId: photos.groupId }).from(photos).where(eq(photos.id, id)).get()
  if (existing) {
    if (existing.groupId !== group.id) throw createError({ statusCode: 400, statusMessage: 'Photo ID already used' })
    return { id, saved: true, challengeId: null, label: null, hash: null, deviceId: null }
  }

  await assertUploadsOpen(db)
  // Every upload names its phone, so a blocked phone can't slip through by leaving it out.
  const deviceId = readDeviceId(event)
  if (!deviceId) throw createError({ statusCode: 400, statusMessage: 'Reload the page and try again' })
  await assertDeviceAllowed(db, deviceId)
  await assertDemoRoom(event, db)

  const { challengeId, label } = await resolvePhotoTarget(db, details.challengeId, details.label)

  // The exact same photo file is only ever accepted once: twice in one group it would count
  // twice for Most photos or for two challenges, and a copy of another group's photo isn't
  // theirs. That also settles "the all-groups photo counts for the first group to send it".
  // A photo resent through WhatsApp is recompressed, so it won't match.
  const hash = typeof details.hash === 'string' && /^[0-9a-f]{64}$/.test(details.hash) ? details.hash : null
  if (hash) await refuseIfSentBefore(db, group, hash)

  // Group limits count rows, so they run once, on finish, which creates the record. They count
  // the photos in the gallery, as the group page does, so "N left" there matches what's allowed.
  // They're far above what a group sends in a morning.
  if (options.countLimits) {
    const kept = and(eq(photos.groupId, group.id), eq(photos.removed, false))
    const groupCount = await db.select({ n: count() }).from(photos).where(kept).get()
    if (!challengeId) {
      const loose = await db.select({ n: count() }).from(photos).where(and(kept, isNull(photos.challengeId))).get()
      if ((loose?.n ?? 0) >= MAX_JUST_A_PHOTO_PER_GROUP) {
        throw createError({ statusCode: 429, statusMessage: `Your group has reached ${MAX_JUST_A_PHOTO_PER_GROUP} photos without a challenge`, data: { code: 'group-limit' } })
      }
    }
    if ((groupCount?.n ?? 0) >= MAX_PHOTOS_PER_GROUP) {
      throw createError({ statusCode: 429, statusMessage: `Your group has reached ${MAX_PHOTOS_PER_GROUP} photos`, data: { code: 'group-limit' } })
    }
  }

  return { id, saved: false, challengeId, label, hash, deviceId }
}

// Refuses a photo file this group or another group already sent. Also used when the database's
// unique index catches two phones sending the same file at the same moment.
export async function refuseIfSentBefore(db: Db, group: typeof groups.$inferSelect, hash: string): Promise<void> {
  const same: SQL[] = [eq(photos.groupId, group.id), eq(photos.contentHash, hash), eq(photos.removed, false)]
  const earlier = await db.select({ id: photos.id, challengeId: photos.challengeId }).from(photos).where(and(...same)).get()
  if (earlier) {
    const title = earlier.challengeId
      ? (await db.select({ title: challenges.title }).from(challenges).where(eq(challenges.id, earlier.challengeId)).get())?.title
      : null
    // Which photo it was, so a "just a photo" can be put to use for a challenge instead.
    throw createError({
      statusCode: 422,
      statusMessage: title ? `Already sent for ${title}.` : 'Already sent as just a photo.',
      data: { code: 'already-sent', photoId: earlier.id, challengeId: earlier.challengeId },
    })
  }
  const elsewhere = await db.select({ id: photos.id }).from(photos)
    .where(and(eq(photos.contentHash, hash), eq(photos.removed, false), ne(photos.groupId, group.id))).get()
  if (elsewhere) throw createError({ statusCode: 422, statusMessage: 'Another group already sent this photo.', data: { code: 'sent-by-another-group' } })
}
