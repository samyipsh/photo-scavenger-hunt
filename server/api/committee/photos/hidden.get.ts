import { and, desc, eq } from 'drizzle-orm'
import { photos } from '../../../db/schema'

// The committee's Hidden photos page (/c/hidden): photos taken out of the gallery with their
// files kept (Hide, in the gallery's Select or the judge's ⋯ menu), the latest hidden first, then
// those hidden before that was kept, newest first. Unhide puts one back; Delete for good removes
// its files. Photos deleted for good, and those their senders
// removed, aren't here: their files are gone. In demo mode, those this phone may see
// (server/utils/demo.ts). With the gallery's groups and challenges, to name them.
export default defineEventHandler(async (event) => {
  await requireCommittee(event)
  const db = useDb(event)
  const [rows, meta] = await Promise.all([
    db.select().from(photos)
      .where(and(eq(photos.removed, true), notFilesDeleted, demoPhotos(event)))
      .orderBy(desc(photos.removedAt), desc(photos.uploadedAt), desc(photos.id)).all(),
    galleryMeta(db),
  ])
  const toPhoto = useGalleryPhoto(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  return { photos: await Promise.all(rows.map(toPhoto)), ...meta }
})
