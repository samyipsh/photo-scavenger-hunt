import { and, asc, eq } from 'drizzle-orm'
import { groups, photos } from '../../db/schema'
import { FIRST_PHOTO_CHALLENGE } from '~~/data/challenges'
import { BRIEFING_CHECKLIST } from '~~/data/event'

// The briefing checklist: ticked items, plus which groups have sent their first photo.
export default defineEventHandler(async (event) => {
  await requireCommittee(event)
  const db = useDb(event)
  const [ticks, groupRows, firsts] = await Promise.all([
    getSetting(db, 'briefing_checklist', {}),
    db.select({ id: groups.id, number: groups.number, name: groups.name }).from(groups).where(eq(groups.hidden, false)).orderBy(asc(groups.number)).all(),
    db.select({ groupId: photos.groupId }).from(photos).where(and(eq(photos.challengeId, FIRST_PHOTO_CHALLENGE), eq(photos.removed, false), demoPhotos(event))).all(),
  ])
  const sent = new Set(firsts.map(f => f.groupId))
  return {
    items: BRIEFING_CHECKLIST,
    ticks,
    firstPhotos: groupRows.map(g => ({ ...g, sent: sent.has(g.id) })),
  }
})
