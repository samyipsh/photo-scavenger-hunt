// The upload queue's decisions, kept apart from the queue itself so they can be tested: which
// refusals are final, when a failed upload is storage saying no rather than a lost signal, when
// to tell people something's wrong, and how long to wait before trying again.

import type { RefusalCode } from '#shared/utils/refusals'

// An answer from the app that isn't success: final (the photo is refused and dropped) or worth
// trying again. 408, 409 (a file that didn't arrive, start again) and 429 (busy) are worth
// another go, except the 429s that say a group limit is reached or the demo is full.
export function isFinalRefusal(status: number, code?: RefusalCode): boolean {
  if (status === 429) return code === 'group-limit' || code === 'demo-full'
  return status >= 400 && status < 500 && status !== 408 && status !== 409
}

// A file upload that failed with no readable answer. Browsers hide a storage refusal that lacks
// CORS headers (a wrong CORS rule, an expired token) as a failed request, and it comes either
// before the first byte or after the last; a failure partway through is the signal.
export function looksLikeStorageRefusal(bytesMoved: boolean, allSent: boolean, online: boolean): boolean {
  return (!bytesMoved || allSent) && online
}

// Refused three times in a row, over at least a minute, while the phone had a signal: something
// waiting won't fix, so the phone says the photo isn't sending.
export const STUCK_AFTER_MS = 60_000
export function isStuck(refusalsInARow: number, firstRefusalAt: number, now: number): boolean {
  return refusalsInARow >= 3 && now - firstRefusalAt >= STUCK_AFTER_MS
}

// How long to wait before the next try: doubling from 2 s up to 30 s, give or take a quarter,
// so phones that lost signal together don't all retry at once.
export function retryDelay(attempts: number, random = Math.random()): number {
  return Math.min(30_000, 1000 * 2 ** Math.min(attempts, 5)) * (0.75 + random * 0.5)
}
