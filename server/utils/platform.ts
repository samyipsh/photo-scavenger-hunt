// The only file that knows about Cloudflare's bindings. Moving to another host means
// replacing useDb here and the photo store in storage.ts.
import type { D1Database, R2Bucket } from '@cloudflare/workers-types'
import type { H3Event } from 'h3'
import { drizzle } from 'drizzle-orm/d1'
import * as schema from '../db/schema'

interface Bindings {
  DB: D1Database
  PHOTOS: R2Bucket
  // For signed upload links and copies inside the bucket (see storage.ts). The keys are
  // Worker secrets; the rest are vars in the wrangler config.
  R2_S3_ENDPOINT?: string
  R2_BUCKET_NAME?: string
  R2_ACCESS_KEY_ID?: string
  R2_SECRET_ACCESS_KEY?: string
  // How long a signed view link stays the same, and how many are remembered: see usePhotoLinks.
  PHOTO_LINK_HOURS?: string
  PHOTO_LINK_CACHE?: string
  // "true" makes this the public demo: see server/utils/demo.ts. Off when unset.
  DEMO_MODE?: string
}

export function useBindings(event: H3Event): Bindings {
  const env = event.context.cloudflare?.env as Bindings | undefined
  if (!env?.DB || !env?.PHOTOS) {
    throw createError({ statusCode: 500, statusMessage: 'Database and photo storage are not connected' })
  }
  return env
}

// Whether this is the public demo (docs/architecture.md, "Demo mode"). Locally, DEMO_MODE=true
// in .env, which Wrangler reads for `nuxt dev`.
export function isDemo(event: H3Event): boolean {
  return String(useBindings(event).DEMO_MODE) === 'true'
}

export function useDb(event: H3Event) {
  // drizzle's D1 driver expects the runtime's D1Database; the type packages differ slightly.
  return drizzle(useBindings(event).DB as never, { schema })
}

export type Db = ReturnType<typeof useDb>

// D1 reports how many rows a write changed; conditional updates use it to detect conflicts.
export function changedRows(result: unknown): number {
  return (result as { meta?: { changes?: number } }).meta?.changes ?? 0
}
