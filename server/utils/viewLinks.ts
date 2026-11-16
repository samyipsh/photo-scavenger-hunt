// Signs R2 view links (SigV4 query signing for GET) as cheaply as possible, because the gallery
// and group pages sign up to hundreds per request on a fresh Worker instance. Everything that's
// the same for every link in a period (the signing key, the credential, the query) is worked out
// once; each link then costs one SHA-256 and one HMAC. Produces exactly what aws4fetch does for
// the same inputs (checked in tests/viewLinks.test.ts).

export interface ViewLinkSettings {
  endpoint: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  // When the period started (ms), used as the signing date so links stay the same all period.
  from: number
  expiresSeconds: number
  cacheControl: string
}

const encoder = new TextEncoder()
const bytes = (s: string) => encoder.encode(s) as Uint8Array<ArrayBuffer>
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
const rfc3986 = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)

async function hmac(key: ArrayBuffer | Uint8Array<ArrayBuffer>, data: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return crypto.subtle.sign('HMAC', k, bytes(data))
}

export async function viewLinkSigner(s: ViewLinkSettings): Promise<(key: string) => Promise<string>> {
  const url = new URL(s.endpoint)
  const host = url.host
  const datetime = new Date(s.from).toISOString().replace(/[:-]|\.\d{3}/g, '')
  const date = datetime.slice(0, 8)
  const scope = `${date}/auto/s3/aws4_request`
  // The day's signing key, imported once.
  let k = await hmac(bytes(`AWS4${s.secretAccessKey}`), date)
  for (const part of ['auto', 's3', 'aws4_request']) k = await hmac(k, part)
  const signingKey = await crypto.subtle.importKey('raw', k, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  // Query parameters, already in SigV4's sorted order (uppercase X before lowercase r).
  const query = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${s.accessKeyId}/${scope}`],
    ['X-Amz-Date', datetime],
    ['X-Amz-Expires', String(s.expiresSeconds)],
    ['X-Amz-SignedHeaders', 'host'],
    ['response-cache-control', s.cacheControl],
  ].map(([name, value]) => `${rfc3986(name!)}=${rfc3986(value!)}`).join('&')
  const base = `${url.protocol}//${host}`
  // Keeps any path in the endpoint, such as Wrangler's local `/cdn-cgi/local/r2/s3`.
  const prefix = url.pathname.replace(/\/$/, '')
  const bucketPath = `${prefix}/${s.bucket.split('/').map(rfc3986).join('/')}`

  return async (key) => {
    const path = `${bucketPath}/${key.split('/').map(rfc3986).join('/')}`
    const canonical = `GET\n${path}\n${query}\nhost:${host}\n\nhost\nUNSIGNED-PAYLOAD`
    const digest = hex(await crypto.subtle.digest('SHA-256', bytes(canonical)))
    const toSign = `AWS4-HMAC-SHA256\n${datetime}\n${scope}\n${digest}`
    const signature = hex(await crypto.subtle.sign('HMAC', signingKey, bytes(toSign)))
    return `${base}${path}?${query}&X-Amz-Signature=${signature}`
  }
}
