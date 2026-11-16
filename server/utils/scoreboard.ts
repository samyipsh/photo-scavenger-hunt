import type { H3Event } from 'h3'
import { AWARD_BONUS, RANK_SCALE } from '~~/data/event'
import { asc, eq, sql, type SQL } from 'drizzle-orm'
import { isLastRoundOver, PLANNED_START } from '#shared/utils/rotation'
import { computeScoreboard, type Scoreboard } from '#shared/utils/scoring'
import { challenges, groups, photos, settings, stationScores, stations } from '../db/schema'

export interface ScoreboardPayload extends Scoreboard {
  builtAt: number
  frozenAt: number | null
}

// On live, each trip to D1 costs about a tenth of a second, so the board's reads, round start
// included, go as one batch: one trip, read at one moment. Only the columns the rules use.
// `visible` limits the photos counted, in demo mode (demoPhotos in server/utils/demo.ts).
export async function buildScoreboard(db: Db, now = Date.now(), visible?: SQL): Promise<ScoreboardPayload> {
  const [groupRows, stationRows, scoreRows, challengeRows, photoRows, roundRows] = await db.batch([
      db.select({ id: groups.id, number: groups.number, name: groups.name }).from(groups).where(eq(groups.hidden, false)).orderBy(asc(groups.number)),
      db.select({ id: stations.id, name: stations.name, scored: stations.scored, lowerWins: stations.lowerWins }).from(stations).orderBy(asc(stations.slot)),
      db.select({ groupId: stationScores.groupId, stationId: stationScores.stationId, raw: stationScores.raw, missed: stationScores.missed }).from(stationScores),
      db.select({ id: challenges.id, type: challenges.type, points: challenges.points, awardKind: challenges.awardKind, animal: challenges.animal }).from(challenges),
      // Every photo, in one plain scan: filtering out removed ones here would read each row twice
      // (index, then table), and the rules skip them anyway. In demo mode, the visible ones.
      db.select({
        groupId: photos.groupId,
        challengeId: photos.challengeId,
        label: photos.label,
        verdict: photos.verdict,
        removed: photos.removed,
      }).from(photos).where(visible),
    db.select({ value: settings.value }).from(settings).where(eq(settings.key, 'first_round_at')),
  ])
  const firstRoundAt = roundRows[0] ? JSON.parse(roundRows[0].value) as number : PLANNED_START

  const scoredIds = new Set(stationRows.filter(s => s.scored).map(s => s.id))
  const everyScoreIn = groupRows.every(g => [...scoredIds].every(sid =>
    scoreRows.some(r => r.groupId === g.id && r.stationId === sid && (r.missed || r.raw !== null))))

  const board = computeScoreboard({
    groups: groupRows,
    stations: stationRows,
    scores: scoreRows,
    challenges: challengeRows,
    photos: photoRows,
    provisional: !(isLastRoundOver(now, firstRoundAt) && everyScoreIn),
    awardBonus: AWARD_BONUS,
    rankScale: RANK_SCALE,
  })
  return { ...board, builtAt: now, frozenAt: null }
}

// The public board is kept in one row and rebuilt once it's 10 seconds old, so 50 phones
// refreshing cost 50 single-row reads instead of 50 full calculations. A cached answer is one trip
// to D1 (the paused and cached rows together) and a rebuild is two. The new copy is saved after
// the answer has gone, because a write is D1's slowest step and nobody needs to wait for it.
// Requests arriving together may each rebuild it; the save never replaces a newer board with an
// older one (saveScoreboardCache). The Server-Timing header says which it was (frozen, cached or
// rebuilt) and how long the server took.
export async function publicScoreboard(event: H3Event): Promise<ScoreboardPayload> {
  const db = useDb(event)
  const started = performance.now()
  const timing = (kind: string) => setHeader(event, 'server-timing', `${kind};dur=${Math.round(performance.now() - started)}`)

  const rows = await getSettingRows(db, ['scoreboard_frozen', 'scoreboard_cache'])
  const frozen = rows.get('scoreboard_frozen')
  if (frozen) {
    timing('frozen')
    return JSON.parse(frozen.value) as ScoreboardPayload
  }
  const cached = rows.get('scoreboard_cache')
  if (cached && Date.now() - cached.updatedAt < SCOREBOARD_MAX_AGE_MS) {
    timing('cached')
    return JSON.parse(cached.value) as ScoreboardPayload
  }
  // In demo mode, the showcase photos only: the board is the same for everyone.
  const fresh = await buildScoreboard(db, Date.now(), demoPhotos(event, 'everyone'))
  event.waitUntil(saveScoreboardCache(db, fresh).catch((error) => {
    console.error('Saving the scoreboard cache failed', error)
  }))
  timing('rebuilt')
  return fresh
}

// The cached board, stamped with when it was read (builtAt), not when the save landed, so its age
// is honest. Two rebuilds that overlap can finish saving in either order; the older one never
// replaces the newer. (A save still under way when the committee resumes the board can bring
// back a copy up to 10 seconds old, which the next rebuild replaces.)
export async function saveScoreboardCache(db: Db, board: ScoreboardPayload) {
  const value = JSON.stringify(board)
  await db.insert(settings)
    .values({ key: 'scoreboard_cache', value, updatedAt: board.builtAt })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value, updatedAt: board.builtAt },
      setWhere: sql`excluded.updated_at > ${settings.updatedAt}`,
    })
}
