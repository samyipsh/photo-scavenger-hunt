import { describe, expect, it } from 'vitest'
import { isFinalRefusal, isStuck, looksLikeStorageRefusal, retryDelay, STUCK_AFTER_MS } from '../app/utils/uploadRules'

describe('isFinalRefusal', () => {
  it('drops photos the app refuses for good', () => {
    for (const status of [400, 403, 413, 415, 422, 423]) expect(isFinalRefusal(status)).toBe(true)
    expect(isFinalRefusal(429, 'group-limit')).toBe(true)
    expect(isFinalRefusal(429, 'demo-full')).toBe(true)
  })
  it('tries again when waiting or starting over can help', () => {
    for (const status of [408, 409, 429, 500, 502, 503]) expect(isFinalRefusal(status)).toBe(false)
  })
})

describe('looksLikeStorageRefusal', () => {
  it('counts a failure before the first byte or after the last as a refusal', () => {
    expect(looksLikeStorageRefusal(false, false, true)).toBe(true)
    expect(looksLikeStorageRefusal(true, true, true)).toBe(true)
  })
  it('counts a failure partway through, or offline, as the signal', () => {
    expect(looksLikeStorageRefusal(true, false, true)).toBe(false)
    expect(looksLikeStorageRefusal(false, false, false)).toBe(false)
  })
})

describe('isStuck', () => {
  it('needs three refusals in a row spread over a minute', () => {
    expect(isStuck(3, 0, STUCK_AFTER_MS)).toBe(true)
    expect(isStuck(2, 0, STUCK_AFTER_MS * 5)).toBe(false)
    expect(isStuck(5, 0, STUCK_AFTER_MS - 1)).toBe(false)
  })
})

describe('retryDelay', () => {
  it('doubles from 2 s and stops at 30 s, give or take a quarter', () => {
    expect(retryDelay(1, 0.5)).toBe(2000)
    expect(retryDelay(4, 0.5)).toBe(16_000)
    expect(retryDelay(9, 0.5)).toBe(30_000)
    expect(retryDelay(1, 0)).toBe(1500)
    expect(retryDelay(1, 1)).toBe(2500)
  })
})
