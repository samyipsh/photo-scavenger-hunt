import { AwsV4Signer } from 'aws4fetch'
import { describe, expect, it } from 'vitest'
import { viewLinkSigner } from '../server/utils/viewLinks'

// The quick signer must produce exactly the link aws4fetch (a well-used SigV4 library) would.
describe('viewLinkSigner', () => {
  it.each([
    ['R2', 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com'],
    ['Wrangler local, with a path', 'http://localhost:8787/cdn-cgi/local/r2/s3'],
  ])('matches aws4fetch for the same inputs (%s)', async (_name, endpoint) => {
    const settings = {
      endpoint,
      bucket: 'photo-quest-photos',
      accessKeyId: 'AKIDEXAMPLE1234567890',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
      from: Date.UTC(2026, 10, 13, 16),
      expiresSeconds: 172800,
      cacheControl: 'private, max-age=172800, immutable',
    }
    const sign = await viewLinkSigner(settings)
    for (const key of ['p/g1/0f0f0f0f-0000-4000-8000-000000000001-t.jpg', 'p/recce/2d6c1f0e-5a7b-4c8d-9e0f-1a2b3c4d5e6f-0123456789abcdef-l.jpg']) {
      const url = new URL(`${settings.endpoint}/${settings.bucket}/${key}`)
      url.searchParams.set('X-Amz-Expires', String(settings.expiresSeconds))
      url.searchParams.set('response-cache-control', settings.cacheControl)
      const expected = (await new AwsV4Signer({
        url: url.toString(),
        method: 'GET',
        accessKeyId: settings.accessKeyId,
        secretAccessKey: settings.secretAccessKey,
        service: 's3',
        region: 'auto',
        signQuery: true,
        datetime: new Date(settings.from).toISOString().replace(/[:-]|\.\d{3}/g, ''),
      }).sign()).url.toString()
      const mine = new URL(await sign(key))
      const theirs = new URL(expected)
      expect(mine.pathname).toBe(theirs.pathname)
      expect(Object.fromEntries(mine.searchParams)).toEqual(Object.fromEntries(theirs.searchParams))
    }
  })
})
