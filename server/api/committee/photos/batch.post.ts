import { and, eq, inArray } from 'drizzle-orm'
import { photos } from '../../../db/schema'

// Why a photo in a batch was left as it was.
type BatchRefusal = 'not-found' | 'already-hidden' | 'deleted-for-good' | 'copy-in-gallery' | 'in-gallery'

// The committee's Select, on up to COMMITTEE_BATCH photos at once:
// - remove (Hide, in the gallery): out of the gallery and into Hidden photos, files kept, as the
//   judge's Hide does;
// - restore (Unhide, in Hidden photos): back into the gallery, unless another copy of the same
//   file is there now;
// - delete: deleted for good, files and all. Only photos already hidden, so a selection in the
//   gallery can't skip that step.
// For remove, `done` is only what this request hid, read back from the update itself, so a Hide's
// Undo puts back only what it took out, never a photo another committee member hid meanwhile.
// Restore and delete also count photos already back or already marked as done, so a retry reads
// as success and a delete can finish an earlier try's files. Everything else is in `refused`, with
// why. Every action is safe to retry, and each takes a handful of queries however many photos it's
// given.
export default defineEventHandler(async (event) => {
  await requireCommittee(event)
  const body = await readBody<{ ids?: unknown, action?: unknown }>(event)
  const action = body?.action
  if (action !== 'remove' && action !== 'restore' && action !== 'delete') {
    throw createError({ statusCode: 400, statusMessage: 'Unknown action' })
  }
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids.filter((x): x is string => typeof x === 'string' && UUID_PATTERN.test(x)))] : []
  if (!ids.length || ids.length > COMMITTEE_BATCH) {
    throw createError({ statusCode: 400, statusMessage: `Send 1 to ${COMMITTEE_BATCH} photos at a time` })
  }

  const db = useDb(event)
  const rows = await db.select().from(photos).where(inArray(photos.id, ids)).all()
  const found = new Set(rows.map(r => r.id))
  const done: string[] = []
  const refused: { id: string, reason: BatchRefusal }[] = ids.filter(id => !found.has(id)).map(id => ({ id, reason: 'not-found' as const }))
  const refuse = (id: string, reason: BatchRefusal) => refused.push({ id, reason })

  if (action === 'remove') {
    const changed = new Set((await db.update(photos).set({ removed: true, removedAt: Date.now() })
      .where(and(inArray(photos.id, [...found]), eq(photos.removed, false), notFilesDeleted))
      .returning({ id: photos.id })).map(r => r.id))
    for (const r of rows) {
      if (changed.has(r.id)) done.push(r.id)
      else refuse(r.id, filesDeleted(r) ? 'deleted-for-good' : 'already-hidden')
    }
  }
  else if (action === 'restore') {
    for (const [id, outcome] of await restorePhotos(db, rows)) {
      if (outcome === 'restored') done.push(id)
      else refuse(id, outcome)
    }
  }
  else {
    // In demo mode, none if any is a showcase photo: the phone shows why, and keeps them ticked.
    await refuseShowcaseDelete(event, db, ids)
    // Mark them first, so a finish still running for one cleans up after itself, then delete the
    // files of every photo now marked, including ones marked by an earlier try whose files may
    // still be there. One restored meanwhile isn't marked, and keeps its files.
    const hiddenRows = rows.filter(r => r.removed)
    for (const r of rows) if (!r.removed) refuse(r.id, 'in-gallery')
    const now = Date.now()
    const marked = hiddenRows.length
      ? await db.update(photos).set({ rejectReason: FILES_DELETED.committee, checkedAt: now, filesDeletedAt: now })
        .where(and(inArray(photos.id, hiddenRows.map(r => r.id)), eq(photos.removed, true), notFilesDeleted))
        .returning({ id: photos.id, thumbKey: photos.thumbKey, largeKey: photos.largeKey })
      : []
    // Not marked here: restored meanwhile (in the gallery), or marked by another request just now
    // (deleted for good, so done, and its files go again here, which does no harm).
    const markedIds = new Set(marked.map(r => r.id))
    const missed = hiddenRows.filter(r => !markedIds.has(r.id) && !filesDeleted(r)).map(r => r.id)
    const reread = missed.length
      ? await db.select({ id: photos.id, removed: photos.removed, filesDeletedAt: photos.filesDeletedAt, thumbKey: photos.thumbKey, largeKey: photos.largeKey })
        .from(photos).where(inArray(photos.id, missed)).all()
      : []
    const gone = [...marked, ...hiddenRows.filter(r => filesDeleted(r)), ...reread.filter(r => filesDeleted(r))]
    for (const r of reread) if (!filesDeleted(r)) refuse(r.id, 'in-gallery')
    const keys = gone.flatMap(r => [r.thumbKey, r.largeKey])
    // R2 seldom fails; one more try, then the request fails and the phone keeps these in Hidden
    // photos to try again. The line says which files are left, for the logs.
    await removePhotoFiles(event, ...keys).catch(() => removePhotoFiles(event, ...keys)).catch((err) => {
      console.error('[files-left]', JSON.stringify(keys))
      throw err
    })
    done.push(...gone.map(r => r.id))
  }

  return { done, refused }
})
