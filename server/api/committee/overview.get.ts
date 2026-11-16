import { asc, count, eq, isNull, and } from 'drizzle-orm'
import { blockedDevices, groups, photos, stationScores, stations } from '../../db/schema'

// Committee lead's page: the live board, every raw score and the switches.
export default defineEventHandler(async (event) => {
  await requireCommittee(event)
  const db = useDb(event)
  const [board, stationRows, groupRows, scoreRows, totals, unchecked, hiddenPhotos, uploadsOpen, frozen, blocked, firstRoundAt, photoTimes, typesShown] = await Promise.all([
    buildScoreboard(db, Date.now(), demoPhotos(event)),
    db.select().from(stations).orderBy(asc(stations.slot)).all(),
    db.select({ id: groups.id, number: groups.number, name: groups.name, leader: groups.leader, token: groups.token, startSlot: groups.startSlot, hidden: groups.hidden }).from(groups).orderBy(asc(groups.hidden), asc(groups.number)).all(),
    db.select().from(stationScores).all(),
    db.select({ n: count() }).from(photos).where(and(eq(photos.removed, false), demoPhotos(event))).get(),
    db.select({ n: count() }).from(photos).where(and(isNull(photos.checkedAt), eq(photos.removed, false), demoPhotos(event))).get(),
    // In Hidden photos: out of the gallery, files kept.
    db.select({ n: count() }).from(photos).where(and(eq(photos.removed, true), notFilesDeleted, demoPhotos(event))).get(),
    getSetting(db, 'uploads_open', true),
    getSetting(db, 'scoreboard_frozen', null),
    db.select().from(blockedDevices).orderBy(asc(blockedDevices.blockedAt)).all(),
    getFirstRoundAt(db),
    getPhotoTimes(db),
    getTypesShown(db),
  ])
  return {
    firstRoundAt,
    photoTimes,
    board,
    stations: stationRows,
    groups: groupRows,
    scores: scoreRows,
    photoTotal: totals?.n ?? 0,
    unchecked: unchecked?.n ?? 0,
    hiddenPhotos: hiddenPhotos?.n ?? 0,
    uploadsOpen,
    typesShown,
    frozenAt: frozen?.frozenAt ?? null,
    blocked,
  }
})
