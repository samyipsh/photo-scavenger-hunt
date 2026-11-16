// Photos normally load with signed links straight from R2 (usePhotoLinks in storage.ts). This
// route serves them through the app instead, only under `nuxt dev`.
// Only kept photos (p/...), never uploads still being checked.
export default defineEventHandler(async (event) => {
  const key = getRouterParam(event, 'key') ?? ''
  if (!photosViaApp() || !/^p\/[a-z0-9-]+\/[0-9a-f-]{36}(-[0-9a-f]{16})?-[tl]\.jpg$/.test(key)) {
    throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  }
  const photo = await useBindings(event).PHOTOS.get(key)
  if (!photo) throw createError({ statusCode: 404, statusMessage: 'Photo not found' })
  if (getHeader(event, 'if-none-match') === photo.httpEtag) {
    setResponseStatus(event, 304)
    return null
  }
  return new Response(photo.body as unknown as ReadableStream, {
    headers: {
      'content-type': 'image/jpeg',
      'content-length': String(photo.size),
      'etag': photo.httpEtag,
      'cache-control': PHOTO_CACHE_CONTROL,
      'x-robots-tag': 'noindex',
    },
  })
})
