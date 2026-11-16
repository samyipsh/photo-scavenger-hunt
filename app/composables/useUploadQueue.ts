import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { deviceId } from '~/utils/device'
import { PhotoDecodeError, shrinkPhoto } from '~/utils/image'
import { dropDraft, dropUpload, loadDrafts, loadUploads, saveDraft, saveUpload } from '~/utils/queueStore'
import { isFinalRefusal, isStuck, looksLikeStorageRefusal, retryDelay } from '~/utils/uploadRules'
import type { CropRect } from '~/utils/crop'
import type { Refusal } from '#shared/utils/refusals'

// Uploads one photo at a time: the app checks it and hands out signed links (start), the phone
// sends both copies straight to storage, and the app keeps them (finish). Each photo gets its ID
// on the phone, so a retry after a lost response can never create a second photo. Retries back
// off with a little randomness, and restart straight away when the signal returns or the page is
// shown again. Photos still to send are also saved on the phone (queueStore), so they carry on
// after the browser closes the tab; each try asks for fresh links, so saved links never expire.
// Race photos waiting for a name are drafts, kept on the phone too (`useDrafts`, at the end).

export type UploadState = 'preparing' | 'waiting' | 'uploading' | 'failed'

export interface UploadItem {
  id: string
  // The group's link token, so a photo still goes to the right group after the page changes.
  token: string
  challengeId: string | null
  label: string | null
  file: File
  previewUrl: string | null
  large?: Blob
  thumb?: Blob
  width?: number
  height?: number
  // SHA-256 of the original file, so the server can spot the same photo sent twice.
  hash?: string | null
  state: UploadState
  error: string | null
  // When the server said no because this group already sent the photo: which photo that was.
  refusal?: Refusal | null
  attempts: number
  // Tries in a row that got an answer and were still refused: storage or the app saying no,
  // not a lost signal. Three in a row, over at least a minute, means something's wrong that
  // waiting won't fix (one bad minute of signal can look like a refusal, so time counts too).
  troubles?: number
  troubleSince?: number
  stuck?: boolean
  // Saved on the phone, so it survives the tab closing.
  saved?: boolean
  nextTryAt: number
  addedAt: number
}

// A refused photo that's already in (this group sent it before, or another group did) needs
// nothing from anyone: its notice shows for a few seconds, then the queue lets it go. One sent
// as just a photo and now picked for a challenge stays, since it can be used for that.
export const FLEETING_MS = 6000
export function fleetingRefusal(item: UploadItem) {
  const code = item.refusal?.code
  return code === 'sent-by-another-group' || (code === 'already-sent' && !(item.challengeId && item.refusal?.challengeId === null))
}

// The app or storage answered, but not with success: worth retrying, but not a signal problem.
class ServerTrouble extends Error {}

class PermanentError extends Error {
  constructor(message: string, readonly data: Refusal | null = null) {
    super(message)
  }
}

async function hashFile(file: File): Promise<string | null> {
  try {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
  }
  catch {
    return null
  }
}

const TIMEOUT_ASK_MS = 20_000
// A file upload gives up only after this long without progress, so a slow but steady signal
// always gets there, and a dead connection is noticed quickly.
const STALL_MS = 30_000

interface UploadTarget { url: string, headers: Record<string, string> }
type StartReply = { status: 'saved' } | { status: 'send', thumb: UploadTarget, large: UploadTarget }

// A request to the app: start or finish a photo.
async function ask<T>(url: string, body: unknown): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_ASK_MS)
  try {
    const res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json', 'x-device-id': deviceId() },
      signal: controller.signal,
    })
    if (res.ok) return await res.json() as T
    const json = await res.json().catch(() => ({})) as { statusMessage?: string, data?: Refusal }
    const message = json.statusMessage
    // A file that didn't arrive means start this photo again; other client errors won't fix themselves.
    if (isFinalRefusal(res.status, json.data?.code)) throw new PermanentError(message ?? `Upload refused (${res.status})`, json.data ?? null)
    throw new ServerTrouble(message ?? `Server error ${res.status}`)
  }
  finally {
    clearTimeout(timer)
  }
}

// Sends one file straight to storage through its signed link. XMLHttpRequest, not fetch,
// because only it reports upload progress. Any refusal (an expired link, a dropped connection)
// is worth another go: the next try starts over with fresh links.
function send(target: UploadTarget, body: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let stall: ReturnType<typeof setTimeout> | undefined
    let moved = false
    let sent = false
    const watch = () => {
      clearTimeout(stall)
      stall = setTimeout(() => xhr.abort(), STALL_MS)
    }
    xhr.open('PUT', target.url)
    for (const [name, value] of Object.entries(target.headers)) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = (e) => {
      if (e.loaded > 0) moved = true
      watch()
    }
    xhr.upload.onload = () => {
      sent = true
      watch()
    }
    xhr.onload = () => {
      clearTimeout(stall)
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new ServerTrouble(`Storage said ${xhr.status}`))
    }
    xhr.onerror = () => {
      clearTimeout(stall)
      // Browsers hide a storage refusal that lacks CORS headers (a wrong CORS rule, an expired
      // token) as a failed request. A failure before the first byte or after the last one is
      // that; one partway through is the signal.
      reject(looksLikeStorageRefusal(moved, sent, navigator.onLine) ? new ServerTrouble('Storage refused the upload') : new Error('Upload interrupted'))
    }
    xhr.onabort = () => reject(new Error('Upload stalled'))
    watch()
    xhr.send(body)
  })
}

// One queue for the whole app, so photos keep sending when someone leaves the group page for
// the gallery or the scoreboard. Each photo remembers which group it's for.
const items = reactive<UploadItem[]>([])
// The last finished upload, shown briefly in the upload bar with its thumbnail, and how many
// finished since the queue was last empty, so a batch reads "20 photos uploaded". The thumbnail
// stays until the next photo finishes.
const lastDone = ref<{ id: string, at: number, count: number, previewUrl: string | null } | null>(null)
const batchDone = ref(0)
const listeners = new Set<(item: UploadItem) => void>()
let running = false
let listening = false
let wakeTimer: ReturnType<typeof setTimeout> | undefined

const pending = computed(() => items.filter(i => i.state !== 'failed'))

// For the top bar on other pages: photos still to send, whether they're stuck waiting for
// signal, how many need someone's attention, and which group's page to go back to.
export const uploadsInFlight = computed(() => ({
  count: pending.value.length,
  waiting: pending.value.length > 0 && pending.value.every(i => i.state === 'waiting'),
  failed: items.filter(i => i.state === 'failed').length,
  // Photos refused three times in a row with a signal: a problem on the organisers' side.
  stuck: pending.value.filter(i => i.stuck).length,
  token: items[0]?.token ?? null,
}))

// What's kept on the phone: the original until it's shrunk, then only the shrunk copies.
function persist(item: UploadItem) {
  const { id, token, challengeId, label, large, thumb, width, height, hash, addedAt } = item
  return saveUpload(large && thumb
    ? { id, token, challengeId, label, large, thumb, width, height, hash, addedAt }
    : { id, token, challengeId, label, file: item.file, addedAt }).then((ok) => {
    item.saved = ok
  })
}

function drop(item: UploadItem, keepPreview: boolean) {
  dropUpload(item.id)
  if (item.previewUrl && !keepPreview) URL.revokeObjectURL(item.previewUrl)
  const i = items.indexOf(item)
  if (i >= 0) items.splice(i, 1)
}
const forget = (item: UploadItem) => drop(item, false)

// Sent: the done line takes over its thumbnail.
function finished(item: UploadItem) {
  batchDone.value++
  const before = lastDone.value?.previewUrl
  lastDone.value = { id: item.id, at: Date.now(), count: batchDone.value, previewUrl: item.previewUrl }
  if (before && before !== item.previewUrl) URL.revokeObjectURL(before)
  drop(item, true)
}

function retry(item: UploadItem) {
  item.troubles = 0
  item.troubleSince = undefined
  item.stuck = false
  persist(item)
  item.state = item.large ? 'waiting' : 'preparing'
  item.error = null
  item.nextTryAt = 0
  run()
}

function retryAllNow() {
  for (const item of items) {
    if (item.state === 'waiting') item.nextTryAt = 0
  }
  run()
}

async function step(item: UploadItem) {
  if (item.hash === undefined) item.hash = await hashFile(item.file)
  if (!item.large || !item.thumb) {
    item.state = 'preparing'
    const shrunk = await shrinkPhoto(item.file)
    Object.assign(item, shrunk)
    item.previewUrl = URL.createObjectURL(shrunk.thumb)
    // Not awaited: saving to the phone must never hold up sending.
    persist(item)
  }
  item.state = 'uploading'
  const base = `/api/g/${item.token}/photos/${item.id}`
  const hash = item.hash ?? null
  // Start runs every check before any bytes go, so a duplicate or a closed upload stops here.
  const start = await ask<StartReply>(`${base}/start`, { challengeId: item.challengeId, label: item.label, hash, thumbBytes: item.thumb!.size, largeBytes: item.large!.size })
  if (start.status === 'send') {
    await send(start.thumb, item.thumb!)
    await send(start.large, item.large!)
    await ask(`${base}/finish`, { challengeId: item.challengeId, label: item.label, hash, width: item.width, height: item.height, by: uploaderName() || undefined })
  }
}

async function run() {
  if (running) return
  running = true
  clearTimeout(wakeTimer)
  try {
    while (true) {
      const now = Date.now()
      const next = items.find(i => (i.state === 'preparing' || i.state === 'waiting') && i.nextTryAt <= now)
      if (!next) break
      try {
        await step(next)
        for (const listener of listeners) listener(next)
        finished(next)
      }
      catch (err) {
        if (err instanceof PhotoDecodeError || err instanceof PermanentError) {
          next.state = 'failed'
          next.error = err.message
          // Refused or unreadable: it stays on screen until dealt with, but isn't resent later.
          dropUpload(next.id)
          next.refusal = err instanceof PermanentError ? err.data : null
          if (fleetingRefusal(next)) {
            setTimeout(() => {
              if (items.includes(next) && fleetingRefusal(next)) forget(next)
            }, FLEETING_MS)
          }
        }
        else {
          next.attempts++
          next.state = 'waiting'
          if (err instanceof ServerTrouble) {
            next.troubles = (next.troubles ?? 0) + 1
            next.troubleSince ??= Date.now()
          }
          else {
            next.troubles = 0
            next.troubleSince = undefined
          }
          next.stuck = isStuck(next.troubles, next.troubleSince ?? Date.now(), Date.now())
          next.error = navigator.onLine ? 'Weak signal, trying again' : 'No signal'
          const delay = retryDelay(next.attempts)
          next.nextTryAt = Date.now() + delay
        }
      }
    }
  }
  finally {
    running = false
  }
  const soonest = Math.min(...items.filter(i => i.state === 'waiting').map(i => i.nextTryAt))
  if (Number.isFinite(soonest)) wakeTimer = setTimeout(run, Math.max(500, soonest - Date.now()))
}

// Retry straight away when the signal returns or the page is shown again, and warn before
// the page itself closes with photos still to send. Set up once, for the life of the app.
function listenOnce() {
  if (listening) return
  listening = true
  window.addEventListener('online', retryAllNow)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') retryAllNow()
    else saveTypedNames()
  })
  window.addEventListener('beforeunload', (e) => {
    if (pending.value.length > 0) e.preventDefault()
  })
}

// Picks up photos a closed tab didn't finish sending, and race photos not yet named. Runs once,
// when the app starts.
let restored = false
export async function restoreUploads() {
  if (restored) return
  restored = true
  for (const d of await loadDrafts()) {
    if (!drafts.some(x => x.key === d.key)) drafts.push({ ...d, url: URL.createObjectURL(d.file) })
  }
  const saved = await loadUploads()
  if (!saved.length) return
  if (!items.length) batchDone.value = 0
  for (const u of saved) {
    if (items.some(i => i.id === u.id)) continue
    items.push({
      id: u.id,
      token: u.token,
      challengeId: u.challengeId,
      label: u.label,
      // Only read again if it was never shrunk.
      file: u.file ?? new File([], 'photo.jpg'),
      previewUrl: u.thumb ? URL.createObjectURL(u.thumb) : null,
      large: u.large,
      thumb: u.thumb,
      width: u.width,
      height: u.height,
      // Shrunk copies always come with the hash worked out from the original.
      hash: u.file ? u.hash : (u.hash ?? null),
      state: u.large ? 'waiting' : 'preparing',
      error: null,
      attempts: 0,
      nextTryAt: 0,
      addedAt: u.addedAt,
      saved: true,
    })
  }
  listenOnce()
  run()
}

// A group page's view of the queue: its own group's photos, and a callback when one is sent.
export function useUploadQueue(token: () => string, onUploaded: (item: UploadItem) => void) {
  const mine = computed(() => items.filter(i => i.token === token()))
  const pendingHere = computed(() => mine.value.filter(i => i.state !== 'failed'))
  const failed = computed(() => mine.value.filter(i => i.state === 'failed'))
  const current = computed(() => mine.value.find(i => i.state === 'uploading' || i.state === 'preparing'))
  const listener = (item: UploadItem) => {
    if (item.token === token()) onUploaded(item)
  }
  onMounted(() => {
    listenOnce()
    listeners.add(listener)
  })
  onBeforeUnmount(() => listeners.delete(listener))

  function add(files: File[], target: { challengeId: string | null, label: string | null }) {
    if (!items.length) batchDone.value = 0
    for (const file of files) {
      const item: UploadItem = {
        id: crypto.randomUUID(),
        token: token(),
        challengeId: target.challengeId,
        label: target.label,
        file,
        previewUrl: null,
        state: 'preparing',
        error: null,
        attempts: 0,
        nextTryAt: 0,
        addedAt: Date.now(),
      }
      items.push(item)
      persist(item)
    }
    run()
  }

  return { items: mine, pending: pendingHere, failed, current, lastDone, batchDone, add, retry, forget }
}

// An animal or flower photo is taken first (a kingfisher won't wait), then named, then sent. Until
// then it's a draft: one per race and group, kept on the phone with what's been typed, so closing
// the sheet, leaving the page or the tab being closed doesn't lose it. Only sending it or its X
// discards it. A photo from "Take a photo" waits the same way while its challenge is chosen: one
// per group, under PHOTO_DRAFT, with the choice in `pick` (none means just a photo). One from
// the camera (`camera`) can be taken again (`retake`), keeping that choice. It can be cropped
// (`crop`): `file` is then the cropped copy, what's sent, and `original`, `frame` and `turns`
// keep the photo as taken, the frame and how far it was turned, so cropping again starts there.
export interface Draft {
  key: string
  token: string
  // The race it's for, or PHOTO_DRAFT.
  challengeId: string
  kind: 'animal' | 'colour' | 'photo'
  file: File
  url: string
  label: string
  pick?: { challengeId: string, label: string | null } | null
  camera?: boolean
  original?: File | null
  frame?: CropRect | null
  // Quarter turns anticlockwise, from crop's Rotate; the frame is on the photo as turned.
  turns?: number
  addedAt: number
}
export const PHOTO_DRAFT = '~photo'
// The photo in the full-screen check after a challenge's, a race's or a hidden group's camera
// (QuestShotReview): one per group, with the challenge it's for in `pick` (none for a hidden
// group's), kept on the phone so taking another or the tab closing can't lose it.
export const SHOT_DRAFT = '~shot'
const drafts = reactive<Draft[]>([])
const nameTimers = new Map<string, ReturnType<typeof setTimeout>>()

function saveDraftNow(d: Draft) {
  clearTimeout(nameTimers.get(d.key))
  nameTimers.delete(d.key)
  saveDraft({ key: d.key, token: d.token, challengeId: d.challengeId, kind: d.kind, file: d.file, label: d.label, pick: d.pick ? { ...d.pick } : null, camera: d.camera, original: d.original ?? null, frame: d.frame ? { ...d.frame } : null, turns: d.turns ?? 0, addedAt: d.addedAt })
}

// Typing saves after a pause, and straight away when the phone hides the page.
function saveTypedNames() {
  for (const key of [...nameTimers.keys()]) {
    const d = drafts.find(x => x.key === key)
    if (d) saveDraftNow(d)
  }
}

export function useDrafts(token: () => string) {
  const keyFor = (challengeId: string) => `${token()}:${challengeId}`
  const list = computed(() => drafts.filter(d => d.token === token()))
  const get = (challengeId: string) => drafts.find(d => d.key === keyFor(challengeId)) ?? null

  function discard(challengeId: string) {
    const d = get(challengeId)
    if (!d) return
    clearTimeout(nameTimers.get(d.key))
    nameTimers.delete(d.key)
    URL.revokeObjectURL(d.url)
    drafts.splice(drafts.indexOf(d), 1)
    dropDraft(d.key)
  }

  // `camera`: taken with the camera, so its X asks first and it can be taken again. `pick`: the
  // challenge it's for, if already known.
  function hold(challengeId: string, kind: Draft['kind'], file: File, opts: { camera?: boolean, pick?: Draft['pick'] } = {}) {
    listenOnce()
    discard(challengeId)
    drafts.push({ key: keyFor(challengeId), token: token(), challengeId, kind, file, url: URL.createObjectURL(file), label: '', camera: !!opts.camera, pick: opts.pick ?? null, addedAt: Date.now() })
    saveDraftNow(get(challengeId)!)
  }

  // Taken again: the new photo in place of the old, keeping what was chosen or typed for it,
  // but not the old one's crop.
  function retake(challengeId: string, file: File) {
    const d = get(challengeId)
    if (!d) return
    URL.revokeObjectURL(d.url)
    d.file = file
    d.url = URL.createObjectURL(file)
    d.original = null
    d.frame = null
    d.turns = 0
    d.addedAt = Date.now()
    saveDraftNow(d)
  }

  // Cropped and turned: `file` is the copy made from the photo as taken (kept in `original`), or
  // that photo again when it's neither cropped nor turned (frame null).
  function crop(challengeId: string, file: File, frame: CropRect | null, turns = 0) {
    const d = get(challengeId)
    if (!d) return
    const original = d.original ?? d.file
    URL.revokeObjectURL(d.url)
    d.file = frame ? file : original
    d.url = URL.createObjectURL(d.file)
    d.original = frame ? original : null
    d.frame = frame ? { ...frame } : null
    d.turns = frame ? turns : 0
    saveDraftNow(d)
  }

  function name(challengeId: string, label: string) {
    const d = get(challengeId)
    if (!d) return
    listenOnce()
    d.label = label
    clearTimeout(nameTimers.get(d.key))
    nameTimers.set(d.key, setTimeout(() => saveDraftNow(d), 400))
  }

  // The challenge chosen for a photo waiting to be sent; null for just a photo.
  function choose(challengeId: string, pick: Draft['pick']) {
    const d = get(challengeId)
    if (!d) return
    d.pick = pick ? { ...pick } : null
    saveDraftNow(d)
  }

  return { list, get, hold, retake, crop, name, choose, discard }
}
