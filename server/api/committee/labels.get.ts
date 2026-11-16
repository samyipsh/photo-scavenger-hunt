import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { challenges, photos } from '../../db/schema'
import { normaliseLabel } from '#shared/utils/scoring'

// Animal names as groups typed them, so a judge can merge "swan" and "black swan". Each name
// brings up to four of its newest photos, so the judge can see what was actually snapped.
export default defineEventHandler(async (event) => {
  await requireCommittee(event)
  const db = useDb(event)
  const rows = await db.select({ groupId: photos.groupId, label: photos.label, thumbKey: photos.thumbKey })
    .from(photos)
    .innerJoin(challenges, eq(challenges.id, photos.challengeId))
    .where(and(eq(challenges.awardKind, 'animal'), isNotNull(photos.label), eq(photos.removed, false), demoPhotos(event)))
    .orderBy(desc(photos.uploadedAt))
    .all()
  const byLabel = new Map<string, { label: string, count: number, groups: Set<string>, thumbKeys: string[] }>()
  for (const r of rows) {
    const key = normaliseLabel(r.label!)
    const entry = byLabel.get(key) ?? { label: key, count: 0, groups: new Set<string>(), thumbKeys: [] }
    entry.count++
    entry.groups.add(r.groupId)
    if (entry.thumbKeys.length < 4) entry.thumbKeys.push(r.thumbKey)
    byLabel.set(key, entry)
  }
  const link = usePhotoLinks(event)
  const out = await Promise.all([...byLabel.values()].map(async e => ({
    label: e.label,
    count: e.count,
    groups: [...e.groups].sort(),
    thumbs: await Promise.all(e.thumbKeys.map(link)),
  })))
  return out.sort((a, b) => a.label.localeCompare(b.label))
})
