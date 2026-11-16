import { computed, reactive } from 'vue'

// Station scores typed on this phone, and saves still on their way. It lives as long as the app,
// not one page, so a save that had no signal keeps trying while the IC judges photos or checks
// the scoreboard: as soon as the phone is back online, and every 15 seconds. Each score is also
// kept in localStorage until it lands, so a reload or a closed tab doesn't lose it; only for half
// a day, so a rehearsal's leftovers are never sent on the day.
//
// Every save names the version it replaces (`base`: that score's updatedAt, or null for none).
// If someone else saved since, the server refuses and sends theirs back, and the IC picks one.

export interface SavedRow { raw: number | null, missed: boolean, updatedAt: number | null }

export interface ScoreEntry {
  stationId: string
  groupId: string
  // The newest saved version this phone knows of. Null for a score restored from the phone
  // before its station page has loaded.
  saved: SavedRow | null
  // What's in the box, and the Missed toggle.
  value: string
  missed: boolean
  base: number | null
  // Save was pressed and it hasn't landed yet.
  pending: boolean
  // A try is on its way now.
  saving: boolean
  // The last try had no signal, or the app was briefly down: it goes again by itself.
  waiting: boolean
  // The app refused it, and why. It isn't sent again until the IC presses Save.
  failed: string | null
  // Someone else saved first: `saved` is theirs until the IC picks one.
  conflict: boolean
}

const PREFIX = 'pq-score-draft:'
const KEEP_FOR = 12 * 60 * 60_000
const RETRY_EVERY = 15_000
const entries = reactive<Record<string, ScoreEntry>>({})
const keyOf = (stationId: string, groupId: string) => `${stationId}:${groupId}`

const parseScore = (value: string) => value.trim() === '' ? null : Number(value.replace(',', '.'))
const matches = (saved: SavedRow | null, value: string, missed: boolean) =>
  !!saved && missed === saved.missed && (missed || parseScore(value) === saved.raw)
// Something typed here that differs from what's saved.
const changed = (e: ScoreEntry) => !matches(e.saved, e.value, e.missed)
// Typed but not sent, sent and refused, or clashing with someone else's: the IC has to act.
const needsYou = (e: ScoreEntry) => e.conflict || !!e.failed || (!e.pending && changed(e))

type Stored = Pick<ScoreEntry, 'value' | 'missed' | 'base' | 'pending'> & { conflict?: boolean, at: number }

function readStored(key: string): Stored | null {
  try {
    const s = JSON.parse(localStorage.getItem(PREFIX + key) ?? 'null') as Stored | null
    return s && typeof s.value === 'string' && Date.now() - s.at < KEEP_FOR ? s : null
  }
  catch {
    return null
  }
}
function persist(e: ScoreEntry) {
  const key = PREFIX + keyOf(e.stationId, e.groupId)
  try {
    if (!e.pending && !e.conflict && !changed(e)) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify({ value: e.value, missed: e.missed, base: e.base, pending: e.pending, conflict: e.conflict, at: Date.now() } satisfies Stored))
  }
  catch {}
}

const fromSaved = (stationId: string, groupId: string, row: SavedRow): ScoreEntry => ({
  stationId,
  groupId,
  saved: { raw: row.raw, missed: row.missed, updatedAt: row.updatedAt },
  value: row.raw === null ? '' : String(row.raw),
  missed: row.missed,
  base: row.updatedAt,
  pending: false,
  saving: false,
  waiting: false,
  failed: null,
  conflict: false,
})

function landed(e: ScoreEntry, saved: SavedRow) {
  e.saved = saved
  Object.assign(e, { base: saved.updatedAt, pending: false, waiting: false, failed: null, conflict: false })
}

async function send(e: ScoreEntry) {
  if (e.saving) return
  const missed = e.missed
  const raw = missed ? null : parseScore(e.value)
  if (!missed && (raw === null || !Number.isFinite(raw))) {
    Object.assign(e, { pending: false, waiting: false })
    return persist(e)
  }
  Object.assign(e, { saving: true, pending: true, failed: null })
  persist(e)
  try {
    const saved = await $fetch<SavedRow>(`/api/committee/stations/${e.stationId}`, {
      method: 'POST',
      body: { groupId: e.groupId, raw, missed, expectedUpdatedAt: e.base },
      timeout: 10_000,
    })
    landed(e, saved)
  }
  catch (err) {
    const x = err as { statusCode?: number, data?: { data?: SavedRow } }
    const theirs = x.statusCode === 409 ? x.data?.data : undefined
    if (theirs && theirs.missed === missed && (missed || theirs.raw === raw)) {
      // A try that seemed to fail got through after all, or someone saved the same.
      landed(e, theirs)
    }
    else if (theirs) {
      // `base` stays put until the IC picks one.
      e.saved = theirs
      Object.assign(e, { conflict: true, pending: false, waiting: false })
    }
    else if (!x.statusCode || x.statusCode >= 500) {
      // No signal, or the app was briefly down. Unless it was edited since, it goes again.
      e.waiting = e.pending
    }
    else {
      Object.assign(e, { pending: false, waiting: false, failed: errorText(err, 'Not saved. Try again.') })
    }
  }
  finally {
    e.saving = false
    persist(e)
  }
}

function retryAll() {
  if (!navigator.onLine) return
  for (const e of Object.values(entries)) {
    if (e.pending && !e.saving && !e.conflict) send(e)
  }
}

// Picks up scores a closed tab didn't finish saving, and keeps retrying from any page. Runs once,
// when the app starts (plugins/score-queue.client.ts).
let started = false
export function startScoreQueue() {
  if (started) return
  started = true
  const stale: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const name = localStorage.key(i)
      if (!name?.startsWith(PREFIX)) continue
      const key = name.slice(PREFIX.length)
      const [stationId, groupId] = key.split(':')
      const s = readStored(key)
      if (!s || !stationId || !groupId) {
        stale.push(name)
        continue
      }
      entries[key] ??= { stationId, groupId, saved: null, value: s.value, missed: !!s.missed, base: s.base ?? null, pending: !!s.pending, saving: false, waiting: false, failed: null, conflict: !!s.conflict }
    }
    for (const name of stale) localStorage.removeItem(name)
  }
  catch {}
  window.addEventListener('online', retryAll)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') retryAll()
  })
  setInterval(() => {
    if (document.visibilityState === 'visible') retryAll()
  }, RETRY_EVERY)
  retryAll()
}

// For committee home and the top bar: scores this phone still owes, and where to go to see them.
// Ones the IC has to act on come first; the label names both kinds when there are both ("1 score
// not saved · 2 waiting"), since only the waiting ones send by themselves.
export const scoreQueueStatus = computed(() => {
  const all = Object.values(entries)
  const attention = all.filter(needsYou)
  const waiting = all.filter(e => e.pending && !e.conflict)
  const first = attention[0] ?? waiting[0]
  if (!first) return null
  const n = attention.length || waiting.length
  const scoresWord = n === 1 ? 'score' : 'scores'
  return {
    kind: attention.length ? 'not-saved' as const : 'waiting' as const,
    count: n,
    label: attention.length
      ? `${n} ${scoresWord} not saved${waiting.length ? ` · ${waiting.length} waiting` : ''}`
      : `${n} ${scoresWord} waiting`,
    stationId: first.stationId,
    groupId: first.groupId,
    to: { path: `/c/station/${first.stationId}`, query: { group: first.groupId } },
  }
})

// A station page's view: one entry per group, kept in step with what the server says.
export function useScoreQueue(stationId: () => string) {
  // What the server has now for this group. Anything typed or sending here stays on top of it:
  // a save in flight, a clash still to settle, or a score typed against an older version (Save
  // then finds the clash). Anything else follows the newer score.
  function sync(groupId: string, row: SavedRow): ScoreEntry {
    const key = keyOf(stationId(), groupId)
    const e = entries[key]
    if (!e) {
      entries[key] = fromSaved(stationId(), groupId, row)
      // The reactive copy, not the plain object just stored.
      return entries[key]!
    }
    if (e.saving) return e
    if (e.saved === null || (row.updatedAt ?? 0) > (e.saved.updatedAt ?? 0)) {
      const first = e.saved === null
      // A score restored from the phone that matches what's saved has landed: it goes.
      if (matches(row, e.value, e.missed) || (!first && !e.pending && !e.conflict && !changed(e))) {
        Object.assign(e, fromSaved(stationId(), groupId, row))
      }
      // Restored from the phone, or a clash still open: show it against the newest score.
      // (`base` stays: a score typed against an older version still finds the clash on Save.)
      else if (first || e.conflict) e.saved = { raw: row.raw, missed: row.missed, updatedAt: row.updatedAt }
      persist(e)
    }
    return e
  }
  function entry(group: { id: string } & SavedRow): ScoreEntry {
    return entries[keyOf(stationId(), group.id)] ?? sync(group.id, group)
  }
  function edit(e: ScoreEntry, change: Partial<Pick<ScoreEntry, 'value' | 'missed'>>) {
    Object.assign(e, change, { pending: false, waiting: false, failed: null })
    persist(e)
  }
  // False when the box doesn't hold a number (and Missed is off).
  function save(e: ScoreEntry): boolean {
    const raw = e.missed ? null : parseScore(e.value)
    if (!e.missed && (raw === null || !Number.isFinite(raw))) return false
    send(e)
    return true
  }
  function keepTheirs(e: ScoreEntry) {
    if (e.saved) Object.assign(e, fromSaved(e.stationId, e.groupId, e.saved))
    persist(e)
  }
  function saveMine(e: ScoreEntry) {
    Object.assign(e, { base: e.saved?.updatedAt ?? null, conflict: false })
    send(e)
  }
  return { sync, entry, edit, save, keepTheirs, saveMine, changed, needsYou }
}
