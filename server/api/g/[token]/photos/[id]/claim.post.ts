import { and, eq, isNull } from 'drizzle-orm'
import { photos } from '../../../../../db/schema'

// Puts a group's own "just a photo" to use for a challenge, for when someone picks a photo
// they already sent. It goes back in the judge's queue for that challenge. Only the phone that
// sent it may, as with any move.
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const group = await requireGroup(event, db)
  const id = getRouterParam(event, 'id') ?? ''
  await assertUploadsOpen(db)
  // Like an upload, it must name its phone, so a blocked phone can't slip through by leaving it out.
  const deviceId = readDeviceId(event)
  if (!deviceId) throw createError({ statusCode: 400, statusMessage: 'Reload the page and try again' })
  await assertDeviceAllowed(db, deviceId)

  const photo = await db.select({ deviceId: photos.deviceId }).from(photos).where(and(eq(photos.id, id), eq(photos.groupId, group.id))).get()
  if (photo) assertSentBy(photo, deviceId)

  const body = await readBody<{ challengeId?: string, label?: string | null }>(event)
  const { challengeId, label } = await resolvePhotoTarget(db, body.challengeId, body.label)
  if (!challengeId) throw createError({ statusCode: 400, statusMessage: 'That challenge is no longer on the list' })

  const result = await db.update(photos)
    .set({ challengeId, label, verdict: 'pending', rejectReason: null, checkedAt: null })
    .where(and(eq(photos.id, id), eq(photos.groupId, group.id), isNull(photos.challengeId), eq(photos.removed, false)))
    .run()
  if (changedRows(result) === 0) throw createError({ statusCode: 409, statusMessage: 'That photo is already used for a challenge' })
  return { ok: true }
})
