import { formatClock } from '#shared/utils/rotation'

// "just now", "4 min ago", or a clock time once it's over an hour old.
export function ago(ms: number, now = Date.now()): string {
  const s = Math.max(0, (now - ms) / 1000)
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  return `at ${formatClock(ms)}`
}
