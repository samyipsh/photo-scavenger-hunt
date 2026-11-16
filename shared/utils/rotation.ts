// Round timing for the event's timetable (data/event.ts), in the event's time zone (TIME_ZONE and
// UTC_OFFSET there). The .ts in the import lets Node scripts load shared/utils/demo.ts, which
// uses this file.
import { EVENT_DATE, PLANNED_FIRST_ROUND, ROUND_COUNT, ROUND_MINUTES, SLOT_COUNT, TIME_ZONE, UTC_OFFSET } from '../../data/event.ts'

export { EVENT_DATE, PLANNED_FIRST_ROUND, ROUND_COUNT, ROUND_MINUTES, SLOT_COUNT, TIME_ZONE, UTC_OFFSET }

const MINUTE = 60_000

// A time of day at the event as a timestamp: eventTime('2026-11-14', '09:45').
export function eventTime(date: string, hhmm: string): number {
  return Date.parse(`${date}T${hhmm}:00${UTC_OFFSET}`)
}

// How far the event's clock is ahead of UTC: 8 hours for '+08:00'.
export const UTC_OFFSET_MS = -eventTime('1970-01-01', '00:00')

export const PLANNED_START = eventTime(EVENT_DATE, PLANNED_FIRST_ROUND)

export function roundStartsAt(index: number, start = PLANNED_START): number {
  return start + index * ROUND_MINUTES * MINUTE
}

export function roundEndsAt(index: number, start = PLANNED_START): number {
  return roundStartsAt(index, start) + ROUND_MINUTES * MINUTE
}

export type Phase =
  | { kind: 'before', startsAt: number }
  | { kind: 'round', index: number, startsAt: number, endsAt: number }
  | { kind: 'after', endedAt: number }

export function phaseAt(now: number, start = PLANNED_START): Phase {
  if (now < start) return { kind: 'before', startsAt: start }
  const index = Math.floor((now - start) / (ROUND_MINUTES * MINUTE))
  if (index < ROUND_COUNT) return { kind: 'round', index, startsAt: roundStartsAt(index, start), endsAt: roundEndsAt(index, start) }
  return { kind: 'after', endedAt: roundEndsAt(ROUND_COUNT - 1, start) }
}

// Slot a group is in during a round. Slots and rounds are 1-based and 0-based respectively,
// matching the Participant guide: group 1 starts at slot 1, group 2 at slot 2, and so on.
export function slotFor(startSlot: number, roundIndex: number): number {
  return ((startSlot - 1 + roundIndex) % SLOT_COUNT) + 1
}

// How many rounds have finished: 0 before the first ends, ROUND_COUNT once the last has.
export function roundsEndedAt(now: number, start = PLANNED_START): number {
  const p = phaseAt(now, start)
  return p.kind === 'before' ? 0 : p.kind === 'round' ? p.index : ROUND_COUNT
}

// The group playing at a station's slot right now, or null between and outside the rounds.
export function playingAt<G extends { startSlot: number }>(slot: number, groups: readonly G[], now: number, start = PLANNED_START): G | null {
  const p = phaseAt(now, start)
  if (p.kind !== 'round') return null
  return groups.find(g => slotFor(g.startSlot, p.index) === slot) ?? null
}

// A station score as saved: a number, "missed", or neither (cleared, or never typed).
export interface SavedScore { groupId: string, raw: number | null, missed: boolean }

// Every group whose round at this station has ended with no score saved, oldest first: the
// scores the station IC still owes. Rounds run back to back, so the moment a round ends the group
// playing there is already the next one. The scores page flags its overdue cells by this rule too.
export function dueGroups<G extends { id: string, startSlot: number }>(input: {
  slot: number
  groups: readonly G[]
  scores: readonly SavedScore[]
  now: number
  firstRoundAt?: number
}): G[] {
  const saved = new Set(input.scores.filter(s => s.missed || s.raw !== null).map(s => s.groupId))
  const due: G[] = []
  for (let r = 0; r < roundsEndedAt(input.now, input.firstRoundAt); r++) {
    const g = input.groups.find(g => slotFor(g.startSlot, r) === input.slot)
    if (g && !saved.has(g.id)) due.push(g)
  }
  return due
}

export function isLastRoundOver(now: number, start = PLANNED_START): boolean {
  return now >= roundEndsAt(ROUND_COUNT - 1, start)
}

export function formatClock(ms: number): string {
  return new Intl.DateTimeFormat('en-SG', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: TIME_ZONE,
  }).format(ms).replace(' ', '\u00A0').toLowerCase()
}
