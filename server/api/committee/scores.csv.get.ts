import { stationScores } from '../../db/schema'

// Backup export for the Google Sheet: one row per group with raw scores and rank points.
export default defineEventHandler(async (event) => {
  await requireCommittee(event)
  const db = useDb(event)
  const board = await buildScoreboard(db, Date.now(), demoPhotos(event))
  const scores = await db.select().from(stationScores).all()
  const header = ['Place', 'Group', 'Total', ...board.stations.flatMap(s => [`${s.name} raw`, `${s.name} points`]), 'Challenge points', 'Award bonus', 'Photo points', 'Animals', 'Flower colours', 'Photos']
  const rows = board.groups.map(g => [
    g.place,
    g.name,
    g.total,
    ...board.stations.flatMap((s) => {
      const e = scores.find(r => r.groupId === g.id && r.stationId === s.id)
      return [e?.missed ? 'missed' : (e?.raw ?? ''), g.stationPoints[s.id] ?? '']
    }),
    g.photoPoints,
    g.awardBonus,
    g.photoTotal,
    g.animals.length,
    g.colours.length,
    g.photoCount,
  ])
  const csv = [header, ...rows].map(r => r.map(v => `"${String(v).replaceAll('"', '""')}"`).join(',')).join('\n')
  setHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setHeader(event, 'content-disposition', 'attachment; filename="photo-quest-scores.csv"')
  return csv
})
