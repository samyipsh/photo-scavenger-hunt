// Looks at and clears staging's photos: the database rows through wrangler, the files through
// R2 with STAGING_R2_ACCESS_KEY_ID and STAGING_R2_SECRET_ACCESS_KEY from .env (a token for the
// staging bucket only). Staging only: it reads the bucket and database from wrangler.staging.jsonc.
//
//   node scripts/staging-data.ts status               photos and files, and files no photo uses
//   node scripts/staging-data.ts clear --by "Load test"  deletes the photos with that photo credit
//   node scripts/staging-data.ts clear-orphans        deletes kept files no photo uses
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { AwsClient } from 'aws4fetch'

const ROOT = join(import.meta.dirname, '..')
process.loadEnvFile(join(ROOT, '.env'))
const config = JSON.parse(readFileSync(join(ROOT, 'wrangler.staging.jsonc'), 'utf8').replace(/^\s*\/\/.*$/gm, ''))
const bucket: string = config.r2_buckets[0].bucket_name
const endpoint: string = config.vars.R2_S3_ENDPOINT
if (!bucket.endsWith('-staging')) throw new Error(`Not the staging bucket: ${bucket}`)
const { STAGING_R2_ACCESS_KEY_ID: accessKeyId, STAGING_R2_SECRET_ACCESS_KEY: secretAccessKey } = process.env
if (!accessKeyId || !secretAccessKey) throw new Error('Add STAGING_R2_ACCESS_KEY_ID and STAGING_R2_SECRET_ACCESS_KEY to .env')
const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' })

function sql<T = Record<string, unknown>>(command: string): T[] {
  const out = execFileSync('pnpm', ['-s', 'wrangler', 'd1', 'execute', 'DB', '--remote', '-c', 'wrangler.staging.jsonc', '--json', '--command', command], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'inherit'] })
  return JSON.parse(out).flatMap((r: { results: T[] }) => r.results)
}
const quote = (s: string) => `'${s.replace(/'/g, '\'\'')}'`

async function listFiles(prefix: string): Promise<{ key: string, size: number }[]> {
  const files: { key: string, size: number }[] = []
  let token = ''
  do {
    const url = new URL(`${endpoint}/${bucket}`)
    url.searchParams.set('list-type', '2')
    url.searchParams.set('prefix', prefix)
    if (token) url.searchParams.set('continuation-token', token)
    const res = await r2.fetch(url)
    const xml = await res.text()
    if (!res.ok) throw new Error(`Listing ${prefix}: ${res.status} ${xml.slice(0, 200)}`)
    for (const m of xml.matchAll(/<Contents>[\s\S]*?<Key>(.*?)<\/Key>[\s\S]*?<Size>(\d+)<\/Size>[\s\S]*?<\/Contents>/g)) files.push({ key: m[1]!, size: Number(m[2]) })
    token = xml.match(/<NextContinuationToken>(.*?)<\/NextContinuationToken>/)?.[1] ?? ''
  } while (token)
  return files
}

async function deleteFiles(keys: string[]): Promise<void> {
  let next = 0
  let failed = 0
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (next < keys.length) {
      const key = keys[next++]!
      const res = await r2.fetch(`${endpoint}/${bucket}/${encodeURI(key)}`, { method: 'DELETE' })
      if (!res.ok && res.status !== 404) failed++
    }
  }))
  console.log(`Deleted ${keys.length - failed} files${failed ? `, ${failed} failed` : ''}`)
}

const mb = (files: { size: number }[]) => `${(files.reduce((n, f) => n + f.size, 0) / 1e6).toFixed(1)} MB`
async function orphans() {
  const used = new Set(sql<{ k: string }>('select thumb_key k from photos union select large_key from photos').map(r => r.k))
  return (await listFiles('p/')).filter(f => !used.has(f.key))
}

const [command, ...rest] = process.argv.slice(2)
const flag = (name: string) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined }

if (command === 'status') {
  const [counts] = sql<{ total: number, gallery: number, gone: number }>('select count(*) total, sum(removed = 0) gallery, sum(files_deleted_at is not null) gone from photos')
  console.log(`Photos: ${counts!.total} rows, ${counts!.gallery} in the gallery, ${counts!.gone} with files deleted`)
  for (const r of sql<{ by: string | null, n: number }>('select uploader_name by, count(*) n from photos group by uploader_name order by n desc limit 10')) console.log(`  ${r.by ?? '(no name)'}: ${r.n}`)
  const kept = await listFiles('p/')
  const unfinished = await listFiles('u/')
  console.log(`Files: ${kept.length} kept (${mb(kept)}), ${unfinished.length} unfinished uploads (${mb(unfinished)}, gone after a day)`)
  const loose = await orphans()
  console.log(`Kept files no photo uses: ${loose.length} (${mb(loose)})`)
}
else if (command === 'clear') {
  const by = flag('by')
  if (!by) throw new Error('Say whose photos: clear --by "Load test"')
  const rows = sql<{ thumb: string, large: string }>(`select thumb_key thumb, large_key large from photos where uploader_name = ${quote(by)}`)
  console.log(`${rows.length} photos by ${by}`)
  if (rows.length) {
    sql(`delete from photo_likes where photo_id in (select id from photos where uploader_name = ${quote(by)}); delete from photos where uploader_name = ${quote(by)}; delete from settings where key = 'scoreboard_cache'`)
    await deleteFiles(rows.flatMap(r => [r.thumb, r.large]))
  }
}
else if (command === 'clear-orphans') {
  await deleteFiles((await orphans()).map(f => f.key))
}
else {
  console.log('node scripts/staging-data.ts status | clear --by NAME | clear-orphans')
}
