import { and, eq, isNotNull } from 'drizzle-orm'
import { challenges, photos } from '../../db/schema'
import { normaliseLabel } from '#shared/utils/scoring'

// Rename an animal everywhere it appears. Renaming to an existing name merges the two. It sends
// back which photos it changed, so a merge can be undone: the undo passes those `ids`, and only
// they go back to the old name, not the photos that had the target name already.
export default defineEventHandler(async (event) => {
  await requireCommittee(event)
  const db = useDb(event)
  const { from, to, ids: only } = await readBody<{ from: string, to: string, ids?: unknown }>(event)
  const target = cleanName(to)
  if (!from || !target) throw createError({ statusCode: 400, statusMessage: 'Give the old and new names' })
  const limit = Array.isArray(only) ? new Set(only.filter(x => typeof x === 'string')) : null
  const rows = await db.select({ id: photos.id, label: photos.label })
    .from(photos)
    .innerJoin(challenges, eq(challenges.id, photos.challengeId))
    .where(and(eq(challenges.awardKind, 'animal'), isNotNull(photos.label), demoPhotos(event)))
    .all()
  const ids = rows.filter(r => normaliseLabel(r.label!) === normaliseLabel(from) && (!limit || limit.has(r.id))).map(r => r.id)
  for (const id of ids) {
    await db.update(photos).set({ label: target }).where(eq(photos.id, id)).run()
  }
  return { renamed: ids.length, ids }
})
