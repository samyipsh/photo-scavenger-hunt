// Watches the app on the day: follows the app's requests with
// `wrangler tail`, which the usual wrangler login can do, and prints a summary each minute (in
// the event's time): requests, errors, uploads started and saved, the busiest phones and
// addresses, and a line starting !! for anything past the limits below. It only reads; it
// changes nothing.
//
//   node scripts/watch-live.ts             the live app
//   node scripts/watch-live.ts --staging   staging
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TIME_ZONE } from '../data/event.ts'
import { deviceCode } from '../shared/utils/device.ts'
import { UUID_PATTERN } from '../shared/utils/photos.ts'

// Per minute. A phone polls its page about 4 times a minute and spends 2 requests on each photo,
// so even a fast burst of photos stays well under PHONE_MAX. Many phones can share one address
// (a mobile network, public Wi-Fi), so an address gets far more room. Starts with no finish mean
// photos that never arrived: weak signal for a few, something wrong for many.
const PHONE_MAX = 60
const ADDRESS_MAX = 300
const UNFINISHED_MAX = 10
const TOP = 5
// Stands in for a device ID that isn't one.
const INVALID = 'invalid'

const ROOT = join(import.meta.dirname, '..')
const staging = process.argv.includes('--staging')
const config = readFileSync(join(ROOT, staging ? 'wrangler.staging.jsonc' : 'wrangler.jsonc'), 'utf8')
const worker = JSON.parse(config.replace(/^\s*\/\/.*$/gm, '')).name as string
// Group links name their group by token. Tail hides some tokens as REDACTED; those show as '?'.
const tokensFile = join(ROOT, 'data/tokens.local.json')
const groupByToken = new Map<string, string>(existsSync(tokensFile) ? Object.entries(JSON.parse(readFileSync(tokensFile, 'utf8')) as Record<string, string>).map(([group, token]) => [token, group]) : [])

interface TailEvent {
  outcome: string
  exceptions: { name: string, message: string }[]
  logs: { level: string, message: unknown[] }[]
  event?: { request?: { url: string, method: string, headers: Record<string, string>, cf?: { asn?: number } }, response?: { status: number } }
}
// One request: its route with tokens and IDs as placeholders, so the same kind of request counts
// together ("POST /api/g/:token/photos/:id/start"), and who sent it.
interface Line { route: string, status: number, refusal?: string, device?: string, group?: string, ip?: string, asn?: number, ua?: string }
interface Seen { line: Line, problems: string[] }

let seen: Seen[] = []
let tail: ChildProcess | undefined
let stopping = false
// Non-browser clients already flagged, by agent and address. A health check that polls every
// minute gets one !! line, then a quiet line each minute it's still there.
const flaggedClients = new Set<string>()

function take(e: TailEvent) {
  const req = e.event?.request
  if (!req) return
  const path = new URL(req.url).pathname
  const token = path.match(/^\/api\/g\/([^/]+)/)?.[1]
  // The device ID is whatever the caller sent, and it gets pasted into database commands
  // (to block a phone), so only a real one is kept. The server refuses any other.
  const device = req.headers['x-device-id']
  const line: Line = {
    route: `${req.method} ${path.replace(/^\/api\/g\/[^/]+/, '/api/g/:token').replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|REDACTED/gi, ':id').slice(0, 80)}`,
    status: e.event?.response?.status ?? 0,
    // The refusal log line (server/plugins/refusal-log.ts) says why a request was refused.
    refusal: e.logs.flatMap(l => l.message).find((m): m is { refusal: string } => typeof m === 'object' && m !== null && 'refusal' in m)?.refusal,
    device: device === undefined ? undefined : UUID_PATTERN.test(device) ? device : INVALID,
    group: token ? groupByToken.get(token) : undefined,
    ip: req.headers['cf-connecting-ip'],
    asn: req.cf?.asn,
    // Printed as is, so control characters are swapped out.
    ua: req.headers['user-agent']?.slice(0, 120).replace(/[\x00-\x1f\x7f]/g, '?'),
  }
  // Unhandled errors come with Nitro's console.error line; the Worker failing outright, as an outcome.
  const problems = [
    ...(e.outcome === 'ok' || e.outcome === 'canceled' ? [] : [`outcome ${e.outcome}`]),
    ...e.exceptions.map(x => `${x.name}: ${x.message}`),
    ...e.logs.filter(l => l.level === 'error').map(l => l.message.map(m => typeof m === 'string' ? m : JSON.stringify(m)).join(' ')),
  ].map(p => p.slice(0, 200))
  seen.push({ line, problems })
}

function tally<K>(keys: K[]): [K, number][] {
  const counts = new Map<K, number>()
  for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1)
  return [...counts].sort((a, b) => b[1] - a[1])
}

function summarise() {
  const lines = seen.map(s => s.line)
  const problems = seen.flatMap(s => s.problems)
  seen = []
  const time = new Date().toLocaleTimeString('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit' })
  if (!lines.length && !problems.length) return console.log(`${time}  no requests`)

  const starts = lines.filter(l => l.route.endsWith('/start') && l.status === 200)
  const saved = lines.filter(l => l.route.endsWith('/finish') && l.status === 201)
  const errors = lines.filter(l => l.status >= 500)
  const refused = lines.filter(l => l.status >= 400 && l.status < 500)
  const phones = tally(lines.flatMap(l => l.device ? [l.device] : []))
  const addresses = tally(lines.flatMap(l => l.ip ? [l.ip] : []))
  const groupOf = (device: string) => lines.find(l => l.device === device && l.group)?.group ?? '?'
  const asnOf = (ip: string) => lines.find(l => l.ip === ip)?.asn ?? '?'
  const codeOf = (device: string) => device === INVALID ? INVALID : deviceCode(device)
  const more = (list: unknown[]) => list.length > TOP ? ` · +${list.length - TOP} more` : ''

  const out = [
    `${time}  ${lines.length} requests · ${errors.length} 5xx · ${refused.length} 4xx · ${starts.length} uploads started, ${saved.length} saved · ${phones.length} phones · ${addresses.length} addresses`,
    `  phones     ${phones.slice(0, TOP).map(([d, n]) => `${codeOf(d)} ${groupOf(d)} ${n}`).join(' · ') || '-'}`,
    `  addresses  ${addresses.slice(0, TOP).map(([ip, n]) => `${ip} AS${asnOf(ip)} ${n}`).join(' · ') || '-'}`,
  ]
  const codes = tally(refused.map(l => `${l.status} ${l.route}${l.refusal && l.refusal !== 'none' ? ` ${l.refusal}` : ''}`))
  if (codes.length) out.push(`  refused    ${codes.slice(0, TOP).map(([c, n]) => `${c} ${n}`).join(' · ')}`)

  for (const [route, n] of tally(errors.map(l => l.route))) out.push(`!! 5xx ${route} ${n}`)
  for (const [p, n] of tally(problems)) out.push(`!! ${n}x ${p}`)
  for (const [device, n] of phones) {
    const unfinished = starts.filter(l => l.device === device).length - saved.filter(l => l.device === device).length
    if (n <= PHONE_MAX && unfinished < UNFINISHED_MAX) continue
    const routes = tally(lines.filter(l => l.device === device).map(l => l.route)).slice(0, 3).map(([r, c]) => `${r} ${c}`).join(', ')
    out.push(`!! phone ${codeOf(device)} (${groupOf(device)}${device === INVALID ? '' : `, ${device}`}): ${n} requests, ${unfinished} unfinished uploads; ${routes}`)
  }
  for (const [ip, n] of addresses) {
    if (n <= ADDRESS_MAX) continue
    const devices = new Set(lines.filter(l => l.ip === ip && l.device).map(l => l.device)).size
    out.push(`!! address ${ip} (AS${asnOf(ip)}): ${n} requests from ${devices} phones`)
  }
  const clients = tally(lines.filter(l => !l.ua?.startsWith('Mozilla/')).map(l => `${l.ua ?? 'no user agent'} from ${l.ip}`))
  const known = clients.filter(([client]) => flaggedClients.has(client))
  if (known.length) out.push(`  not browser ${known.slice(0, TOP).map(([client, n]) => `${client} ${n}`).join(' · ')}${more(known)}`)
  // At most TOP new ones a minute; the rest get their own line in a later minute.
  const fresh = clients.filter(([client]) => !flaggedClients.has(client))
  for (const [client, n] of fresh.slice(0, TOP)) {
    flaggedClients.add(client)
    out.push(`!! not a browser: ${client} (${n})`)
  }
  if (fresh.length > TOP) out.push(`!! not a browser: +${fresh.length - TOP} more`)
  console.log(out.join('\n'))
}

// Wrangler's own messages, in plain text, a whole line at a time.
function printWrangler(raw: string) {
  const text = raw.replace(/\x1B\[[0-9;]*m/g, '').replace(/^[^A-Za-z[]+/, '').trim()
  if (!text) return
  console.log(/Tail connection lost|Reconnecting/.test(text) ? `  tail       ${text.replace(/^\[WARNING\]\s*/, '')}` : `  wrangler   ${text}`)
}

// `wrangler tail --format json` prints each event as indented JSON, one after another, so events
// are cut out of the stream by counting braces outside strings.
function follow() {
  console.log(`Following ${worker}. A summary every minute; Ctrl+C stops.`)
  const child = spawn(join(ROOT, 'node_modules/.bin/wrangler'), ['tail', worker, '--format', 'json'], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  })
  tail = child
  // Tail drops the connection now and then and reconnects by itself. If it gives up, or can't
  // start at all, a !! line says so and it starts again, once however it ended.
  let restarting = false
  const again = (why: string) => {
    if (stopping || restarting) return
    restarting = true
    child.kill()
    console.log(`!! wrangler tail ${why}; starting again in 5 s`)
    setTimeout(follow, 5000)
  }
  child.on('error', err => again(`failed: ${err.message}`))

  let stderrLine = ''
  child.stderr!.setEncoding('utf8').on('data', (chunk: string) => {
    const lines = (stderrLine + chunk).split('\n')
    stderrLine = lines.pop()!
    lines.forEach(printWrangler)
  })
  // 'close' comes once stdout and stderr are drained, so the last events and messages are in.
  child.on('close', (code, signal) => {
    printWrangler(stderrLine)
    stderrLine = ''
    again(`stopped (${code ?? signal})`)
  })

  let buffer = ''
  let depth = 0
  let inString = false
  let escaped = false
  child.stdout!.setEncoding('utf8').on('data', (chunk: string) => {
    for (const c of chunk) {
      // Between events, only the next event's opening brace matters.
      if (depth === 0) {
        if (c === '{') {
          buffer = c
          depth = 1
        }
        continue
      }
      buffer += c
      if (inString) {
        if (escaped) escaped = false
        else if (c === '\\') escaped = true
        else if (c === '"') inString = false
      }
      else if (c === '"') inString = true
      else if (c === '{') depth++
      else if (c === '}' && --depth === 0) {
        try {
          take(JSON.parse(buffer))
        }
        catch (err) {
          console.log(`!! unreadable tail event: ${String(err).slice(0, 100)}`)
        }
      }
    }
  })
}

// Stopping the watcher stops its tail too, so none is left running.
process.on('exit', () => tail?.kill())
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(signal, () => {
    stopping = true
    process.exit(0)
  })
}

follow()
setInterval(summarise, 60_000)
