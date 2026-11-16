// `nuxt dev` only: stands in for R2's signed upload links, which need the S3 endpoint that
// `nuxt dev` doesn't have. Takes the bytes the way R2 would: only at an upload key, only a
// JPEG content type and only the declared size. Built apps answer 404.
export default defineEventHandler(async (event) => {
  if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not found' })
  const key = getRouterParam(event, 'key') ?? ''
  if (!/^u\/[a-z0-9-]+\/[0-9a-f-]{36}-[tl]\.jpg$/.test(key)) throw createError({ statusCode: 403, statusMessage: 'Not an upload key' })
  if (getHeader(event, 'content-type') !== 'image/jpeg') throw createError({ statusCode: 403, statusMessage: 'Wrong content type' })
  const body = await readRawBody(event, false)
  if (!body || body.length !== Number(getQuery(event).bytes)) throw createError({ statusCode: 403, statusMessage: 'Wrong size' })
  await useBindings(event).PHOTOS.put(key, body, { httpMetadata: { contentType: 'image/jpeg' } })
  return null
})
