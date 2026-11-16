import { and, eq, sql } from 'drizzle-orm'
import { photoLikes, photos } from '../../../db/schema'

// Sets whether this phone likes a photo. The phone says which state it wants, so a repeated or
// overlapping request can't flip it the wrong way, and the count is recounted from the likes
// themselves in the same batch, so it never drifts. One like per phone.
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const deviceId = readDeviceId(event)
  if (!deviceId) throw createError({ statusCode: 400, statusMessage: 'This phone can\'t like photos' })
  const id = getRouterParam(event, 'id') ?? ''
  const photo = await db.select({ groupId: photos.groupId }).from(photos).where(and(eq(photos.id, id), eq(photos.removed, false))).get()
  if (!photo) throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  // For the refusal log (server/plugins/refusal-log.ts), as requireGroup does on group links.
  event.context.groupId = photo.groupId

  const mine = and(eq(photoLikes.photoId, id), eq(photoLikes.deviceId, deviceId))
  const body = await readBody<{ liked?: unknown } | null>(event).catch(() => null)
  if (typeof body?.liked !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Say whether it\'s liked' })
  const want = body.liked

  await db.batch([
    want
      ? db.insert(photoLikes).values({ photoId: id, deviceId, likedAt: Date.now() }).onConflictDoNothing()
      : db.delete(photoLikes).where(mine),
    db.update(photos).set({ likes: sql`(select count(*) from ${photoLikes} where ${photoLikes.photoId} = ${id})` }).where(eq(photos.id, id)),
  ])
  const row = await db.select({ likes: photos.likes }).from(photos).where(eq(photos.id, id)).get()
  return { likes: row?.likes ?? 0, liked: want }
})
