import { sql } from 'drizzle-orm'
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// IDs are stable text keys from the data files, so re-seeding never breaks the group links
// we've sent out or detaches photos from their challenges.

export const groups = sqliteTable('groups', {
  id: text('id').primaryKey(),
  number: integer('number').notNull().unique(),
  // "Group 1 (Adam)": the number, and the group IC's name when there is one. Built from
  // `leader` whenever the committee changes it, so every page reads one name.
  name: text('name').notNull(),
  // The group IC, a participant. Set in the app by the committee (Scores, Groups).
  leader: text('leader'),
  token: text('token').notNull().unique(),
  // Rotation slot the group starts in, 1 to 6.
  startSlot: integer('start_slot').notNull(),
  // Hidden groups, like the recce team's examples, show in the gallery but never in the
  // scoreboard, the rotation or station scoring.
  hidden: integer('hidden', { mode: 'boolean' }).notNull().default(false),
})

export const stations = sqliteTable('stations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slot: integer('slot').notNull().unique(),
  scored: integer('scored', { mode: 'boolean' }).notNull(),
  lowerWins: integer('lower_wins', { mode: 'boolean' }).notNull().default(false),
  place: text('place').notNull(),
  // No pin for a stop without a fixed spot (the photo walk): its place line says what to do.
  lat: real('lat'),
  lng: real('lng'),
})

export const challenges = sqliteTable('challenges', {
  id: text('id').primaryKey(),
  type: text('type', { enum: ['station', 'spot', 'group', 'drama', 'award'] }).notNull(),
  title: text('title').notNull(),
  flavour: text('flavour'),
  hint: text('hint'),
  points: integer('points').notNull(),
  whoInShot: text('who_in_shot'),
  awardKind: text('award_kind', { enum: ['animal', 'colour'] }),
  // For an animal Spot it challenge, the animal it adds to the group's Animals spotted race.
  animal: text('animal'),
  sort: integer('sort').notNull(),
  // Challenges dropped from the list are hidden, never deleted, so their photos keep a title.
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
})

export const photos = sqliteTable('photos', {
  // Created on the phone when the photo is picked, so retries can never make a second record.
  id: text('id').primaryKey(),
  groupId: text('group_id').notNull(),
  challengeId: text('challenge_id'),
  label: text('label'),
  thumbKey: text('thumb_key').notNull(),
  largeKey: text('large_key').notNull(),
  bytes: integer('bytes').notNull(),
  width: integer('width'),
  height: integer('height'),
  verdict: text('verdict', { enum: ['pending', 'passed', 'rejected'] }).notNull().default('pending'),
  rejectReason: text('reject_reason'),
  checkedAt: integer('checked_at'),
  removed: integer('removed', { mode: 'boolean' }).notNull().default(false),
  // When the committee last hid it (out of the gallery, files kept), so Hidden photos shows the
  // latest first. Cleared when it's unhidden; empty for photos hidden before this was kept.
  removedAt: integer('removed_at'),
  // When the photo's files were deleted for good (by the committee, as inappropriate, or by the
  // sender). Set before the files go, and never cleared: such a photo can't be restored or judged
  // again.
  filesDeletedAt: integer('files_deleted_at'),
  // SHA-256 of the original file, worked out on the phone, to catch the same photo sent twice.
  contentHash: text('content_hash'),
  // A random ID the phone keeps in its browser, so the committee can block one phone.
  deviceId: text('device_id'),
  // The name the photographer gave for photo credits, if any. Asked once per phone.
  uploaderName: text('uploader_name'),
  // How many phones have liked it, kept here so the gallery can sort by it cheaply.
  likes: integer('likes').notNull().default(0),
  uploadedAt: integer('uploaded_at').notNull(),
  lat: real('lat'),
  lng: real('lng'),
}, t => [
  index('photos_group_uploaded').on(t.groupId, t.uploadedAt),
  index('photos_checked_uploaded').on(t.checkedAt, t.uploadedAt),
  index('photos_challenge').on(t.challengeId),
  index('photos_hash').on(t.contentHash),
  // The same photo file is only ever in the gallery once. The checks in admitUpload say why;
  // this makes two phones sending it in the same second unable to both get in.
  uniqueIndex('photos_active_hash').on(t.contentHash).where(sql`${t.removed} = 0 and ${t.contentHash} is not null`),
  // The gallery: newest first, and the most liked few.
  index('photos_removed_uploaded').on(t.removed, t.uploadedAt),
  index('photos_removed_likes').on(t.removed, t.likes, t.uploadedAt),
  // A phone's own photos (/api/gallery/mine), without reading every photo.
  index('photos_device').on(t.deviceId),
])

export const stationScores = sqliteTable('station_scores', {
  groupId: text('group_id').notNull(),
  stationId: text('station_id').notNull(),
  raw: real('raw'),
  missed: integer('missed', { mode: 'boolean' }).notNull().default(false),
  // Also the version: a save must name the updatedAt it replaces.
  updatedAt: integer('updated_at').notNull(),
}, t => [primaryKey({ columns: [t.groupId, t.stationId] })])

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
})

// One row per phone that liked a photo, so a second tap unlikes it.
export const photoLikes = sqliteTable('photo_likes', {
  photoId: text('photo_id').notNull(),
  deviceId: text('device_id').notNull(),
  likedAt: integer('liked_at').notNull(),
}, t => [
  primaryKey({ columns: [t.photoId, t.deviceId] }),
  // A phone's own likes (/api/gallery/mine), without reading everyone's.
  index('photo_likes_device').on(t.deviceId),
])

// Phones the committee has stopped from uploading, after an inappropriate photo.
export const blockedDevices = sqliteTable('blocked_devices', {
  deviceId: text('device_id').primaryKey(),
  groupId: text('group_id').notNull(),
  blockedAt: integer('blocked_at').notNull(),
})

export const loginAttempts = sqliteTable('login_attempts', {
  ip: text('ip').primaryKey(),
  failures: integer('failures').notNull(),
  windowStart: integer('window_start').notNull(),
})
