import { and, eq } from 'drizzle-orm'
import { cleanLeader, groupName } from '#shared/utils/groups'
import { groups } from '../../../db/schema'

// The committee sets or clears a group's IC. The name every page shows is rebuilt with it.
// The example group has no IC.
export default defineEventHandler(async (event) => {
  await requireCommittee(event)
  const db = useDb(event)
  const id = getRouterParam(event, 'id') ?? ''
  const body = await readBody<{ leader?: unknown }>(event)
  const group = await db.select().from(groups).where(and(eq(groups.id, id), eq(groups.hidden, false))).get()
  if (!group) throw createError({ statusCode: 404, statusMessage: 'Group not found' })
  const leader = cleanLeader(body?.leader)
  const name = groupName(group.number, leader)
  await db.update(groups).set({ leader, name }).where(eq(groups.id, id)).run()
  return { id, leader, name }
})
