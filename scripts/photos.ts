// Photos for the scripts. With the recce photos in this folder (kept out of git) and macOS, it
// resizes the real ones with sips, so screenshots look like the event. Anywhere else, a fresh
// clone or CI, it draws stand-in JPEGs with Playwright, so every check still runs.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { type Browser, chromium } from 'playwright'

const ROOT = join(import.meta.dirname, '..')
export const RECCE = join(ROOT, 'recce photos')
export const CACHE = join(ROOT, '.wrangler', 'demo-photos')
const canResize = process.platform === 'darwin'

let browser: Browser | null = null

// A JPEG of `source` (a recce photo's file name, or any name for a stand-in) with its long edge
// at `edge` pixels, saved as `name` in the cache. Returns the file's path.
export async function photoFile(name: string, source: string, edge: number): Promise<string> {
  mkdirSync(CACHE, { recursive: true })
  const out = join(CACHE, `${name}.jpg`)
  if (existsSync(out)) return out
  const real = join(RECCE, source)
  if (canResize && existsSync(real)) {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-Z', String(edge), real, '--out', out], { stdio: 'ignore' })
    return out
  }
  await drawStandIn(name, edge, out)
  return out
}

export async function photoBytes(name: string, source: string, edge: number): Promise<Buffer> {
  return readFileSync(await photoFile(name, source, edge))
}

// A landscape picture in a colour picked from the name, with the name written on it. The same
// name and size always give the same bytes.
async function drawStandIn(name: string, edge: number, out: string) {
  browser ??= await chromium.launch()
  const page = await browser.newPage({ viewport: { width: edge, height: Math.round(edge * 0.75) } })
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7)
  await page.setContent(`<body style="margin:0;height:100vh;display:grid;place-items:center;font:600 ${Math.round(edge / 12)}px sans-serif;color:white;background:linear-gradient(135deg,hsl(${hue} 55% 38%),hsl(${(hue + 60) % 360} 50% 22%))">${name.replace(/[<&]/g, '')}</body>`)
  await page.screenshot({ path: out, type: 'jpeg', quality: 85 })
  await page.close()
}

export async function closePhotos() {
  await browser?.close()
  browser = null
}
