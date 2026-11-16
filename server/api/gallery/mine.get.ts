import { and, desc, eq } from 'drizzle-orm'
import { photoLikes, photos } from '../../db/schema'

// What this phone liked and sent, laid over the gallery's shared list: the hearts it filled in,
// and the photos it can move or remove. Small, and only ever about the phone asking. In demo mode
// also this phone's own photos in full (`photos`), since the shared list has the showcase only.
export default defineEventHandler(async (event) => {
  const deviceId = readDeviceId(event)
  const none: Awaited<ReturnType<ReturnType<typeof useGalleryPhoto>>>[] = []
  if (!deviceId) return { liked: [] as string[], sent: [] as string[], photos: none }
  const db = useDb(event)
  const [liked, sent, own] = await Promise.all([
    db.select({ id: photoLikes.photoId }).from(photoLikes).where(eq(photoLikes.deviceId, deviceId)).all(),
    db.select({ id: photos.id }).from(photos).where(and(eq(photos.deviceId, deviceId), eq(photos.removed, false))).all(),
    isDemo(event)
      ? db.select().from(photos).where(and(eq(photos.deviceId, deviceId), eq(photos.removed, false), visitorPhoto)).orderBy(desc(photos.uploadedAt), desc(photos.id)).all()
      : [],
  ])
  return {
    liked: liked.map(r => r.id),
    sent: sent.map(r => r.id),
    photos: own.length ? await Promise.all(own.map(useGalleryPhoto(event))) : none,
  }
})
