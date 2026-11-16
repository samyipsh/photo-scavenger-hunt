import { describe, expect, it } from 'vitest'
import { formatPhotoTime, isPhotoTimeStyle, photoTimeSlug } from '../shared/utils/photoTime'
import { PHOTO_TIMES } from '../data/event'

// Saturday 14 Nov 2026, 9:05 am in Singapore: the morning before is Friday 13 Nov.
const SAT = Date.parse('2026-11-14T09:05:00+08:00')
// 11:30 pm on Friday in Singapore, 3:30 pm UTC: Friday either way.
const FRI_LATE = Date.parse('2026-11-13T23:30:00+08:00')
// 12:30 am on Saturday in Singapore is still Friday in UTC (4:30 pm), so this one tells them apart.
const SAT_EARLY = Date.parse('2026-11-14T00:30:00+08:00')

describe('formatPhotoTime', () => {
  it('reads as the time alone, the weekday and time, or the date and time', () => {
    expect(formatPhotoTime(SAT, 'time')).toBe('9:05\u00A0am')
    expect(formatPhotoTime(SAT, 'day')).toBe('Sat 9:05\u00A0am')
    expect(formatPhotoTime(SAT, 'date')).toBe('14 Nov, 9:05\u00A0am')
  })

  it('uses the day in Singapore, not UTC', () => {
    expect(formatPhotoTime(FRI_LATE, 'day')).toBe('Fri 11:30\u00A0pm')
    expect(formatPhotoTime(FRI_LATE, 'date')).toBe('13 Nov, 11:30\u00A0pm')
    expect(formatPhotoTime(SAT_EARLY, 'day')).toBe('Sat 12:30\u00A0am')
    expect(formatPhotoTime(SAT_EARLY, 'date')).toBe('14 Nov, 12:30\u00A0am')
  })
})

describe('photoTimeSlug', () => {
  it('fits a file name', () => {
    expect(photoTimeSlug(SAT, 'time')).toBe('0905')
    expect(photoTimeSlug(SAT, 'day')).toBe('Sat-0905')
    expect(photoTimeSlug(SAT, 'date')).toBe('14Nov-0905')
    expect(photoTimeSlug(FRI_LATE, 'date')).toBe('13Nov-2330')
    expect(photoTimeSlug(SAT_EARLY, 'day')).toBe('Sat-0030')
    expect(photoTimeSlug(SAT_EARLY, 'date')).toBe('14Nov-0030')
  })
})

describe('isPhotoTimeStyle', () => {
  it('knows the three styles and nothing else', () => {
    expect(['time', 'day', 'date'].every(isPhotoTimeStyle)).toBe(true)
    expect(isPhotoTimeStyle('week')).toBe(false)
    expect(isPhotoTimeStyle(null)).toBe(false)
  })

  it("accepts the event's default", () => {
    expect(isPhotoTimeStyle(PHOTO_TIMES)).toBe(true)
  })
})
