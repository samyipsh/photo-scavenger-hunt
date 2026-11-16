import { and, eq } from 'drizzle-orm'
import { challenges } from '../db/schema'
import { FLOWER_COLOURS } from '#shared/utils/awards'

export interface PhotoTarget {
  challengeId: string | null
  label: string | null
}

// Where a photo goes: a challenge (or none: just a photo) and, for the award races, the animal's
// name or the flower colour. The one check for every way a photo gets a challenge: uploading,
// the sender moving it, "use it for a challenge", and the committee moving it. The committee may
// also pick a challenge that's since been taken off the list.
export async function resolvePhotoTarget(db: Db, challengeId: unknown, label: unknown, options: { allowRetired?: boolean } = {}): Promise<PhotoTarget> {
  if (typeof challengeId !== 'string' || !challengeId) return { challengeId: null, label: null }
  const where = options.allowRetired ? eq(challenges.id, challengeId) : and(eq(challenges.id, challengeId), eq(challenges.active, true))
  const challenge = await db.select().from(challenges).where(where).get()
  if (!challenge) throw createError({ statusCode: 400, statusMessage: 'That challenge is no longer on the list' })
  if (!challenge.awardKind) return { challengeId, label: null }
  const name = cleanName(label)
  if (challenge.awardKind === 'colour' && !FLOWER_COLOURS.includes(name as never)) {
    throw createError({ statusCode: 400, statusMessage: 'Pick a flower colour' })
  }
  if (challenge.awardKind === 'animal' && !name) throw createError({ statusCode: 400, statusMessage: 'Name the animal' })
  return { challengeId, label: name }
}
