// How a photo's time reads wherever it's shown (the photo view, the judge, saved file names).
// The committee picks one in Manage › Controls; data/event.ts has the event's default.
//   time: "10:42 am", for a one-day event
//   day:  "Sat 10:42 am", for an event over a few days
//   date: "14 Nov, 10:42 am", for anything longer
// In the event's time zone (data/event.ts), as everywhere else in the app.
import { formatClock, TIME_ZONE } from './rotation'

export const PHOTO_TIME_STYLES = ['time', 'day', 'date'] as const
export type PhotoTimeStyle = typeof PHOTO_TIME_STYLES[number]

export function isPhotoTimeStyle(v: unknown): v is PhotoTimeStyle {
  return typeof v === 'string' && (PHOTO_TIME_STYLES as readonly string[]).includes(v)
}

const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: TIME_ZONE })
const dayMonth = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: TIME_ZONE })
const hhmm = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TIME_ZONE })

// Built from its parts, so every browser gives the same words: "Sat", "14 Nov".
function part(format: Intl.DateTimeFormat, ms: number, type: Intl.DateTimeFormatPartTypes) {
  return format.formatToParts(ms).find(p => p.type === type)?.value ?? ''
}
const dayName = (ms: number) => part(weekday, ms, 'weekday')
const date = (ms: number) => `${part(dayMonth, ms, 'day')} ${part(dayMonth, ms, 'month')}`

export function formatPhotoTime(ms: number, style: PhotoTimeStyle): string {
  if (style === 'day') return `${dayName(ms)} ${formatClock(ms)}`
  if (style === 'date') return `${date(ms)}, ${formatClock(ms)}`
  return formatClock(ms)
}

// For a saved photo's file name: "0952", "Sat-0952", "14Nov-0952".
export function photoTimeSlug(ms: number, style: PhotoTimeStyle): string {
  const time = `${part(hhmm, ms, 'hour')}${part(hhmm, ms, 'minute')}`
  if (style === 'day') return `${dayName(ms)}-${time}`
  if (style === 'date') return `${date(ms).replace(' ', '')}-${time}`
  return time
}
