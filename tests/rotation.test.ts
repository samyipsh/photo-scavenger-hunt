import { describe, expect, it } from 'vitest'
import { dueGroups, PLANNED_START, playingAt, ROUND_COUNT, roundEndsAt, roundStartsAt, roundsEndedAt, slotFor, SLOT_COUNT, type SavedScore } from '../shared/utils/rotation'

const MINUTE = 60_000
const SLOT = 4
const groups = Array.from({ length: SLOT_COUNT }, (_, i) => ({ id: `g${i + 1}`, startSlot: i + 1 }))
// The group at SLOT in round r (0-based).
const at = (r: number) => groups.find(g => slotFor(g.startSlot, r) === SLOT)!.id
const score = (r: number, raw: number | null = 5, missed = false): SavedScore => ({ groupId: at(r), raw, missed })

const due = (now: number, scores: SavedScore[] = [], firstRoundAt?: number) =>
  dueGroups({ slot: SLOT, groups, scores, now, firstRoundAt }).map(g => g.id)

describe('dueGroups', () => {
  it('has nothing due before the first round', () => {
    expect(due(PLANNED_START - 10 * MINUTE)).toEqual([])
  })

  it('has nothing due while the first group is still playing', () => {
    expect(due(roundStartsAt(0) + 5 * MINUTE)).toEqual([])
    expect(due(roundEndsAt(0) - 1)).toEqual([])
  })

  it('points at the group that just finished, not the one that just arrived', () => {
    const justAfter = roundEndsAt(0) + MINUTE
    expect(due(roundEndsAt(0))).toEqual([at(0)])
    expect(due(justAfter)).toEqual([at(0)])
    expect(playingAt(SLOT, groups, justAfter)?.id).toBe(at(1))
  })

  it('has nothing due once that score is saved, as a number, a zero or missed', () => {
    const justAfter = roundEndsAt(0) + MINUTE
    expect(due(justAfter, [score(0, 5)])).toEqual([])
    expect(due(justAfter, [score(0, 0)])).toEqual([])
    expect(due(justAfter, [score(0, null, true)])).toEqual([])
  })

  it('still counts a cleared score as due', () => {
    expect(due(roundEndsAt(0) + MINUTE, [score(0, null)])).toEqual([at(0)])
  })

  it('ignores scores for other groups', () => {
    expect(due(roundEndsAt(0) + MINUTE, [score(1, 3), { groupId: 'g99', raw: 1, missed: false }])).toEqual([at(0)])
  })

  it('lists every missing score, oldest first', () => {
    const inRound4 = roundStartsAt(3) + 5 * MINUTE
    expect(due(inRound4)).toEqual([at(0), at(1), at(2)])
    expect(due(inRound4, [score(1)])).toEqual([at(0), at(2)])
    expect(due(inRound4, [score(0), score(2)])).toEqual([at(1)])
    expect(due(inRound4, [score(0), score(1), score(2)])).toEqual([])
  })

  it('leaves out the group playing now and the groups still to come', () => {
    const list = due(roundStartsAt(2) + 5 * MINUTE)
    expect(list).toEqual([at(0), at(1)])
    expect(list).not.toContain(at(2))
    expect(list).not.toContain(at(3))
  })

  it('lists the last group once the last round has ended', () => {
    const after = roundEndsAt(ROUND_COUNT - 1) + 10 * MINUTE
    const earlier = Array.from({ length: ROUND_COUNT - 1 }, (_, r) => score(r, r))
    expect(due(after)).toHaveLength(ROUND_COUNT)
    expect(due(after, earlier)).toEqual([at(ROUND_COUNT - 1)])
    expect(due(after, [...earlier, score(ROUND_COUNT - 1, 1)])).toEqual([])
  })

  it('follows round times the committee moved', () => {
    const later = PLANNED_START + 15 * MINUTE
    const justAfterPlanned = roundEndsAt(0) + MINUTE
    expect(due(justAfterPlanned, [], later)).toEqual([])
    expect(due(roundEndsAt(0, later), [], later)).toEqual([at(0)])
  })

  it('agrees with the scores page: a score is due once its round has ended', () => {
    // ScoreGrid's old rule, cell by cell: missing, and the group's round here has ended.
    for (let minutes = -30; minutes <= ROUND_COUNT * 20 + 30; minutes += 7) {
      const now = PLANNED_START + minutes * MINUTE
      const expected = groups.filter((g) => {
        const r = Array.from({ length: ROUND_COUNT }, (_, i) => i).find(i => slotFor(g.startSlot, i) === SLOT)
        return r !== undefined && now >= roundEndsAt(r)
      })
      expect(due(now).sort()).toEqual(expected.map(g => g.id).sort())
    }
  })

  it('returns the groups it was given, with their names', () => {
    const named = groups.map(g => ({ ...g, name: `Group ${g.id}` }))
    const [first] = dueGroups({ slot: SLOT, groups: named, scores: [], now: roundEndsAt(0) })
    expect(first?.name).toBe(`Group ${at(0)}`)
  })
})

describe('roundsEndedAt and playingAt', () => {
  it('counts finished rounds', () => {
    expect(roundsEndedAt(PLANNED_START - MINUTE)).toBe(0)
    expect(roundsEndedAt(roundStartsAt(0))).toBe(0)
    expect(roundsEndedAt(roundEndsAt(0))).toBe(1)
    expect(roundsEndedAt(roundEndsAt(ROUND_COUNT - 1))).toBe(ROUND_COUNT)
  })

  it('has no one playing outside the rounds', () => {
    expect(playingAt(SLOT, groups, PLANNED_START - MINUTE)).toBeNull()
    expect(playingAt(SLOT, groups, roundStartsAt(0))?.id).toBe(at(0))
    expect(playingAt(SLOT, groups, roundEndsAt(ROUND_COUNT - 1))).toBeNull()
  })

  it('leaves a station one free round with one group fewer than slots', () => {
    const five = groups.slice(0, SLOT_COUNT - 1)
    // With six, the last group would be at SLOT in round `free`.
    const free = Array.from({ length: ROUND_COUNT }, (_, r) => r).find(r => slotFor(SLOT_COUNT, r) === SLOT)!
    expect(playingAt(SLOT, five, roundStartsAt(free) + 5 * MINUTE)).toBeNull()
    // Every other round has its group, and once all rounds end, only real groups are due.
    for (let r = 0; r < ROUND_COUNT; r++) if (r !== free) expect(playingAt(SLOT, five, roundStartsAt(r) + 5 * MINUTE)).not.toBeNull()
    const owed = dueGroups({ slot: SLOT, groups: five, scores: [], now: roundEndsAt(ROUND_COUNT - 1) }).map(g => g.id)
    expect(owed).toHaveLength(SLOT_COUNT - 1)
    expect(owed).not.toContain(`g${SLOT_COUNT}`)
  })
})
