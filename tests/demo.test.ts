import { describe, expect, it } from 'vitest'
import { DEMO_DAY_KEY, DEMO_PHOTO_LIMIT, DEMO_SEED_KEY, demoDay, demoFull, demoSeed, isDemoSeed } from '../shared/utils/demo'
import { eventTime } from '../shared/utils/rotation'

describe('demoDay', () => {
  it('turns over at midnight in Singapore', () => {
    expect(demoDay(eventTime('2026-11-16', '00:00'))).toBe('2026-11-16')
    expect(demoDay(eventTime('2026-11-16', '00:00') - 1)).toBe('2026-11-15')
    expect(demoDay(eventTime('2026-11-16', '23:59'))).toBe('2026-11-16')
    // 4 pm UTC is already the next day there.
    expect(demoDay(Date.parse('2026-12-31T16:00:00Z'))).toBe('2027-01-01')
  })
})

describe('demoFull', () => {
  it('takes visitors\' photos up to the limit, and no more', () => {
    expect(DEMO_PHOTO_LIMIT).toBe(50)
    expect(demoFull(0)).toBe(false)
    expect(demoFull(49)).toBe(false)
    expect(demoFull(50)).toBe(true)
    expect(demoFull(51)).toBe(true)
  })
})

describe('demoSeed', () => {
  const rows = {
    photos: [{ id: 'p1', verdict: 'rejected', rejectReason: 'Blurry', checkedAt: 5, challengeId: 'swan', label: null, removed: 1, removedAt: 9, extra: 'x' }],
    likes: [{ photoId: 'p1', deviceId: 'd1', likedAt: 6 }],
    scores: [{ groupId: 'g1', stationId: 'mind', raw: 41, missed: 0, updatedAt: 7 }, { groupId: 'g5', stationId: 'riddles', raw: null, missed: 1, updatedAt: 8 }],
    settings: [
      { key: 'uploads_open', value: 'true', updatedAt: 1 },
      { key: 'scoreboard_cache', value: '{}', updatedAt: 2 },
      { key: DEMO_SEED_KEY, value: '{}', updatedAt: 3 },
      { key: DEMO_DAY_KEY, value: '"2026-11-16"', updatedAt: 4 },
    ],
    groups: [{ id: 'g1', name: 'Group 1 (Alex)', leader: 'Alex' }],
  }

  it('keeps each photo\'s judging and place, and every like, score and group name', () => {
    const seed = demoSeed(rows, 100)
    expect(seed.takenAt).toBe(100)
    expect(seed.photos).toEqual([{ id: 'p1', verdict: 'rejected', rejectReason: 'Blurry', checkedAt: 5, challengeId: 'swan', label: null, removed: true, removedAt: 9 }])
    expect(seed.likes).toEqual(rows.likes)
    expect(seed.scores.map(s => s.missed)).toEqual([false, true])
    expect(seed.groups).toEqual(rows.groups)
  })

  it('leaves out demo mode\'s own settings and the scoreboard cache', () => {
    expect(demoSeed(rows, 100).settings).toEqual([{ key: 'uploads_open', value: 'true', updatedAt: 1 }])
  })

  it('reads back as a snapshot, and nothing else does', () => {
    expect(isDemoSeed(JSON.parse(JSON.stringify(demoSeed(rows, 100))))).toBe(true)
    expect(isDemoSeed(null)).toBe(false)
    expect(isDemoSeed({ photos: [] })).toBe(false)
  })
})
