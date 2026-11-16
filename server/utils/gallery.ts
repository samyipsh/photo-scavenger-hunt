import type { H3Event } from 'h3'
import { and, asc, eq, inArray } from 'drizzle-orm'
import { challenges, groups, photos } from '../db/schema'

type PhotoRow = typeof photos.$inferSelect

// A photo as the gallery's answers carry it: /api/gallery for everyone, and the committee's
// Hidden photos (/api/committee/photos/hidden), which shows the same tiles and photo view.
export function useGalleryPhoto(event: H3Event) {
  const link = usePhotoLinks(event)
  return async (p: PhotoRow) => ({
    id: p.id,
    groupId: p.groupId,
    challengeId: p.challengeId,
    label: p.label,
    uploadedAt: p.uploadedAt,
    uploaderName: p.uploaderName,
    likes: p.likes,
    // Set only when a judge said it doesn't count; the committee sees it in the photo view.
    rejectReason: p.verdict === 'rejected' ? (p.rejectReason ?? 'Doesn\'t match the challenge') : null,
    // Not looked at by a judge yet: the committee can pass a section's worth at once.
    unchecked: p.verdict === 'pending',
    width: p.width,
    height: p.height,
    thumbUrl: await link(p.thumbKey),
    largeUrl: await link(p.largeKey),
  })
}

// What the gallery's answers carry with their photos, so a page can name and open them: every
// group (hidden last), every challenge in the challenge list's order, and how photo times read
// (Manage › Controls).
export async function galleryMeta(db: Db) {
  const [groupRows, challengeRows, photoTimes] = await Promise.all([
    db.select({ id: groups.id, number: groups.number, name: groups.name }).from(groups).orderBy(asc(groups.hidden), asc(groups.number)).all(),
    db.select({ id: challenges.id, title: challenges.title, type: challenges.type, awardKind: challenges.awardKind, animal: challenges.animal, points: challenges.points, whoInShot: challenges.whoInShot, hint: challenges.hint, active: challenges.active }).from(challenges).orderBy(asc(challenges.sort)).all(),
    getPhotoTimes(db),
  ])
  return { groups: groupRows, challenges: challengeRows, photoTimes }
}

// What became of each photo asked to come back.
export type RestoreOutcome = 'restored' | 'copy-in-gallery' | 'deleted-for-good'

// Brings back photos the committee hid (from the judge's ⋯ menu or the gallery's Select), files
// and all, in a few queries however many there are, since D1 allows only 50 a request on the free
// plan. A photo stays out while another copy of the same file is in the
// gallery (the unique index on active hashes would refuse it anyway), and of two copies asked for
// together only the first comes back. One already back counts as restored, so a retry is safe;
// one deleted for good, even a moment ago, never comes back. A copy that arrives between the
// check and the update makes the update fail as a whole: nothing changes, it answers 409 "Try
// again", and asking again sorts it out.
export async function restorePhotos(db: Db, rows: PhotoRow[]): Promise<Map<string, RestoreOutcome>> {
  const out = new Map<string, RestoreOutcome>()
  const wanted: PhotoRow[] = []
  for (const r of rows) {
    if (filesDeleted(r)) out.set(r.id, 'deleted-for-good')
    else if (!r.removed) out.set(r.id, 'restored')
    else wanted.push(r)
  }
  const hashes = [...new Set(wanted.map(r => r.contentHash).filter((h): h is string => !!h))]
  const taken = new Set(hashes.length
    ? (await db.select({ hash: photos.contentHash }).from(photos).where(and(inArray(photos.contentHash, hashes), eq(photos.removed, false))).all()).map(r => r.hash)
    : [])
  const chosen: string[] = []
  for (const r of wanted) {
    if (r.contentHash && taken.has(r.contentHash)) {
      out.set(r.id, 'copy-in-gallery')
      continue
    }
    if (r.contentHash) taken.add(r.contentHash)
    chosen.push(r.id)
  }
  if (!chosen.length) return out
  const updated = await db.update(photos).set({ removed: false, removedAt: null })
    .where(and(inArray(photos.id, chosen), eq(photos.removed, true), notFilesDeleted))
    .returning({ id: photos.id })
    .catch((err) => {
      if (`${err} ${(err as { cause?: unknown })?.cause ?? ''}`.includes('UNIQUE')) {
        throw createError({ statusCode: 409, statusMessage: 'A copy just arrived in the gallery. Try again.' })
      }
      throw err
    })
  const back = new Set(updated.map(r => r.id))
  // Not changed: deleted for good meanwhile, or already restored by someone else.
  const missed = chosen.filter(id => !back.has(id))
  const now = missed.length
    ? await db.select({ id: photos.id, removed: photos.removed, filesDeletedAt: photos.filesDeletedAt }).from(photos).where(inArray(photos.id, missed)).all()
    : []
  for (const id of chosen) out.set(id, 'deleted-for-good')
  for (const id of back) out.set(id, 'restored')
  for (const r of now) if (!r.removed && !filesDeleted(r)) out.set(r.id, 'restored')
  return out
}
