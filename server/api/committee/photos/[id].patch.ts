import { and, eq, isNull } from 'drizzle-orm'
import { blockedDevices, photos } from '../../../db/schema'

type Action =
  | { action: 'pass' | 'reject', reason?: string, force?: boolean }
  | { action: 'undo' }
  | { action: 'challenge', challengeId: string | null, label?: string | null }
  | { action: 'label', label: string }
  | { action: 'remove' | 'restore' }
  | { action: 'delete' }
  | { action: 'inappropriate', block?: boolean }

// One endpoint for every judging action. Pass and reject only apply to an unchecked photo
// unless forced, so two judges can't silently overwrite each other.
export default defineEventHandler(async (event) => {
  await requireCommittee(event)
  const db = useDb(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<Action>(event)
  const photo = await db.select().from(photos).where(eq(photos.id, id)).get()
  if (!photo) throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  // For the refusal log (server/plugins/refusal-log.ts), as requireGroup does on group links.
  event.context.groupId = photo.groupId
  // A photo deleted for good stays deleted: only deleting again (to retry its files) is allowed.
  if (filesDeleted(photo) && body.action !== 'delete' && body.action !== 'inappropriate') {
    throw createError({ statusCode: 409, statusMessage: 'This photo was deleted' })
  }
  const live = and(eq(photos.id, id), notFilesDeleted)
  const now = Date.now()

  switch (body.action) {
    case 'pass':
    case 'reject': {
      const verdict = body.action === 'pass' ? 'passed' : 'rejected'
      const reason = body.action === 'reject' ? (body.reason?.trim().slice(0, 120) || 'Doesn\'t match the challenge') : null
      const where = body.force ? live : and(live, isNull(photos.checkedAt))
      const result = await db.update(photos).set({ verdict, rejectReason: reason, checkedAt: now }).where(where).run()
      if (changedRows(result) === 0) {
        const current = await db.select().from(photos).where(eq(photos.id, id)).get()
        throw createError({ statusCode: 409, statusMessage: 'Someone else already checked this photo', data: { verdict: current?.verdict, rejectReason: current?.rejectReason } })
      }
      break
    }
    case 'undo':
      await db.update(photos).set({ verdict: 'pending', rejectReason: null, checkedAt: null }).where(live).run()
      break
    case 'challenge': {
      // Moving it is the committee's call that it belongs there, so any rejection goes.
      const target = await resolvePhotoTarget(db, body.challengeId, body.label, { allowRetired: true })
      await db.update(photos).set({ ...target, verdict: 'pending', rejectReason: null, checkedAt: null }).where(live).run()
      break
    }
    case 'label':
      if (typeof body.label !== 'string') throw createError({ statusCode: 400, statusMessage: 'Type a name' })
      await db.update(photos).set({ label: cleanName(body.label) }).where(live).run()
      break
    case 'remove':
      await db.update(photos).set({ removed: true, removedAt: now }).where(and(live, eq(photos.removed, false))).run()
      break
    case 'restore': {
      const outcome = (await restorePhotos(db, [photo])).get(id)
      if (outcome === 'copy-in-gallery') throw createError({ statusCode: 409, statusMessage: 'Another copy of this photo is already in the gallery' })
      if (outcome === 'deleted-for-good') throw createError({ statusCode: 409, statusMessage: 'This photo was deleted for good' })
      break
    }
    case 'delete': {
      // Deleted by the committee, as from Hidden photos: the files go, the record stays so counts
      // can be explained. The record is marked first, so a finish still running for this photo
      // cleans up after itself.
      await refuseShowcaseDelete(event, db, [id])
      await db.update(photos).set({ removed: true, rejectReason: FILES_DELETED.committee, checkedAt: now, filesDeletedAt: now }).where(eq(photos.id, id)).run()
      await removePhotoFiles(event, photo.thumbKey, photo.largeKey)
      break
    }
    case 'inappropriate': {
      // Gone for good, and optionally the phone that sent it can't upload again.
      await refuseShowcaseDelete(event, db, [id])
      await db.update(photos).set({ removed: true, verdict: 'rejected', rejectReason: FILES_DELETED.inappropriate, checkedAt: now, filesDeletedAt: now }).where(eq(photos.id, id)).run()
      await removePhotoFiles(event, photo.thumbKey, photo.largeKey)
      if (body.block && photo.deviceId) {
        await db.insert(blockedDevices).values({ deviceId: photo.deviceId, groupId: photo.groupId, blockedAt: now }).onConflictDoNothing().run()
      }
      break
    }
    default:
      throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
  }

  return db.select().from(photos).where(eq(photos.id, id)).get()
})
