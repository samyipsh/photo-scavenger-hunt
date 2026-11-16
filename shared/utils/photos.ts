// Rules about photos that the phone and the server share.

// Sizes the phone shrinks to and the server holds it to.
export const MAX_LARGE_BYTES = 3 * 1024 * 1024
export const MAX_THUMB_BYTES = 400 * 1024

// The most photos one committee request acts on (Hide in the gallery's Select; Unhide and Delete
// for good in Hidden photos): D1 takes at most 100 values in a query, and each photo's ID is one. The
// phone sends a bigger selection in turns.
export const COMMITTEE_BATCH = 50

// IDs the phone makes with crypto.randomUUID(): each photo's, and the phone's own.
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3 && bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF
}

// A name someone typed (an animal, a photo credit): spaces tidied, at most 40 characters, or
// null when there's nothing left.
export function cleanName(value: unknown): string | null {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, 40) || null : null
}
