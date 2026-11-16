import { and, eq } from 'drizzle-orm'
import { photos } from '../../../db/schema'

// The phone that sent a photo can move it to another challenge (or to just a photo) or take it
// down. Moving puts it back in the judge's queue.
type Body = { action: 'move', challengeId: string | null, label?: string | null } | { action: 'remove' }

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const deviceId = readDeviceId(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<Body>(event)
  const photo = await db.select().from(photos).where(eq(photos.id, id)).get()
  // Removing again is allowed once the files are marked deleted, so a removal whose file delete
  // failed can be retried, whoever deleted it.
  if (!photo || (photo.removed && !(photo.filesDeletedAt && body.action === 'remove'))) {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }
  // For the refusal log (server/plugins/refusal-log.ts), as requireGroup does on group links.
  event.context.groupId = photo.groupId
  assertSentBy(photo, deviceId)

  if (body.action === 'remove') {
    await refuseShowcaseDelete(event, db, [id])
    // Marked first, so a finish still running for this photo cleans up after itself.
    if (!photo.filesDeletedAt) {
      const now = Date.now()
      await db.update(photos).set({ removed: true, rejectReason: FILES_DELETED.sender, checkedAt: now, filesDeletedAt: now }).where(eq(photos.id, id)).run()
    }
    await removePhotoFiles(event, photo.thumbKey, photo.largeKey)
    return { ok: true }
  }

  if (body.action !== 'move') throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
  await assertUploadsOpen(db)
  await assertDeviceAllowed(db, deviceId)
  const { challengeId, label } = await resolvePhotoTarget(db, body.challengeId, body.label)
  // Moving to where it already is changes nothing, so it can't undo a judge's verdict.
  if (challengeId === photo.challengeId && (label ?? null) === (photo.label ?? null)) return { ok: true }
  await db.update(photos)
    .set({ challengeId, label, verdict: 'pending', rejectReason: null, checkedAt: null })
    .where(and(eq(photos.id, id), notFilesDeleted)).run()
  return { ok: true }
})
