import { describe, expect, it } from 'vitest'
import { animalFor, computeScoreboard, groupPhotoTotals, ordinal, placePoints, rankPoints, type ChallengeRef, type GroupRef, type PhotoRef, type ScoreEntry, type StationRef } from '../shared/utils/scoring'
import { phaseAt, roundStartsAt, slotFor } from '../shared/utils/rotation'

const groups = (n: number): GroupRef[] =>
  Array.from({ length: n }, (_, i) => ({ id: `g${i + 1}`, number: i + 1, name: `Group ${i + 1}` }))

const stations: StationRef[] = [
  { id: 'codenames', name: 'Codenames', scored: true, lowerWins: false },
  { id: 'mind', name: 'The Mind', scored: true, lowerWins: false },
  { id: 'walk', name: 'Photo walk', scored: false, lowerWins: false },
]

const challenges: ChallengeRef[] = [
  { id: 'swan', type: 'spot', points: 5, awardKind: null, animal: 'swan' },
  { id: 'jump', type: 'drama', points: 10, awardKind: null },
  { id: 'animals', type: 'award', points: 0, awardKind: 'animal' },
  { id: 'colours', type: 'award', points: 0, awardKind: 'colour' },
]

const photo = (groupId: string, challengeId: string | null, extra: Partial<PhotoRef> = {}): PhotoRef =>
  ({ groupId, challengeId, label: null, verdict: 'pending', removed: false, ...extra })

const score = (groupId: string, stationId: string, raw: number | null, missed = false): ScoreEntry =>
  ({ groupId, stationId, raw, missed })

function board(n: number, scores: ScoreEntry[], photos: PhotoRef[] = []) {
  return computeScoreboard({ groups: groups(n), stations, scores, challenges, photos, provisional: false })
}

describe('rankPoints', () => {
  it('gives n points to the best and 1 to the worst', () => {
    const pts = rankPoints([{ groupId: 'a', value: 3 }, { groupId: 'b', value: 9 }, { groupId: 'c', value: 5 }], 3)
    expect(Object.fromEntries(pts)).toEqual({ b: 3, c: 2, a: 1 })
  })

  it('shares the points of tied places', () => {
    const pts = rankPoints(
      [{ groupId: 'a', value: 7 }, { groupId: 'b', value: 7 }, { groupId: 'c', value: 2 }, { groupId: 'd', value: 1 }, { groupId: 'e', value: 0 }],
      5,
    )
    expect(pts.get('a')).toBe(4.5)
    expect(pts.get('b')).toBe(4.5)
    expect(pts.get('c')).toBe(3)
    expect(pts.get('e')).toBe(1)
  })

  it('ranks upwards from the bottom when lower wins', () => {
    const pts = rankPoints([{ groupId: 'a', value: 30 }, { groupId: 'b', value: 10 }], 2, true)
    expect(pts.get('b')).toBe(2)
    expect(pts.get('a')).toBe(1)
  })

  it('uses the full scale even when only some groups have played', () => {
    const pts = rankPoints([{ groupId: 'a', value: 4 }], 6)
    expect(pts.get('a')).toBe(6)
  })
})

describe('computeScoreboard', () => {
  it('treats zero as a score and blank as not played', () => {
    const b = board(3, [score('g1', 'codenames', 0), score('g2', 'codenames', 5)])
    const g1 = b.groups.find(g => g.id === 'g1')!
    const g3 = b.groups.find(g => g.id === 'g3')!
    expect(g1.stationPoints.codenames).toBe(2)
    expect(g3.stationPoints.codenames).toBeNull()
  })

  it('fills a missed station with the group\'s own average', () => {
    const b = board(3, [
      score('g1', 'codenames', 9), score('g2', 'codenames', 5), score('g3', 'codenames', 1),
      score('g1', 'mind', 0, true), score('g2', 'mind', 4), score('g3', 'mind', 8),
    ])
    const g1 = b.groups.find(g => g.id === 'g1')!
    expect(g1.missed).toEqual(['mind'])
    expect(g1.stationPoints.mind).toBe(3)
  })

  it('gives the middle of the scale to a group that missed everything', () => {
    const b = board(5, [score('g1', 'codenames', null, true), score('g1', 'mind', null, true)])
    const g1 = b.groups.find(g => g.id === 'g1')!
    expect(g1.stationPoints.codenames).toBe(3)
    expect(g1.stationPoints.mind).toBe(3)
  })

  it('works with five groups', () => {
    const b = board(5, [1, 2, 3, 4, 5].map(i => score(`g${i}`, 'codenames', i * 10)))
    expect(b.groups[0]!.id).toBe('g5')
    expect(b.groups[0]!.stationPoints.codenames).toBe(5)
    expect(b.groups[4]!.stationPoints.codenames).toBe(1)
  })

  it('ranks a station among the groups on the board only', () => {
    // g6 is a hidden group with an old score: it takes no place and no points.
    const b = board(5, [score('g6', 'codenames', 99), ...[1, 2, 3, 4, 5].map(i => score(`g${i}`, 'codenames', i * 10))])
    expect(b.groups.map(g => g.id)).not.toContain('g6')
    expect(b.groups[0]!.stationPoints.codenames).toBe(5)
    expect(b.groups[0]!.stationPlaces.codenames).toBe(1)
    expect(b.groups[4]!.stationPoints.codenames).toBe(1)
  })

  it('scores each challenge once per group', () => {
    const b = board(2, [], [photo('g1', 'swan'), photo('g1', 'swan'), photo('g1', 'swan'), photo('g1', 'swan')])
    expect(b.groups.find(g => g.id === 'g1')!.photoPoints).toBe(5)
  })

  it('drops rejected photos from points but keeps them in the photo count', () => {
    const b = board(2, [], [photo('g1', 'jump', { verdict: 'rejected' }), photo('g1', null)])
    const g1 = b.groups.find(g => g.id === 'g1')!
    expect(g1.photoPoints).toBe(0)
    expect(g1.photoCount).toBe(2)
  })

  it('leaves removed duplicates out of everything', () => {
    const b = board(2, [], [photo('g1', 'swan', { removed: true })])
    const g1 = b.groups.find(g => g.id === 'g1')!
    expect(g1.photoPoints).toBe(0)
    expect(g1.photoCount).toBe(0)
  })

  it('names the animal each photo adds to the race, if any', () => {
    const ch = new Map(challenges.map(c => [c.id, c]))
    expect(animalFor(photo('g1', 'swan'), ch.get('swan'))).toBe('swan')
    expect(animalFor(photo('g1', 'animals', { label: '  Black  Swan ' }), ch.get('animals'))).toBe('black swan')
    expect(animalFor(photo('g1', 'swan', { verdict: 'rejected' }), ch.get('swan'))).toBeNull()
    expect(animalFor(photo('g1', 'swan', { removed: true }), ch.get('swan'))).toBeNull()
    expect(animalFor(photo('g1', 'animals'), ch.get('animals'))).toBeNull()
    expect(animalFor(photo('g1', 'colours', { label: 'red' }), ch.get('colours'))).toBeNull()
    expect(animalFor(photo('g1', 'jump'), ch.get('jump'))).toBeNull()
    expect(animalFor(photo('g1', 'gone'), undefined)).toBeNull()
  })

  it('adds an animal Spot it photo to the Animals spotted race, once', () => {
    const b = board(2, [], [
      photo('g1', 'swan'),
      photo('g1', 'animals', { label: 'Swan' }),
      photo('g2', 'swan', { verdict: 'rejected' }),
    ])
    expect(b.groups.find(g => g.id === 'g1')!.animals).toEqual(['swan'])
    expect(b.groups.find(g => g.id === 'g2')!.animals).toEqual([])
  })

  it('counts distinct animals and colours, ignoring case and spacing', () => {
    const b = board(2, [], [
      photo('g1', 'animals', { label: 'Black swan' }),
      photo('g1', 'animals', { label: 'black  swan' }),
      photo('g1', 'animals', { label: 'Squirrel' }),
      photo('g1', 'colours', { label: 'red' }),
    ])
    const g1 = b.groups.find(g => g.id === 'g1')!
    expect(g1.animals).toEqual(['black swan', 'squirrel'])
    expect(g1.colours).toEqual(['red'])
    expect(g1.photoPoints).toBe(0)
    expect(b.awardLeaders.animals).toEqual(['g1'])
  })

  it('gives no prize in a race where every group is on 0', () => {
    // Three races: Most liked photo was dropped after the outing, so likes win nothing.
    const none = { animals: [], colours: [], photos: [] }
    const empty = board(3, [], [])
    expect(empty.awardLeaders).toEqual(none)
    expect(empty.groups.every(g => g.awardBonus === 0 && g.total === 0)).toBe(true)
    // Photos sent, but no animal or flower colour yet: only Most photos has a leader.
    const b = board(3, [], [photo('g1', 'jump'), photo('g2', null)])
    expect(b.awardLeaders.animals).toEqual([])
    expect(b.awardLeaders.colours).toEqual([])
    expect(b.awardLeaders.photos).toEqual(['g1', 'g2'])
  })

  it('adds the photo quest\'s real points to the total, not a rank', () => {
    const b = board(3, [], [photo('g1', 'jump'), photo('g1', 'swan'), photo('g2', 'swan'), photo('g2', 'swan')])
    expect(b.groups.find(g => g.id === 'g1')!.total).toBe(15)
    expect(b.groups.find(g => g.id === 'g2')!.total).toBe(5)
    expect(b.groups.find(g => g.id === 'g2')!.challengesFound).toBe(1)
    expect(b.groups.find(g => g.id === 'g3')!.total).toBe(0)
  })

  it('breaks a tied total on photo points, then shares the place', () => {
    const b = computeScoreboard({
      groups: groups(3),
      stations,
      scores: [score('g1', 'codenames', 9), score('g2', 'codenames', 5), score('g3', 'codenames', 5)],
      challenges,
      photos: [photo('g2', 'swan'), photo('g2', 'jump')],
      provisional: false,
      rankScale: 10,
    })
    // g1: 30 + 0 photo points = 30. g2: 15 + 15 = 30, with more photo points. g3: 15.
    expect(b.groups.map(g => [g.id, g.total, g.place])).toEqual([['g2', 30, 1], ['g1', 30, 2], ['g3', 15, 3]])

    const tied = board(2, [score('g1', 'codenames', 4), score('g2', 'codenames', 4)])
    expect(tied.groups.map(g => g.place)).toEqual([1, 1])
  })

  it('adds each award race its own bonus, in the photo points', () => {
    const photos = [photo('g1', 'animals', { label: 'swan' })]
    const without = computeScoreboard({ groups: groups(2), stations, scores: [], challenges, photos, provisional: true })
    const withBonus = computeScoreboard({ groups: groups(2), stations, scores: [], challenges, photos, provisional: true, awardBonus: { animals: 300, colours: 200, photos: 100 } })
    expect(without.groups.find(g => g.id === 'g1')!.awardBonus).toBe(0)
    // g1 leads animals (300) and most photos (100), not colours.
    const g1 = withBonus.groups.find(g => g.id === 'g1')!
    expect(g1.awardBonus).toBe(400)
    expect(g1.photoTotal).toBe(g1.photoPoints + 400)
    expect(withBonus.awardBonus).toEqual({ animals: 300, colours: 200, photos: 100 })
  })
})

describe('rotation', () => {
  it('moves each group one slot per round, wrapping after six', () => {
    expect([0, 1, 2, 3, 4, 5].map(r => slotFor(1, r))).toEqual([1, 2, 3, 4, 5, 6])
    expect([0, 1, 2, 3, 4, 5].map(r => slotFor(6, r))).toEqual([6, 1, 2, 3, 4, 5])
  })

  it('knows before, during and after the rounds', () => {
    expect(phaseAt(Date.parse('2026-11-14T09:30:00+08:00')).kind).toBe('before')
    const mid = phaseAt(Date.parse('2026-11-14T10:10:00+08:00'))
    expect(mid).toMatchObject({ kind: 'round', index: 1 })
    expect(phaseAt(roundStartsAt(5) + 20 * 60_000).kind).toBe('after')
  })

  it('moves every round when round 1 moves', () => {
    const late = Date.parse('2026-11-14T09:55:00+08:00')
    expect(phaseAt(Date.parse('2026-11-14T09:50:00+08:00'), late).kind).toBe('before')
    expect(phaseAt(Date.parse('2026-11-14T10:20:00+08:00'), late)).toMatchObject({ kind: 'round', index: 1 })
    expect(roundStartsAt(5, late)).toBe(Date.parse('2026-11-14T11:35:00+08:00'))
  })
})

describe('bigger numbers', () => {
  it('scales rank points without changing the order', () => {
    const scores = [score('g1', 'codenames', 9), score('g2', 'codenames', 5), score('g3', 'codenames', 5)]
    const big = computeScoreboard({ groups: groups(6), stations, scores, challenges, photos: [], provisional: false, rankScale: 50 })
    const g1 = big.groups.find(g => g.id === 'g1')!
    const g2 = big.groups.find(g => g.id === 'g2')!
    expect(g1.stationPoints.codenames).toBe(300)
    expect(g2.stationPoints.codenames).toBe(225)
    // Photo points are never scaled.
    expect(g1.total).toBe(300)
  })

  it('scales the middle of the scale for a group that missed everything', () => {
    const b = computeScoreboard({ groups: groups(6), stations, scores: [score('g1', 'codenames', null, true)], challenges, photos: [], provisional: true, rankScale: 50 })
    expect(b.groups.find(g => g.id === 'g1')!.stationPoints.codenames).toBe(175)
  })
})

describe('places', () => {
  it('gives tied groups the same, higher place', () => {
    const b = computeScoreboard({ groups: groups(3), stations, scores: [score('g1', 'codenames', 9), score('g2', 'codenames', 9), score('g3', 'codenames', 1)], challenges, photos: [], provisional: false })
    expect(b.groups.find(g => g.id === 'g1')!.stationPlaces.codenames).toBe(1)
    expect(b.groups.find(g => g.id === 'g2')!.stationPlaces.codenames).toBe(1)
    expect(b.groups.find(g => g.id === 'g3')!.stationPlaces.codenames).toBe(3)
  })
})

describe('groupPhotoTotals', () => {
  const challenges: ChallengeRef[] = [
    { id: 'swan', type: 'spot', points: 10, awardKind: null, animal: 'swan' },
    { id: 'hornbill', type: 'spot', points: 20, awardKind: null, animal: 'hornbill' },
    { id: 'skit', type: 'drama', points: 30, awardKind: null },
    { id: 'animals', type: 'award', points: 0, awardKind: 'animal' },
    { id: 'colours', type: 'award', points: 0, awardKind: 'colour' },
  ]
  const byId = new Map(challenges.map(c => [c.id, c]))
  const p = (challengeId: string | null, extra: Partial<PhotoRef> = {}): PhotoRef =>
    ({ groupId: 'g1', challengeId, label: null, verdict: 'pending', removed: false, ...extra })

  it('scores each challenge once, skips rejected and removed photos, and collects the races', () => {
    const t = groupPhotoTotals([
      p('swan'), p('swan'), p('hornbill', { verdict: 'rejected' }), p('skit', { removed: true }),
      p('animals', { label: 'Squirrel' }), p('animals', { label: 'squirrel ' }), p('colours', { label: 'red' }),
      p(null), p('swan', { removed: true }),
    ], byId)
    expect(t.points).toBe(10)
    expect([...t.animals].sort()).toEqual(['squirrel', 'swan'])
    expect([...t.colours]).toEqual(['red'])
    // Most photos counts everything not removed, rejected photos included.
    expect(t.photoCount).toBe(7)
  })

  it('agrees with the scoreboard for the same photos', () => {
    const groups: GroupRef[] = [{ id: 'g1', number: 1, name: 'Group 1' }, { id: 'g2', number: 2, name: 'Group 2' }]
    const photos = [p('swan'), p('hornbill'), p('animals', { label: 'otter' }), p('skit', { groupId: 'g2' })]
    const board = computeScoreboard({ groups, stations: [], scores: [], challenges, photos, provisional: true })
    const g1 = board.groups.find(g => g.id === 'g1')!
    const t = groupPhotoTotals(photos.filter(x => x.groupId === 'g1'), byId)
    expect(g1.photoPoints).toBe(t.points)
    expect(g1.animals).toEqual([...t.animals].sort())
    expect(g1.photoCount).toBe(t.photoCount)
  })
})

describe('placePoints', () => {
  it('lists each place with its points and its bar\'s share of first', () => {
    const { places, tiedFirst } = placePoints(5, 60)
    expect(places.map(p => p.place)).toEqual(['1st', '2nd', '3rd', '4th', '5th'])
    expect(places.map(p => p.points)).toEqual([300, 240, 180, 120, 60])
    expect(places.map(p => p.share)).toEqual([1, 0.8, 0.6, 0.4, 0.2])
    expect(tiedFirst).toBe(270)
  })

  it('agrees with the scoreboard\'s ranking for any number of groups', () => {
    for (const n of [2, 3, 4, 6]) {
      const { places, tiedFirst } = placePoints(n, 60)
      const ranked = rankPoints(Array.from({ length: n }, (_, i) => ({ groupId: `g${i}`, value: n - i })), n)
      expect(places.map(p => p.points)).toEqual([...ranked.values()].map(v => v * 60))
      expect(tiedFirst).toBe((places[0]!.points + places[1]!.points) / 2)
    }
  })

  it('names places in English', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '23rd', '101st'])
  })
})
