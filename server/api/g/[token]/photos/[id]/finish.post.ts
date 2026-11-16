import { eq } from 'drizzle-orm'
import { photos } from '../../../../../db/schema'

// Step 3 of an upload, after the phone has sent both files to storage. Runs the checks again,
// plus the group limits, checks what arrived, keeps it, and creates the photo record. The ID
// comes from the phone, so a retry after a lost response finds the record and changes nothing.
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const group = await requireGroup(event, db)
  const body = await readBody<PhotoDetails & { width?: unknown, height?: unknown, by?: unknown }>(event).catch(() => null) ?? {}
  const { id, saved, challengeId, label, hash, deviceId } = await admitUpload(event, db, group, body, { countLimits: true })
  if (saved) return { id, status: 'saved' }

  const store = usePhotoStore(event)
  const sent = uploadKeys(group.id, id)
  const [thumb, large] = await Promise.all([store.peek(sent.thumbKey), store.peek(sent.largeKey)])
  // Not there (yet): the phone starts this photo again and gets fresh links.
  if (!thumb || !large) throw createError({ statusCode: 409, statusMessage: 'Photo not received, sending again' })
  const kept = photoKeys(group.id, id, { thumb: thumb.etag, large: large.etag })
  for (const [file, max] of [[thumb, MAX_THUMB_BYTES], [large, MAX_LARGE_BYTES]] as const) {
    if (file.size === 0) throw createError({ statusCode: 409, statusMessage: 'Photo not received, sending again' })
    if (file.size > max) throw createError({ statusCode: 413, statusMessage: 'Photo too large' })
    if (!isJpeg(file.head)) throw createError({ statusCode: 415, statusMessage: 'Only JPEG photos are accepted' })
  }

  // Copied only if unchanged since the checks above, so what's kept is what was checked.
  const copied = await Promise.all([
    store.keep(sent.thumbKey, kept.thumbKey, thumb.etag),
    store.keep(sent.largeKey, kept.largeKey, large.etag),
  ])
  if (!copied.every(Boolean)) throw createError({ statusCode: 409, statusMessage: 'Photo changed while sending, sending again' })

  const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : null
  const inserted = await db.insert(photos).values({
    id,
    groupId: group.id,
    challengeId,
    label,
    ...kept,
    bytes: large.size,
    contentHash: hash,
    deviceId,
    uploaderName: cleanName(body.by),
    width: num(body.width),
    height: num(body.height),
    uploadedAt: Date.now(),
  }).onConflictDoNothing().run()
  if (changedRows(inserted) === 0) {
    const mine = await db.select({ thumbKey: photos.thumbKey, largeKey: photos.largeKey, filesDeletedAt: photos.filesDeletedAt }).from(photos).where(eq(photos.id, id)).get()
    if (!mine) {
      // Another phone's copy of the same file got in first, caught by the unique index on
      // active hashes. Nothing points at the files just kept, so they go.
      await removePhotoFiles(event, kept.thumbKey, kept.largeKey).catch(() => {})
      if (hash) await refuseIfSentBefore(db, group, hash)
      throw createError({ statusCode: 409, statusMessage: 'Couldn\'t save the photo, sending again' })
    }
    // Another finish for this photo got there first. If it kept different files, ours are unused.
    // If the photo has since been deleted for good, our copy may have put its files back: they go.
    const unused = filesDeleted(mine)
      ? [kept.thumbKey, kept.largeKey]
      : [kept.thumbKey, kept.largeKey].filter(k => k !== mine.thumbKey && k !== mine.largeKey)
    if (unused.length) await removePhotoFiles(event, ...unused).catch(() => {})
  }

  // The lifecycle rule on u/ clears anything left behind, so a failed delete doesn't matter.
  await Promise.all([store.remove(sent.thumbKey), store.remove(sent.largeKey)]).catch(() => {})
  setResponseStatus(event, 201)
  return { id, status: 'saved' }
})
