import { PLANNED_START } from '#shared/utils/rotation'
import { isPhotoTimeStyle } from '#shared/utils/photoTime'

// Close uploads, move the round times, freeze or unfreeze the public scoreboard, choose how
// photo times read, and show or hide the Types of Christ answers. Freezing saves a copy of the
// board at that moment, which the public sees until it's unfrozen.
export default defineEventHandler(async (event) => {
  await requireCommittee(event)
  const db = useDb(event)
  const body = await readBody<{ uploadsOpen?: boolean, frozen?: boolean, firstRoundAt?: number, photoTimes?: string, typesShown?: boolean }>(event)
  if (body.photoTimes !== undefined && !isPhotoTimeStyle(body.photoTimes)) {
    throw createError({ statusCode: 400, statusMessage: 'Unknown photo time style' })
  }
  if (typeof body.uploadsOpen === 'boolean') await setSetting(db, 'uploads_open', body.uploadsOpen)
  if (isPhotoTimeStyle(body.photoTimes)) await setSetting(db, 'photo_times', body.photoTimes)
  if (typeof body.typesShown === 'boolean') await setSetting(db, 'types_shown', body.typesShown)
  if (body.firstRoundAt !== undefined) {
    // Whole minutes, and within a few hours of the plan, so a slip of the thumb can't lose the day.
    const at = Math.round(Number(body.firstRoundAt) / 60_000) * 60_000
    if (!Number.isFinite(at) || Math.abs(at - PLANNED_START) > 4 * 3_600_000) {
      throw createError({ statusCode: 400, statusMessage: 'That start time is too far from the plan' })
    }
    await setSetting(db, 'first_round_at', at)
    await deleteSetting(db, 'scoreboard_cache')
  }
  if (body.frozen === true) {
    const board = await buildScoreboard(db, Date.now(), demoPhotos(event, 'everyone'))
    await setSetting(db, 'scoreboard_frozen', { ...board, frozenAt: Date.now() })
  }
  if (body.frozen === false) {
    await deleteSetting(db, 'scoreboard_frozen')
    await deleteSetting(db, 'scoreboard_cache')
  }
  return { ok: true }
})
