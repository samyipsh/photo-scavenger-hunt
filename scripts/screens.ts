// Captures the screens shown on docs/screens.html, as a phone sees them: 390 by 844 at 2x.
//   node scripts/screens.ts [app address] [folder]     defaults: http://localhost:3000, docs/screens
// Run it against an app with photos and scores in it: the demo, or `pnpm dev` after
// scripts/demo-data.ts. The committee screens need the passphrase: COMMITTEE_PASSPHRASE, the
// demo's own (from /api/demo), or NUXT_COMMITTEE_PASSPHRASE in .env. It only reads; it signs in
// as the committee but changes nothing.
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { chromium, type Page } from 'playwright'

const ROOT = join(import.meta.dirname, '..')
const BASE = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
const OUT = resolve(ROOT, process.argv[3] ?? 'docs/screens')
// A moment in the middle of the outing, so the group page and scoreboard show rounds under way.
const AT = 'at=2026-11-14T10:12'

const groups: { id: string, token: string }[] = await (await fetch(`${BASE}/api/groups`)).json()
const g3 = groups.find(g => g.id === 'g3') ?? groups[0]!
// Only a demo answers /api/demo; anywhere else the address falls back to the app's page.
const demo: { passphrase?: string } = await fetch(`${BASE}/api/demo`)
  .then(r => r.headers.get('content-type')?.includes('json') ? r.json() : {}, () => ({}))
const envFile = join(ROOT, '.env')
const passphrase = process.env.COMMITTEE_PASSPHRASE ?? demo.passphrase
  ?? (existsSync(envFile) ? readFileSync(envFile, 'utf8').match(/NUXT_COMMITTEE_PASSPHRASE=(.*)/)?.[1]?.trim() : undefined)

mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await context.newPage()

// Waits for the page to settle: no requests for a moment, no loading placeholders, images in.
async function settle(p: Page) {
  await p.waitForLoadState('networkidle')
  await p.waitForFunction(() => !document.body.innerText.includes('Loading'), undefined, { timeout: 15_000 }).catch(() => {})
  await p.waitForFunction(() => [...document.images].every(i => i.complete), undefined, { timeout: 15_000 }).catch(() => {})
  await p.waitForTimeout(600)
}

let failed = 0
async function shot(name: string, path: string | null, act?: (p: Page) => Promise<void>) {
  try {
    if (path) await page.goto(`${BASE}${path}`)
    await settle(page)
    if (act) {
      await act(page)
      await settle(page)
    }
    await page.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 82 })
    console.log('saved', name)
  }
  catch (err) {
    failed++
    console.log('FAILED', name, String(err).split('\n')[0])
  }
}
const tap = (text: string | RegExp) => async (p: Page) => { await p.getByText(text).first().click() }

// Groups
await shot('home', '/')
await shot('group', `/g/${g3.token}?${AT}`)
await shot('group-spot-it', `/g/${g3.token}?${AT}`, tap(/^Spot it/))
await shot('challenge', null, tap('Swan'))
await shot('animals', `/g/${g3.token}?${AT}`, async (p) => {
  await tap(/^Spot it/)(p)
  await settle(p)
  await tap('Any animal')(p)
})
// Everyone
await shot('scoreboard', `/scoreboard?${AT}`)
await shot('gallery', '/gallery')
await shot('photo', '/gallery?sort=liked', async p => { await p.locator('main img').first().click() })
await shot('gallery-group', `/gallery?group=${g3.id}`)
await shot('not-counted', '/gallery?challenge=not-counted')
await shot('help', `/help?${AT}`)
await shot('guide', '/guide')
// Committee
await shot('sign-in', '/c')
if (passphrase) {
  const res = await page.request.post(`${BASE}/api/committee/login`, { data: { passphrase }, headers: { origin: BASE } })
  if (!res.ok()) console.log('FAILED sign-in', res.status())
  await shot('committee', `/c?${AT}`)
  await shot('judge', `/c/judge?${AT}`)
  await shot('station', `/c/station/riddles?${AT}`)
  await shot('manage', `/c/scores?${AT}`)
  await shot('hidden', '/c/hidden')
}
else {
  console.log('No passphrase: committee screens skipped')
}

await browser.close()
if (failed) process.exitCode = 1
