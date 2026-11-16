import { BRIEFING_CHECKLIST } from '~~/data/event'

// Ticks or unticks one briefing item, remembering when.
export default defineEventHandler(async (event) => {
  await requireCommittee(event)
  const db = useDb(event)
  const body = await readBody<{ id?: string, done?: boolean }>(event)
  if (!BRIEFING_CHECKLIST.some(i => i.id === body.id && !i.auto)) throw createError({ statusCode: 400, statusMessage: 'Unknown item' })
  const ticks = await getSetting(db, 'briefing_checklist', {})
  if (body.done) ticks[body.id!] = Date.now()
  else delete ticks[body.id!]
  await setSetting(db, 'briefing_checklist', ticks)
  return { ticks }
})
