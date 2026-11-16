// Photo storage. The only file that knows about R2.
//
// Photo bytes never pass through the Worker. A phone asks the app for two short-lived signed
// links, sends the thumbnail and album copy straight to the bucket under an upload key (u/...),
// then asks the app to finish. The app checks what arrived and copies it, inside R2, to its
// lasting key (p/...). Signed links only ever point at upload keys, so a reused link can't
// change a photo once it's kept, and a lifecycle rule clears upload keys after a day, so
// abandoned uploads tidy themselves away. Phones read photos with signed view links: see usePhotoLinks.
import type { R2Bucket, R2Object, R2ObjectBody } from '@cloudflare/workers-types'
import type { H3Event } from 'h3'
import { isNull } from 'drizzle-orm'
import { AwsClient, AwsV4Signer } from 'aws4fetch'
import { photos } from '../db/schema'
import { UTC_OFFSET_MS } from '#shared/utils/rotation'

export interface UploadTarget {
  url: string
  // Headers the phone must send with the PUT; the signature covers them.
  headers: Record<string, string>
}

export interface SentFile {
  size: number
  etag: string
  // The first bytes, enough to tell a JPEG.
  head: Uint8Array
}

export interface PhotoStore {
  // A link that accepts exactly `bytes` bytes of JPEG at `key` for the next few minutes.
  signUpload(key: string, bytes: number): Promise<UploadTarget>
  // What arrived at an upload key, or null if nothing did.
  peek(key: string): Promise<SentFile | null>
  // Copies an upload to its lasting key, only if it's still the file that was checked.
  // False when it changed or vanished in between.
  keep(from: string, to: string, etag: string): Promise<boolean>
  remove(key: string): Promise<void>
}

const UPLOAD_LINK_SECONDS = 15 * 60
// Signing keys last a day; keeping them saves four HMACs per link.
const signingKeys = new Map<string, ArrayBuffer>()
// Kept photos never change, so phones may keep them for 30 days (on the /img route; signed view
// links set their own, shorter, cache time).
export const PHOTO_CACHE_CONTROL = 'public, max-age=2592000, immutable'

// Lasting keys carry part of each file's checksum, so every version of a photo gets its own
// key. Two finishes for the same photo can then never overwrite each other's files (R2 ignores
// "only if absent" on copies); the photo record decides which version counts. Photos kept
// before this have keys without the checksum.
export function photoKeys(groupId: string, photoId: string, etags: { thumb: string, large: string }) {
  const version = (etag: string) => etag.replace(/[^0-9a-f]/gi, '').toLowerCase().slice(0, 16)
  return {
    thumbKey: `p/${groupId}/${photoId}-${version(etags.thumb)}-t.jpg`,
    largeKey: `p/${groupId}/${photoId}-${version(etags.large)}-l.jpg`,
  }
}

export function uploadKeys(groupId: string, photoId: string) {
  return {
    thumbKey: `u/${groupId}/${photoId}-t.jpg`,
    largeKey: `u/${groupId}/${photoId}-l.jpg`,
  }
}

// Where phones load photos from: signed view links straight to R2. The bucket stays private, a
// leaked link dies within two periods, and adding sign-in later only means checking who asks.
// Under `nuxt dev` photos come through the app's /img route instead.
// A link stays the same for PHOTO_LINK_HOURS (default 24), so phones can cache the photo, and
// is valid for twice that. Each Worker instance remembers up to PHOTO_LINK_CACHE signed links
// (default 5000; 0 turns it off), shared by every request it serves, so a photo is signed about
// once per period rather than on every gallery refresh.
export function usePhotoLinks(event: H3Event): (key: string) => Promise<string> {
  const env = useBindings(event)
  if (photosViaApp()) return async key => `/img/${key}`
  if (!hasR2Keys(env)) throw createError({ statusCode: 500, statusMessage: 'Photo storage keys are not set' })

  // Two periods must fit SigV4's 7-day limit on a link's life, so at most 84 hours.
  const hours = Math.min(84, Math.max(1, Number(env.PHOTO_LINK_HOURS) || 24))
  const cacheSize = env.PHOTO_LINK_CACHE === undefined || env.PHOTO_LINK_CACHE === '' ? 5000 : Math.max(0, Number(env.PHOTO_LINK_CACHE) || 0)
  const period = hours * 3_600_000
  // Periods start at midnight at the event, not in UTC, so links don't all change mid-outing.
  const from = Math.floor((Date.now() - LINK_DAY_START) / period) * period + LINK_DAY_START
  const endpoint = env.R2_S3_ENDPOINT!.replace(/\/$/, '')
  // Everything a link depends on: a new period, bucket or key starts a fresh cache.
  const identity = [endpoint, env.R2_BUCKET_NAME, env.R2_ACCESS_KEY_ID, hours, from].join('|')
  if (identity !== links.identity) {
    links.byKey.clear()
    links.identity = identity
    // The day's signing key and query, worked out once and shared by every request here.
    links.signer = viewLinkSigner({
      endpoint,
      bucket: env.R2_BUCKET_NAME!,
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      from,
      expiresSeconds: hours * 2 * 3600,
      // The link changes every period anyway, so the phone may keep the photo until it does.
      cacheControl: `private, max-age=${hours * 2 * 3600}, immutable`,
    })
  }
  const signer = links.signer!
  return async (key) => {
    const known = links.byKey.get(key)
    if (known) return known
    const signed = await (await signer)(key)
    // Not if the settings or period changed while signing: that link belongs to the old ones.
    if (cacheSize > 0 && links.identity === identity) {
      if (links.byKey.size >= cacheSize) links.byKey.delete(links.byKey.keys().next().value!)
      links.byKey.set(key, signed)
    }
    return signed
  }
}

const links = { identity: '', signer: null as Promise<(key: string) => Promise<string>> | null, byKey: new Map<string, string>() }
// Midnight at the event, as a time of the UTC day: 16:00 for Singapore (UTC+8).
const DAY_MS = 24 * 3_600_000
const LINK_DAY_START = ((-UTC_OFFSET_MS % DAY_MS) + DAY_MS) % DAY_MS

// Photos stream through the app's /img route only under `nuxt dev`, which has no S3 endpoint.
// Built apps keep it shut, so a key read off a signed link can't be turned into a link that
// never expires.
export function photosViaApp(): boolean {
  return import.meta.dev
}

function hasR2Keys(env: ReturnType<typeof useBindings>): boolean {
  return !!(env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_S3_ENDPOINT && env.R2_BUCKET_NAME)
}

// Reasons shown for a photo whose files were deleted for good. The mark itself is the
// photo's filesDeletedAt, set before the files go, so a finish still running for the same photo
// sees it and doesn't leave copies behind. Photos the committee deleted one at a time before
// 16 Nov 2026 still read "Deleted on request", which nobody had asked for; the text stays as saved.
export const FILES_DELETED = {
  committee: 'Deleted by the committee',
  inappropriate: 'Inappropriate',
  sender: 'Removed by the sender',
} as const

export function filesDeleted(row: { filesDeletedAt: number | null }): boolean {
  return row.filesDeletedAt !== null
}

// For updates that mustn't touch a photo deleted for good (judging, moving, restoring), even if
// the deletion lands between reading the photo and writing it.
export const notFilesDeleted = isNull(photos.filesDeletedAt)

// Deletes a kept photo's files. Needs only the bucket binding, not the upload keys.
// One call for every key: R2 takes up to 1000 at once.
export async function removePhotoFiles(event: H3Event, ...keys: string[]): Promise<void> {
  const wanted = keys.filter(Boolean)
  if (wanted.length) await useBindings(event).PHOTOS.delete(wanted)
}

export function usePhotoStore(event: H3Event): PhotoStore {
  const env = useBindings(event)
  // `nuxt dev` has no S3 endpoint, so it signs links to a stand-in route on the app itself.
  // Everything else, the phone's side and the finish checks, runs as on the live app.
  if (import.meta.dev) return devStore(env.PHOTOS)
  if (!hasR2Keys(env)) throw createError({ statusCode: 500, statusMessage: 'Photo storage keys are not set' })
  return r2Store(env.PHOTOS, {
    endpoint: env.R2_S3_ENDPOINT!.replace(/\/$/, ''),
    bucketName: env.R2_BUCKET_NAME!,
    accessKeyId: env.R2_ACCESS_KEY_ID!,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
  })
}

interface R2Settings {
  endpoint: string
  bucketName: string
  accessKeyId: string
  secretAccessKey: string
}

function r2Store(bucket: R2Bucket, settings: R2Settings): PhotoStore {
  const { endpoint, bucketName, accessKeyId, secretAccessKey } = settings
  const objectUrl = (key: string) => `${endpoint}/${bucketName}/${key}`
  // Two quick retries at most: the phone gives up on finish after 20 s and starts again anyway.
  const aws = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto', retries: 2, cache: signingKeys })
  return {
    async signUpload(key, bytes) {
      const url = new URL(objectUrl(key))
      url.searchParams.set('X-Amz-Expires', String(UPLOAD_LINK_SECONDS))
      // Content-Type and Content-Length are signed, so the link takes only a JPEG of the size
      // the phone declared. Browsers set Content-Length from the body themselves.
      const signer = new AwsV4Signer({
        url: url.toString(),
        method: 'PUT',
        headers: { 'content-type': 'image/jpeg', 'content-length': String(bytes) },
        accessKeyId,
        secretAccessKey,
        service: 's3',
        region: 'auto',
        signQuery: true,
        allHeaders: true,
        cache: signingKeys,
      })
      const signed = await signer.sign()
      return { url: signed.url.toString(), headers: { 'content-type': 'image/jpeg' } }
    },
    peek: key => peekBucket(bucket, key),
    async keep(from, to, etag) {
      // A copy inside R2: no bytes pass through the Worker.
      const res = await aws.fetch(objectUrl(to), {
        method: 'PUT',
        headers: {
          'x-amz-copy-source': `/${bucketName}/${from}`,
          'x-amz-copy-source-if-match': etag,
          'x-amz-metadata-directive': 'REPLACE',
          'content-type': 'image/jpeg',
          'cache-control': PHOTO_CACHE_CONTROL,
        },
      })
      const text = await res.text()
      if (res.status === 412 || res.status === 404) return false
      // S3 copies can answer 200 with an error in the body, so look for the result itself.
      if (!res.ok || !text.includes('CopyObjectResult')) {
        console.error('Photo copy failed', res.status, text.slice(0, 300))
        throw createError({ statusCode: 503, statusMessage: 'Photo storage is busy, trying again' })
      }
      return true
    },
    async remove(key) {
      await bucket.delete(key)
    },
  }
}

function devStore(bucket: R2Bucket): PhotoStore {
  return {
    async signUpload(key, bytes) {
      return { url: `/api/dev-upload/${key}?bytes=${bytes}`, headers: { 'content-type': 'image/jpeg' } }
    },
    peek: key => peekBucket(bucket, key),
    async keep(from, to, etag) {
      const obj = await bucket.get(from, { onlyIf: { etagMatches: etag.replaceAll('"', '') } })
      if (!hasBody(obj)) return false
      await bucket.put(to, await obj.arrayBuffer(), { httpMetadata: { contentType: 'image/jpeg', cacheControl: PHOTO_CACHE_CONTROL } })
      return true
    },
    async remove(key) {
      await bucket.delete(key)
    },
  }
}

async function peekBucket(bucket: R2Bucket, key: string): Promise<SentFile | null> {
  // One ranged read gives the whole file's size and ETag as well as its first bytes.
  const obj = await bucket.get(key, { range: { offset: 0, length: 3 } }).catch((err) => {
    console.error('Photo check failed', key, err)
    throw createError({ statusCode: 503, statusMessage: 'Photo storage is busy, trying again' })
  })
  if (!hasBody(obj)) return null
  return { size: obj.size, etag: obj.httpEtag, head: new Uint8Array(await obj.arrayBuffer()) }
}

// A conditional get that didn't match returns the object without its body. (Checked by method,
// not with `'body' in obj`, which reads the body stream under `nuxt dev`'s binding proxy.)
function hasBody(obj: R2Object | R2ObjectBody | null): obj is R2ObjectBody {
  return obj !== null && typeof (obj as R2ObjectBody).arrayBuffer === 'function'
}
