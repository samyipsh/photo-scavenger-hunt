import { asc, eq } from 'drizzle-orm'
import { groups, stationScores, stations } from '../../../db/schema'

export default defineEventHandler(async (event) => {
  await requireCommittee(event)
  const db = useDb(event)
  const id = getRouterParam(event, 'id') ?? ''
  const station = await db.select().from(stations).where(eq(stations.id, id)).get()
  if (!station || !station.scored) throw createError({ statusCode: 404, statusMessage: 'Station not found' })
  const [groupRows, scoreRows, firstRoundAt] = await Promise.all([
    db.select({ id: groups.id, number: groups.number, name: groups.name, startSlot: groups.startSlot }).from(groups).where(eq(groups.hidden, false)).orderBy(asc(groups.number)).all(),
    db.select().from(stationScores).where(eq(stationScores.stationId, id)).all(),
    getFirstRoundAt(db),
  ])
  return {
    firstRoundAt,
    station,
    groups: groupRows.map(g => {
      const s = scoreRows.find(r => r.groupId === g.id)
      return { ...g, raw: s?.raw ?? null, missed: s?.missed ?? false, updatedAt: s?.updatedAt ?? null }
    }),
  }
})
