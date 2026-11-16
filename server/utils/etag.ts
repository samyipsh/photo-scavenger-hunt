import type { H3Event } from 'h3'

// Sends `body` as JSON with an ETag (a hash of it), marked to be checked before every reuse. The
// browser then asks with If-None-Match by itself, and an unchanged answer comes back as 304 with
// no body, which the browser fills in from its cache. Only for answers that are the same for
// everyone who asks. Cloudflare turns the tag weak (W/"…") when it compresses, so the comparison
// ignores that.
export async function sendWithEtag<T>(event: H3Event, body: T): Promise<T> {
  const json = JSON.stringify(body)
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(json))
  const tag = `"${[...new Uint8Array(digest)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('')}"`
  setResponseHeaders(event, { 'etag': tag, 'cache-control': 'private, no-cache' })
  const asked = (getHeader(event, 'if-none-match') ?? '').split(',').map(t => t.trim().replace(/^W\//, ''))
  if (asked.includes(tag)) {
    setResponseStatus(event, 304)
    return null as unknown as T
  }
  setResponseHeader(event, 'content-type', 'application/json')
  // Already JSON: sent as it is, typed as what it holds.
  return json as unknown as T
}
