// Photos still to send, and race photos taken but not yet named, kept in the browser's IndexedDB
// so they survive the phone closing the tab in the background (iPhones do this often).
// Everything fails soft: without IndexedDB, as in some private windows, they simply live in
// memory as before.

export interface SavedUpload {
  id: string
  token: string
  challengeId: string | null
  label: string | null
  // The original, until the shrunk copies exist; then only the copies are kept.
  file?: File
  large?: Blob
  thumb?: Blob
  width?: number
  height?: number
  hash?: string | null
  addedAt: number
}

// An animal or flower photo waiting for its name or colour (one per race and group), a photo
// from "Take a photo" waiting to be sent (one per group, with the challenge chosen so far), or
// one in the full-screen check after a camera. Its photos are stored as their bytes, not as
// Files: Safari's IndexedDB won't keep a File (or any Blob) in some modes and fails without a
// word, which would lose the photo when an iPhone closes the tab. Drafts saved as Files by an
// earlier version still load.
export interface SavedDraft {
  key: string
  token: string
  challengeId: string
  kind: 'animal' | 'colour' | 'photo'
  file: File
  label: string
  pick?: { challengeId: string, label: string | null } | null
  // Taken with the camera, so it can be taken again.
  camera?: boolean
  // Cropped: `file` is the cropped copy; the photo as taken and the frame, to crop again.
  original?: File | null
  frame?: { x: number, y: number, w: number, h: number } | null
  // Quarter turns anticlockwise, from crop's Rotate.
  turns?: number
  addedAt: number
}

type StoreName = 'queue' | 'drafts'

const DB_NAME = 'pq-uploads'
// Version 2 added the drafts store; the queue store is untouched.
const DB_VERSION = 2
// Anything older than a day is from another outing or a test, not worth sending.
const MAX_AGE_MS = 24 * 60 * 60 * 1000
// Storage must never hold up sending: anything slower than this counts as failed.
const TIMEOUT_MS = 4000

// One connection, dropped when the browser closes it (Safari sometimes does), so the next
// operation opens a fresh one.
let opening: Promise<IDBDatabase> | null = null
function openDb(): Promise<IDBDatabase> {
  if (opening) return opening
  const attempt: Promise<IDBDatabase> = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      for (const name of ['queue', 'drafts'] satisfies StoreName[]) {
        if (!req.result.objectStoreNames.contains(name)) req.result.createObjectStore(name)
      }
    }
    req.onsuccess = () => {
      const db = req.result
      const forget = () => {
        if (opening === attempt) opening = null
      }
      db.onclose = forget
      db.onversionchange = () => {
        db.close()
        forget()
      }
      resolve(db)
    }
    req.onerror = () => reject(req.error)
  })
  opening = attempt
  attempt.catch(() => {
    if (opening === attempt) opening = null
  })
  return attempt
}

function withTimeout<T>(work: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Storage timed out')), TIMEOUT_MS)
    work.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

async function once<T>(name: StoreName, mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode)
    const req = act(tx.objectStore(name))
    tx.oncomplete = () => resolve(req.result)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

// One retry on a fresh connection, for a connection the browser closed under us.
async function run<T>(name: StoreName, mode: IDBTransactionMode, act: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  try {
    return await withTimeout(once(name, mode, act))
  }
  catch {
    opening = null
    return await withTimeout(once(name, mode, act))
  }
}

async function put(name: StoreName, key: string, value: unknown): Promise<boolean> {
  try {
    await run(name, 'readwrite', s => s.put(value, key))
    return true
  }
  catch {
    return false
  }
}

async function drop(name: StoreName, key: string): Promise<void> {
  try {
    await run(name, 'readwrite', s => s.delete(key))
  }
  catch {}
}

// Everything in a store from the last day, oldest first; anything older goes.
async function loadFresh<T extends { addedAt: number }>(name: StoreName, keyOf: (v: T) => string, complete: (v: T) => boolean): Promise<T[]> {
  try {
    const all = await run<T[]>(name, 'readonly', s => s.getAll())
    const fresh = all.filter(v => Date.now() - v.addedAt < MAX_AGE_MS && complete(v))
    for (const stale of all.filter(v => !fresh.includes(v))) drop(name, keyOf(stale))
    return fresh.sort((a, b) => a.addedAt - b.addedAt)
  }
  catch {
    return []
  }
}

// True when the photo is safely on the phone. False when it isn't (out of space, no IndexedDB):
// it still sends from memory, but only while the page stays open.
export const saveUpload = (upload: SavedUpload) => put('queue', upload.id, upload)
export const dropUpload = (id: string) => drop('queue', id)
export const loadUploads = () => loadFresh<SavedUpload>('queue', u => u.id, u => !!(u.file || (u.large && u.thumb)))

// A photo as a draft stores it: its bytes, type, name and time, which IndexedDB keeps everywhere.
export interface StoredPhoto { bytes: ArrayBuffer, type: string, name: string, lastModified: number }
type StoredDraft = Omit<SavedDraft, 'file' | 'original'> & { file: StoredPhoto | File, original?: StoredPhoto | File | null }

// Each photo's bytes are read once and shared, so the saves of one draft (a name typed letter by
// letter) land in the order they were made.
const reading = new WeakMap<Blob, Promise<ArrayBuffer>>()
export async function toStoredPhoto(file: File): Promise<StoredPhoto> {
  let bytes = reading.get(file)
  if (!bytes) {
    bytes = file.arrayBuffer()
    reading.set(file, bytes)
  }
  return { bytes: await bytes, type: file.type || 'image/jpeg', name: file.name || 'photo.jpg', lastModified: file.lastModified }
}
// Back to a File; one saved as a File by an earlier version comes back as it is.
export function fromStoredPhoto(stored: StoredPhoto | File): File {
  if (stored instanceof Blob) return stored as File
  return new File([stored.bytes], stored.name, { type: stored.type, lastModified: stored.lastModified })
}

export async function saveDraft(draft: SavedDraft) {
  try {
    const stored: StoredDraft = { ...draft, file: await toStoredPhoto(draft.file), original: draft.original ? await toStoredPhoto(draft.original) : null }
    return await put('drafts', draft.key, stored)
  }
  catch {
    return false
  }
}
export const dropDraft = (key: string) => drop('drafts', key)
export async function loadDrafts(): Promise<SavedDraft[]> {
  const stored = await loadFresh<StoredDraft>('drafts', d => d.key, d => !!d.file)
  return stored.map(d => ({ ...d, file: fromStoredPhoto(d.file), original: d.original ? fromStoredPhoto(d.original) : null }))
}
