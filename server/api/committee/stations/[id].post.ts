import { and, eq } from 'drizzle-orm'
import { groups, stationScores, stations } from '../../../db/schema'

// Save one group's score. The form says which version it's replacing; if someone else saved
// in the meantime, nothing changes and the IC sees the newer score.
export default defineEventHandler(async (event) => {
  await requireCommittee(event)
  const db = useDb(event)
  const stationId = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ groupId: string, raw: number | null, missed: boolean, expectedUpdatedAt: number | null }>(event)

  const [station, group] = await Promise.all([
    db.select().from(stations).where(eq(stations.id, stationId)).get(),
    db.select().from(groups).where(eq(groups.id, body.groupId)).get(),
  ])
  if (!station?.scored || !group || group.hidden) throw createError({ statusCode: 404, statusMessage: 'Station or group not found' })
  // For the refusal log (server/plugins/refusal-log.ts), which names the group.
  event.context.groupId = group.id
  const raw = body.missed || body.raw === null ? null : Number(body.raw)
  if (raw !== null && (!Number.isFinite(raw) || raw < -1000 || raw > 100000)) {
    throw createError({ statusCode: 400, statusMessage: 'That score doesn\'t look like a number' })
  }

  const now = Date.now()
  const values = { raw, missed: !!body.missed, updatedAt: now }
  const result = body.expectedUpdatedAt === null
    ? await db.insert(stationScores).values({ groupId: group.id, stationId, ...values }).onConflictDoNothing().run()
    : await db.update(stationScores).set(values).where(and(
        eq(stationScores.groupId, group.id),
        eq(stationScores.stationId, stationId),
        eq(stationScores.updatedAt, body.expectedUpdatedAt),
      )).run()

  const current = await db.select().from(stationScores)
    .where(and(eq(stationScores.groupId, group.id), eq(stationScores.stationId, stationId))).get()
  if (changedRows(result) === 0) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Someone else changed this score',
      data: { raw: current?.raw ?? null, missed: current?.missed ?? false, updatedAt: current?.updatedAt ?? null },
    })
  }
  return { raw: current!.raw, missed: current!.missed, updatedAt: current!.updatedAt }
})
