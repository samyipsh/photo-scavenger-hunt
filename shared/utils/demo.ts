// Demo mode's pure rules (docs/architecture.md, "Demo mode"): the day the demo resets on, how
// many visitors' photos it holds, and the snapshot of its seeded state. server/utils/demo.ts
// applies them; scripts/demo-snapshot.ts takes the snapshot.
import { UTC_OFFSET_MS } from './rotation.ts'

// Settings rows of demo mode's own: the snapshot, and the day of the last reset.
export const DEMO_SEED_KEY = 'demo_seed'
export const DEMO_DAY_KEY = 'demo_reset_day'

// Visitors' photos the demo holds at once, from every phone together. Photos deleted for good
// don't count: their files are gone.
export const DEMO_PHOTO_LIMIT = 50

export function demoFull(visitorPhotos: number): boolean {
  return visitorPhotos >= DEMO_PHOTO_LIMIT
}

// The day at the event (UTC_OFFSET in data/event.ts), "2026-11-16". The demo resets on the
// first request of each new one.
export function demoDay(now: number): string {
  return new Date(now + UTC_OFFSET_MS).toISOString().slice(0, 10)
}

// The seeded state the demo goes back to every night. Every photo in it is a showcase photo,
// which everyone sees and nobody can delete for good.
export interface DemoSeed {
  takenAt: number
  photos: { id: string, verdict: string, rejectReason: string | null, checkedAt: number | null, challengeId: string | null, label: string | null, removed: boolean, removedAt: number | null }[]
  likes: { photoId: string, deviceId: string, likedAt: number }[]
  scores: { groupId: string, stationId: string, raw: number | null, missed: boolean, updatedAt: number }[]
  // Each value as stored: JSON text.
  settings: { key: string, value: string, updatedAt: number }[]
  groups: { id: string, name: string, leader: string | null }[]
}

// Rows as the database gives them, booleans as 0 or 1.
type Rows<T> = (Omit<T, 'removed' | 'missed'> & { removed?: unknown, missed?: unknown })[]
export interface DemoSeedRows {
  photos: Rows<DemoSeed['photos'][number]>
  likes: DemoSeed['likes']
  scores: Rows<DemoSeed['scores'][number]>
  settings: DemoSeed['settings']
  groups: DemoSeed['groups']
}

// The snapshot of a database's rows. Demo mode's own rows and the scoreboard cache are left out:
// the reset keeps the first and clears the second.
export function demoSeed(rows: DemoSeedRows, takenAt: number): DemoSeed {
  return {
    takenAt,
    photos: rows.photos.map(p => ({ id: p.id, verdict: p.verdict, rejectReason: p.rejectReason, checkedAt: p.checkedAt, challengeId: p.challengeId, label: p.label, removed: !!p.removed, removedAt: p.removedAt })),
    likes: rows.likes.map(l => ({ photoId: l.photoId, deviceId: l.deviceId, likedAt: l.likedAt })),
    scores: rows.scores.map(s => ({ groupId: s.groupId, stationId: s.stationId, raw: s.raw, missed: !!s.missed, updatedAt: s.updatedAt })),
    settings: rows.settings.filter(s => s.key !== DEMO_SEED_KEY && s.key !== DEMO_DAY_KEY && s.key !== 'scoreboard_cache')
      .map(s => ({ key: s.key, value: s.value, updatedAt: s.updatedAt })),
    groups: rows.groups.map(g => ({ id: g.id, name: g.name, leader: g.leader })),
  }
}

export function isDemoSeed(value: unknown): value is DemoSeed {
  const v = value as Partial<Record<keyof DemoSeed, unknown>> | null
  return !!v && typeof v === 'object' && (['photos', 'likes', 'scores', 'settings', 'groups'] as const).every(k => Array.isArray(v[k]))
}
