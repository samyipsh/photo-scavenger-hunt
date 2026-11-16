import { EVENT } from '~~/data/event'
import { eq, sql } from 'drizzle-orm'
import { loginAttempts } from '../../db/schema'

const WINDOW_MS = 15 * 60_000
const MAX_FAILURES = 8

function sameText(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let diff = x.length ^ y.length
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0
}

export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const { passphrase } = await readBody<{ passphrase?: string }>(event) ?? {}
  const expected = useRuntimeConfig(event).committeePassphrase
  if (!expected) throw createError({ statusCode: 500, statusMessage: 'Committee passphrase not set up' })

  const ip = getHeader(event, 'cf-connecting-ip') ?? getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const now = Date.now()
  // Every try is counted before the passphrase is compared, in one statement, so guesses sent at
  // the same moment can't all slip in under the limit. A window that has ended starts again from
  // this try, and signing in clears the count.
  const open = sql`${now} - ${loginAttempts.windowStart} < ${WINDOW_MS}`
  const counted = await db.insert(loginAttempts)
    .values({ ip, failures: 1, windowStart: now })
    .onConflictDoUpdate({
      target: loginAttempts.ip,
      set: {
        failures: sql`case when ${open} then ${loginAttempts.failures} + 1 else 1 end`,
        windowStart: sql`case when ${open} then ${loginAttempts.windowStart} else ${now} end`,
      },
    })
    .returning({ failures: loginAttempts.failures })
    .get()
  if ((counted?.failures ?? 0) > MAX_FAILURES) {
    throw createError({ statusCode: 429, statusMessage: `Too many wrong tries. Wait 15 minutes or ask ${EVENT.passphraseHelp}.` })
  }

  // Exact match. Keyboards sometimes add a space at the end, so only the ends are trimmed.
  if (!sameText((passphrase ?? '').trim(), expected.trim())) {
    await new Promise(resolve => setTimeout(resolve, 600))
    throw createError({ statusCode: 401, statusMessage: 'That passphrase isn\'t right' })
  }

  await db.delete(loginAttempts).where(eq(loginAttempts.ip, ip))
  await setUserSession(event, { user: { role: 'committee' }, loggedInAt: now })
  return { ok: true }
})
