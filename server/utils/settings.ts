import { eq, inArray } from 'drizzle-orm'
import { settings } from '../db/schema'
import { PLANNED_START } from '#shared/utils/rotation'
import { isPhotoTimeStyle, type PhotoTimeStyle } from '#shared/utils/photoTime'
import { PHOTO_TIMES } from '~~/data/event'
import { TYPES } from '~~/data/guide'
import type { ScoreboardPayload } from './scoreboard'

// Every setting the app keeps, with the shape of its value. One row each in the settings table,
// stored as JSON. Adding a setting means adding it here first.
export interface SettingValues {
  // Whether groups can send photos. The committee closes it at the end.
  uploads_open: boolean
  // When round 1 starts (ms); every later round follows.
  first_round_at: number
  // The scoreboard, rebuilt at most every few seconds, and the copy shown while paused.
  scoreboard_cache: ScoreboardPayload
  scoreboard_frozen: ScoreboardPayload & { frozenAt: number }
  // Briefing checklist ticks: item id to when it was ticked.
  briefing_checklist: Record<string, number>
  // How photo times read: the time alone, with the weekday, or with the date.
  photo_times: PhotoTimeStyle
  // Whether everyone can read the Types of Christ answers. The committee shows them at the results.
  types_shown: boolean
}
export type SettingKey = keyof SettingValues

export async function getSetting<K extends SettingKey>(db: Db, key: K, fallback: SettingValues[K]): Promise<SettingValues[K]>
export async function getSetting<K extends SettingKey>(db: Db, key: K, fallback: null): Promise<SettingValues[K] | null>
export async function getSetting(db: Db, key: SettingKey, fallback: unknown) {
  const row = await db.select().from(settings).where(eq(settings.key, key)).get()
  return row ? JSON.parse(row.value) : fallback
}

// Several settings' rows in one trip to the database, by key. Missing ones are left out.
export async function getSettingRows(db: Db, keys: SettingKey[]) {
  const rows = await db.select().from(settings).where(inArray(settings.key, keys)).all()
  return new Map(rows.map(r => [r.key as SettingKey, r]))
}

// Refuses changes to photos while the committee has closed uploads.
export async function assertUploadsOpen(db: Db) {
  if (!(await getSetting(db, 'uploads_open', true))) {
    throw createError({ statusCode: 423, statusMessage: 'Uploads are closed', data: { code: 'uploads-closed' } })
  }
}

export async function setSetting<K extends SettingKey>(db: Db, key: K, value: SettingValues[K]) {
  const now = Date.now()
  await db.insert(settings)
    .values({ key, value: JSON.stringify(value), updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value: JSON.stringify(value), updatedAt: now } })
}

// How photo times read, for every list that shows them. A value this version doesn't know
// (saved by a later one) reads as the event's default.
export async function getPhotoTimes(db: Db): Promise<PhotoTimeStyle> {
  const style: unknown = await getSetting(db, 'photo_times', PHOTO_TIMES)
  return isPhotoTimeStyle(style) ? style : PHOTO_TIMES
}

// Whether the Types of Christ answers are out (Manage › Controls); until then /api/types refuses.
export function getTypesShown(db: Db) {
  return getSetting(db, 'types_shown', TYPES.shownAtStart)
}

// When round 1 starts. The committee lead can move it on the day; every round follows.
export function getFirstRoundAt(db: Db) {
  return getSetting(db, 'first_round_at', PLANNED_START)
}

export async function deleteSetting(db: Db, key: SettingKey) {
  await db.delete(settings).where(eq(settings.key, key))
}
