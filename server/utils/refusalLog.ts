import type { RefusalCode } from '#shared/utils/refusals'

// What Workers Logs keeps for each refused request (status 400 to 499): the refusal code the
// phone acts on (shared/utils/refusals.ts), or "none" when there isn't one, the message the phone
// was shown, and the group. The same log entry already carries the request's URL, status and
// headers (phone ID, address), so this adds only the why. Bodies and cookies are never read.
export interface RefusalLogLine {
  refusal: RefusalCode | 'none'
  status: number
  reason: string
  // The route's pattern, so tokens and photo IDs stay out: "POST /api/g/:token/photos/:id/start".
  route?: string
  group?: string
}

export function refusalLine(error: { statusCode?: number, statusMessage?: string, data?: unknown }, where: { route?: string, group?: string } = {}): RefusalLogLine | null {
  const status = error.statusCode ?? 500
  if (status < 400 || status >= 500) return null
  const code = (error.data as { code?: RefusalCode } | undefined)?.code
  return {
    refusal: code ?? 'none',
    status,
    reason: (error.statusMessage ?? '').slice(0, 160),
    ...(where.route ? { route: where.route } : {}),
    ...(where.group ? { group: where.group } : {}),
  }
}
