import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ANIMALS_CHALLENGE, CHALLENGE_KINDS, challenges, COLOURS_CHALLENGE, FIRST_PHOTO_CHALLENGE } from '../data/challenges'
import { EVENT_DATE, GROUP_COUNT, GROUP_LEADERS, ROUND_COUNT, SLOT_COUNT, stations, TIME_ZONE, UTC_OFFSET } from '../data/event'
import { GUIDE } from '../data/guide'
import { TYPES_OF_CHRIST } from '../data/types-of-christ'
import { parseParagraph, passagesIn } from '../shared/utils/typesOfChrist'

// The committee edits data/ by hand before the event; these catch the edits the app can't take.
describe('data/challenges.ts', () => {
  it('has unique challenge ids', () => {
    const ids = challenges.map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('keeps the challenges the app treats specially', () => {
    const byId = new Map(challenges.map(c => [c.id, c]))
    expect(byId.get(FIRST_PHOTO_CHALLENGE)?.type).toBe('station')
    expect(byId.get(ANIMALS_CHALLENGE)).toMatchObject({ type: 'award', awardKind: 'animal' })
    expect(byId.get(COLOURS_CHALLENGE)).toMatchObject({ type: 'award', awardKind: 'colour' })
  })

  it('only uses kinds the group page has a tab for', () => {
    const kinds = new Set<string>(CHALLENGE_KINDS.map(k => k.type))
    for (const c of challenges) expect(kinds.has(c.type), c.id).toBe(true)
  })

  it('puts an animal only on Spot it challenges, and award kinds only on awards', () => {
    for (const c of challenges) {
      if (c.animal) expect(c.type, c.id).toBe('spot')
      if (c.awardKind) expect(c.type, c.id).toBe('award')
    }
  })
})

describe('data/event.ts', () => {
  it('has one station per slot, in order', () => {
    expect(stations.length).toBe(SLOT_COUNT)
    expect(stations.map(s => s.slot).sort((a, b) => a - b)).toEqual(Array.from({ length: SLOT_COUNT }, (_, i) => i + 1))
    expect(new Set(stations.map(s => s.id)).size).toBe(stations.length)
  })

  it('gives a station both coordinates or neither, and only an unscored one goes without', () => {
    for (const s of stations) {
      expect(s.lat === null, s.id).toBe(s.lng === null)
      if (s.scored) expect(s.lat, s.id).not.toBeNull()
    }
  })

  it('has a starting slot for every group, and no more rounds than slots', () => {
    expect(GROUP_COUNT).toBeLessThanOrEqual(SLOT_COUNT)
    expect(ROUND_COUNT).toBeLessThanOrEqual(SLOT_COUNT)
  })

  it('gives the UTC offset TIME_ZONE has on the event day', () => {
    const noon = Date.parse(`${EVENT_DATE}T12:00:00${UTC_OFFSET}`)
    const there = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false }).format(noon)
    expect(there).toBe('12:00')
  })

  it('names an IC only for groups that exist', () => {
    for (const n of Object.keys(GROUP_LEADERS).map(Number)) expect(n >= 1 && n <= GROUP_COUNT, `group ${n}`).toBe(true)
  })
})

describe('data/guide.ts', () => {
  it('runs the timeline in order', () => {
    for (const r of GUIDE.timeline) expect(r.time, r.what).toMatch(/^\d{1,2}:\d{2}$/)
    const minutes = GUIDE.timeline.map(r => Number(r.time.split(':')[0]) * 60 + Number(r.time.split(':')[1]))
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b))
  })
})

describe('data/types-of-christ.ts', () => {
  const t = TYPES_OF_CHRIST
  const paragraphs = [t.intro, ...t.types.flatMap(x => [...x.hint, ...x.match, ...x.type, x.refs])]

  it('gives every type a name, a hint, how it matches and how it points to Christ', () => {
    for (const x of t.types) {
      expect(x.name, 'name').not.toBe('')
      expect(x.hint.length, x.name).toBeGreaterThan(0)
      expect(x.match.length, x.name).toBeGreaterThan(0)
      expect(x.type.length, x.name).toBeGreaterThan(0)
    }
  })

  it('has the verses of every passage it refers to', () => {
    for (const p of paragraphs) {
      for (const passage of passagesIn(p)) expect(t.verses[passage]?.length, passage).toBeGreaterThan(0)
    }
  })

  it('leaves no mark half written', () => {
    for (const p of paragraphs) {
      const plain = parseParagraph(p).filter(s => s.kind === 'text').map(s => s.text).join('')
      expect(plain, p).not.toMatch(/\*\*|\]\(|\[[^\]]*\]/)
    }
  })

  // The answers must reach phones only from /api/types, once the committee shows them.
  it('is never imported by the app', () => {
    const files = (dir: string): string[] => readdirSync(dir, { withFileTypes: true })
      .flatMap(e => e.isDirectory() ? files(join(dir, e.name)) : [join(dir, e.name)])
    const root = join(import.meta.dirname, '..')
    for (const f of [...files(join(root, 'app')), ...files(join(root, 'shared'))]) {
      expect(readFileSync(f, 'utf8'), f).not.toMatch(/['"][^'"\n]*\/types-of-christ(\.ts)?['"]/)
    }
  })
})
