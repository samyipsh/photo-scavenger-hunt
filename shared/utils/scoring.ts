// Scoring rules from docs/app-plan.md, "Scoring rules". Pure functions, so they can be tested
// without a database and used by both the scoreboard and the committee pages.

export interface GroupRef { id: string, number: number, name: string }
export interface StationRef { id: string, name: string, scored: boolean, lowerWins: boolean }
export interface ScoreEntry { groupId: string, stationId: string, raw: number | null, missed: boolean }
export interface ChallengeRef { id: string, type: string, points: number, awardKind: 'animal' | 'colour' | null, animal?: string | null }
export interface PhotoRef {
  groupId: string
  challengeId: string | null
  label: string | null
  verdict: 'pending' | 'passed' | 'rejected'
  removed: boolean
}

// Most liked photo was a race too until the outing (removed 16 Nov 2026, docs/app-plan.md); likes
// now only sort the gallery. A board saved before then may still carry a `liked` race. Pages list
// the races by these keys, so they never show it.
export type AwardKey = 'animals' | 'colours' | 'photos'

export interface GroupStanding {
  id: string
  number: number
  name: string
  place: number
  total: number
  stationPoints: Record<string, number | null>
  // 1 for first; tied groups share the higher place.
  stationPlaces: Record<string, number | null>
  missed: string[]
  // The photo quest's real points from challenges, added to the total as they are.
  photoPoints: number
  // Those plus the award races it leads: the photo points everyone sees.
  photoTotal: number
  // Challenges with at least one photo that counts.
  challengesFound: number
  awardBonus: number
  animals: string[]
  colours: string[]
  photoCount: number
}

export interface Scoreboard {
  provisional: boolean
  // Bonus points for leading each award race.
  awardBonus: Record<AwardKey, number>
  stations: { id: string, name: string }[]
  groups: GroupStanding[]
  awardLeaders: Record<AwardKey, string[]>
}

// With n groups, the best value gets n points and the worst gets 1. Tied groups share the
// points of the places they take up, so two groups tied first of five get 4.5 each.
export function rankPoints(
  entries: { groupId: string, value: number }[],
  n: number,
  lowerWins = false,
): Map<string, number> {
  const sorted = [...entries].sort((a, b) => lowerWins ? a.value - b.value : b.value - a.value)
  const points = new Map<string, number>()
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1]!.value === sorted[i]!.value) j++
    // Places i+1 .. j+1 (1-based) are worth n-i .. n-j points; ties get the average.
    const shared = n - (i + j) / 2
    for (let k = i; k <= j; k++) points.set(sorted[k]!.groupId, shared)
    i = j + 1
  }
  return points
}

// What each place at a station is worth with n groups, for the chart on the participant guide
// page (StationPoints.vue): 1st of five gets 5 × rankScale, down to 1 × rankScale for 5th.
// `share` is the place's points over first's, for drawing it to scale. `tiedFirst` is what each
// of two groups tied for first gets.
export function placePoints(n: number, rankScale: number) {
  const places = Array.from({ length: n }, (_, i) => ({ place: ordinal(i + 1), points: (n - i) * rankScale, share: (n - i) / n }))
  const tie = rankPoints([{ groupId: 'a', value: 1 }, { groupId: 'b', value: 1 }], n).get('a')!
  return { places, tiedFirst: tie * rankScale }
}

// 1st, 2nd, 3rd, 4th, … 11th, 12th, 13th, … 21st.
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13
  const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${suffix}`
}

// Place for each entry: 1 for the best, and tied entries share the higher place.
export function rankPlaces(entries: { groupId: string, value: number }[], lowerWins = false): Map<string, number> {
  const sorted = [...entries].sort((a, b) => lowerWins ? a.value - b.value : b.value - a.value)
  const places = new Map<string, number>()
  sorted.forEach((e, i) => {
    const prev = sorted[i - 1]
    places.set(e.groupId, prev && prev.value === e.value ? places.get(prev.groupId)! : i + 1)
  })
  return places
}

export function normaliseLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function computeScoreboard(input: {
  groups: GroupRef[]
  stations: StationRef[]
  scores: ScoreEntry[]
  challenges: ChallengeRef[]
  photos: PhotoRef[]
  provisional: boolean
  awardBonus?: Partial<Record<AwardKey, number>>
  // Station rank points are multiplied by this: with 60, first of five gets 300. It sets how much
  // the stations weigh against the photo quest's real points.
  rankScale?: number
}): Scoreboard {
  const { groups, stations, scores, challenges, photos, provisional, awardBonus = {}, rankScale = 1 } = input
  const n = groups.length
  const scored = stations.filter(s => s.scored)
  const challengeById = new Map(challenges.map(c => [c.id, c]))

  const stationPoints = new Map<string, Record<string, number | null>>()
  const stationPlaces = new Map<string, Record<string, number | null>>()
  const missedBy = new Map<string, string[]>()
  for (const g of groups) {
    stationPoints.set(g.id, Object.fromEntries(scored.map(s => [s.id, null])))
    stationPlaces.set(g.id, Object.fromEntries(scored.map(s => [s.id, null])))
    missedBy.set(g.id, [])
  }

  for (const station of scored) {
    // Only the groups on the board: a hidden group's old score mustn't take a place.
    const here = scores.filter(e => e.stationId === station.id && stationPoints.has(e.groupId))
    const played = here
      .filter(e => !e.missed && e.raw !== null && Number.isFinite(e.raw))
      .map(e => ({ groupId: e.groupId, value: e.raw as number }))
    for (const [groupId, pts] of rankPoints(played, n, station.lowerWins)) {
      const row = stationPoints.get(groupId)
      if (row) row[station.id] = pts * rankScale
    }
    for (const [groupId, place] of rankPlaces(played, station.lowerWins)) {
      const row = stationPlaces.get(groupId)
      if (row) row[station.id] = place
    }
    for (const e of here) {
      if (e.missed) missedBy.get(e.groupId)?.push(station.id)
    }
  }

  // A missed station gets the group's own average from the stations it did play,
  // or the middle of the scale if it played none.
  for (const g of groups) {
    const row = stationPoints.get(g.id)!
    const missed = missedBy.get(g.id)!
    if (missed.length === 0) continue
    const playedPts = scored
      .filter(s => !missed.includes(s.id) && row[s.id] !== null)
      .map(s => row[s.id] as number)
    const fill = playedPts.length > 0
      ? playedPts.reduce((a, b) => a + b, 0) / playedPts.length
      : ((n + 1) / 2) * rankScale
    for (const sid of missed) row[sid] = fill
  }

  // Photo quest, animals and flower colours, one group at a time (groupPhotoTotals).
  const totals = new Map(groups.map(g => [g.id, groupPhotoTotals(photos.filter(p => p.groupId === g.id), challengeById)]))
  const photoPoints = new Map(groups.map(g => [g.id, totals.get(g.id)!.points]))
  const animals = new Map(groups.map(g => [g.id, totals.get(g.id)!.animals]))
  const colours = new Map(groups.map(g => [g.id, totals.get(g.id)!.colours]))
  const photoCount = new Map(groups.map(g => [g.id, totals.get(g.id)!.photoCount]))

  const leaders = (value: (id: string) => number): string[] => {
    const best = Math.max(...groups.map(g => value(g.id)))
    return best > 0 ? groups.filter(g => value(g.id) === best).map(g => g.id) : []
  }
  const awardLeaders: Record<AwardKey, string[]> = {
    animals: leaders(id => animals.get(id)!.size),
    colours: leaders(id => colours.get(id)!.size),
    photos: leaders(id => photoCount.get(id)!),
  }

  const standings: GroupStanding[] = groups.map((g) => {
    const row = stationPoints.get(g.id)!
    const bonus = (Object.keys(awardLeaders) as AwardKey[])
      .reduce((sum, key) => sum + (awardLeaders[key].includes(g.id) ? awardBonus[key] ?? 0 : 0), 0)
    const stationTotal = Object.values(row).reduce<number>((sum, v) => sum + (v ?? 0), 0)
    return {
      id: g.id,
      number: g.number,
      name: g.name,
      place: 0,
      // Stations go by rank; the photo quest adds its real points, so every photo shows in the total.
      total: round2(stationTotal + photoPoints.get(g.id)! + bonus),
      stationPoints: row,
      stationPlaces: stationPlaces.get(g.id)!,
      missed: missedBy.get(g.id)!,
      photoPoints: photoPoints.get(g.id)!,
      photoTotal: photoPoints.get(g.id)! + bonus,
      challengesFound: totals.get(g.id)!.found,
      awardBonus: bonus,
      animals: [...animals.get(g.id)!].sort(),
      colours: [...colours.get(g.id)!].sort(),
      photoCount: photoCount.get(g.id)!,
    }
  })

  // Highest total wins. A tie goes to more photo points; if that's tied too, they share the place.
  standings.sort((a, b) => b.total - a.total || b.photoTotal - a.photoTotal || a.number - b.number)
  standings.forEach((s, i) => {
    const prev = standings[i - 1]
    s.place = prev && prev.total === s.total && prev.photoTotal === s.photoTotal ? prev.place : i + 1
  })

  return {
    provisional,
    awardBonus: { animals: awardBonus.animals ?? 0, colours: awardBonus.colours ?? 0, photos: awardBonus.photos ?? 0 },
    stations: scored.map(s => ({ id: s.id, name: s.name })),
    groups: standings,
    awardLeaders,
  }
}

function round2(x: number): number {
  return Math.round(x * 100) / 100
}

export interface GroupPhotoTotals {
  points: number
  // Challenges with at least one photo that counts.
  found: number
  animals: Set<string>
  colours: Set<string>
  photoCount: number
}

// The animal a photo adds to Most animals spotted: the name given to a photo sent for the race,
// or a Spot it challenge's animal (a swan sent for Swan). Null for anything else, and for a
// rejected or removed photo. The group page lists the race's photos by it, so they match its count.
export function animalFor(p: Pick<PhotoRef, 'label' | 'verdict' | 'removed'>, ch: Pick<ChallengeRef, 'type' | 'awardKind' | 'animal'> | undefined): string | null {
  if (!ch || p.verdict === 'rejected' || p.removed) return null
  if (ch.type === 'award') return ch.awardKind === 'animal' && p.label ? normaliseLabel(p.label) : null
  return ch.animal ? normaliseLabel(ch.animal) : null
}

// One group's photo totals, used by the scoreboard and the group page alike so they can't
// disagree. Each challenge scores once, however many photos pass; a photo counts unless it's
// rejected or removed. Award entries add to the animal and colour races, not to points, and an
// animal Spot it photo adds its animal too. Most photos counts every upload the judge hasn't
// removed, rejected ones included. Likes don't count towards anything.
export function groupPhotoTotals(photos: PhotoRef[], challengeById: Map<string, ChallengeRef>): GroupPhotoTotals {
  const kept = photos.filter(p => !p.removed)
  const done = new Set<string>()
  const animals = new Set<string>()
  const colours = new Set<string>()
  let points = 0
  for (const p of kept) {
    if (p.verdict === 'rejected' || !p.challengeId) continue
    const ch = challengeById.get(p.challengeId)
    if (!ch) continue
    const animal = animalFor(p, ch)
    if (animal) animals.add(animal)
    if (ch.type === 'award') {
      if (p.label && ch.awardKind === 'colour') colours.add(normaliseLabel(p.label))
      continue
    }
    if (!done.has(ch.id)) {
      done.add(ch.id)
      points += ch.points
    }
  }
  return { points, found: done.size, animals, colours, photoCount: kept.length }
}
