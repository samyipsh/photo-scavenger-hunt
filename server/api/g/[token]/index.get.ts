import { and, asc, desc, eq } from 'drizzle-orm'
import { challenges, photoLikes, photos, stations } from '../../../db/schema'
import { animalFor, groupPhotoTotals } from '#shared/utils/scoring'

// Everything the group page needs in one request: the group, rotation, challenge list and
// this group's own photos (in demo mode, those this phone may see: server/utils/demo.ts).
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const group = await requireGroup(event, db)

  const [stationRows, challengeRows, photoRows, uploadsOpen, blocked, firstRoundAt, photoTimes] = await Promise.all([
    db.select().from(stations).orderBy(asc(stations.slot)).all(),
    // Every challenge, retired ones too, so totals match the scoreboard; the page lists active ones.
    db.select().from(challenges).orderBy(asc(challenges.sort)).all(),
    db.select().from(photos).where(and(eq(photos.groupId, group.id), eq(photos.removed, false), demoPhotos(event))).orderBy(desc(photos.uploadedAt)).all(),
    getSetting(db, 'uploads_open', true),
    isDeviceBlocked(db, readDeviceId(event)),
    getFirstRoundAt(db),
    getPhotoTimes(db),
  ])

  // The same totals the scoreboard uses, so the two never disagree.
  const challengeById = new Map(challengeRows.map(c => [c.id, c]))
  const totals = groupPhotoTotals(photoRows, challengeById)

  // Which of the group's photos this phone sent and liked, so the photo view works as in the gallery.
  const deviceId = readDeviceId(event)
  // This phone's likes, fetched whole rather than as an IN list of these photos: D1 allows at
  // most 100 values in one query, and a page holds up to 120 photos. A phone likes far fewer.
  const liked = deviceId
    ? new Set((await db.select({ id: photoLikes.photoId }).from(photoLikes).where(eq(photoLikes.deviceId, deviceId)).all()).map(r => r.id))
    : new Set<string>()

  const link = usePhotoLinks(event)
  return {
    firstRoundAt,
    group: { id: group.id, number: group.number, name: group.name, startSlot: group.startSlot, hidden: group.hidden },
    stations: stationRows,
    challenges: challengeRows.filter(c => c.active),
    // The same shape as the gallery's photos, so the same photo view opens them.
    photos: await Promise.all(photoRows.map(async p => ({
      id: p.id,
      groupId: p.groupId,
      challengeId: p.challengeId,
      label: p.label,
      // The animal it adds to Most animals spotted, by the scoreboard's rule, retired challenges
      // included: the race's sheet lists these, so its photos match its count.
      animal: p.challengeId ? animalFor(p, challengeById.get(p.challengeId)) : null,
      verdict: p.verdict,
      rejectReason: p.verdict === 'rejected' ? (p.rejectReason ?? 'Doesn\'t match the challenge') : null,
      unchecked: p.verdict === 'pending',
      uploadedAt: p.uploadedAt,
      uploaderName: p.uploaderName,
      likes: p.likes,
      liked: liked.has(p.id),
      mine: !!deviceId && p.deviceId === deviceId,
      width: p.width,
      height: p.height,
      thumbUrl: await link(p.thumbKey),
      largeUrl: await link(p.largeKey),
    }))),
    totals: {
      points: totals.points,
      photoCount: totals.photoCount,
      animals: [...totals.animals].sort(),
      colours: [...totals.colours].sort(),
    },
    uploadsOpen,
    photoTimes,
    // Whether the committee has blocked the phone asking.
    blocked,
    maxPhotos: MAX_PHOTOS_PER_GROUP,
    maxJustAPhoto: MAX_JUST_A_PHOTO_PER_GROUP,
  }
})
