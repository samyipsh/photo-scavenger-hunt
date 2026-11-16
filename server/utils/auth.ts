import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { groups } from '../db/schema'

const TOKEN_PATTERN = /^[\w-]{20,64}$/

export async function requireGroup(event: H3Event, db: Db) {
  const token = getRouterParam(event, 'token') ?? ''
  if (!TOKEN_PATTERN.test(token)) throw createError({ statusCode: 404, statusMessage: 'Group link not found' })
  const group = await db.select().from(groups).where(eq(groups.token, token)).get()
  if (!group) throw createError({ statusCode: 404, statusMessage: 'Group link not found' })
  // For the refusal log (server/plugins/refusal-log.ts), which names the group, not its token.
  event.context.groupId = group.id
  return group
}

export async function requireCommittee(event: H3Event) {
  const session = await requireUserSession(event)
  if ((session.user as { role?: string }).role !== 'committee') {
    throw createError({ statusCode: 401, statusMessage: 'Committee sign-in needed' })
  }
}
