import { asc, eq } from 'drizzle-orm'
import { groups } from '../db/schema'

// Group links are open on purpose: anyone can open any group's page, so groups can help each
// other upload. The link is a shortcut, not a lock.
export default defineEventHandler(async (event) => {
  return useDb(event)
    .select({ id: groups.id, number: groups.number, name: groups.name, leader: groups.leader, token: groups.token })
    .from(groups)
    .where(eq(groups.hidden, false))
    .orderBy(asc(groups.number))
    .all()
})
