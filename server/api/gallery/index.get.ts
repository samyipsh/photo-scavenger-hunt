import { and, desc, eq, type SQL } from 'drizzle-orm'
import { photos } from '../../db/schema'

// Every photo in the gallery, newest first, in one answer that's the same for everyone. The
// phone filters, sorts and shows it a screenful at a time, so changing a filter, sorting by likes
// or Select all needs no request. What this phone liked or sent comes from /api/gallery/mine, so
// nothing here depends on who asks. docs/caching.md says why one answer, and when to page instead.
// In demo mode, the showcase photos only: each visitor's own come from /api/gallery/mine.
// `?photo=<id>` is that one photo, for a link straight to it and for a fresh view link.
// The answer carries an ETag, so a phone asking again gets 304 and no body when nothing changed.
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const query = getQuery(event)
  const filters: SQL[] = [eq(photos.removed, false)]
  if (typeof query.photo === 'string' && query.photo) filters.push(eq(photos.id, query.photo))

  const [rows, meta] = await Promise.all([
    db.select().from(photos).where(and(...filters, demoPhotos(event, 'everyone'))).orderBy(desc(photos.uploadedAt), desc(photos.id)).all(),
    galleryMeta(db),
  ])

  const toPhoto = useGalleryPhoto(event)
  return sendWithEtag(event, {
    photos: await Promise.all(rows.map(toPhoto)),
    // The groups, the challenges, and how the photo view shows each photo's time (Manage › Controls).
    ...meta,
  })
})
