import { and, asc, count, eq, isNull } from 'drizzle-orm'
import { challenges, groups, photos } from '../../db/schema'

// Unchecked photos, oldest first. Judges can split the queue by group. One at a time needs only
// the next few; the grid (`all=1`) shows every one, up to 200.
export default defineEventHandler(async (event) => {
  await requireCommittee(event)
  const db = useDb(event)
  const query = getQuery(event)
  const group = typeof query.group === 'string' && query.group ? query.group : null
  const limit = query.all ? 200 : 12

  const unchecked = and(isNull(photos.checkedAt), eq(photos.removed, false), demoPhotos(event))
  const [rows, remaining, groupRows, challengeRows, photoTimes] = await Promise.all([
    db.select().from(photos).where(group ? and(unchecked, eq(photos.groupId, group)) : unchecked).orderBy(asc(photos.uploadedAt)).limit(limit).all(),
    db.select({ groupId: photos.groupId, n: count() }).from(photos).where(unchecked).groupBy(photos.groupId).all(),
    db.select({ id: groups.id, number: groups.number, name: groups.name, hidden: groups.hidden }).from(groups).orderBy(asc(groups.number)).all(),
    db.select().from(challenges).orderBy(asc(challenges.sort)).all(),
    getPhotoTimes(db),
  ])

  const link = usePhotoLinks(event)
  return {
    photos: await Promise.all(rows.map(async p => ({ ...p, thumbUrl: await link(p.thumbKey), largeUrl: await link(p.largeKey) }))),
    remaining: Object.fromEntries(remaining.map(r => [r.groupId, r.n])),
    groups: groupRows,
    challenges: challengeRows,
    photoTimes,
  }
})
