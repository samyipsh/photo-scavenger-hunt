// Step 1 of an upload. Runs every check before the phone sends anything, then hands back two
// short-lived links the phone sends the thumbnail and album copy to, straight to storage.
// A photo that's already saved stays as it is (a retry after a lost response).
export default defineEventHandler(async (event) => {
  const db = useDb(event)
  const group = await requireGroup(event, db)
  const body = await readBody<PhotoDetails & { thumbBytes?: unknown, largeBytes?: unknown }>(event).catch(() => null) ?? {}
  const { id, saved } = await admitUpload(event, db, group, body, { countLimits: false })
  if (saved) return { id, status: 'saved' }

  const thumbBytes = byteCount(body.thumbBytes, MAX_THUMB_BYTES)
  const largeBytes = byteCount(body.largeBytes, MAX_LARGE_BYTES)
  const store = usePhotoStore(event)
  const keys = uploadKeys(group.id, id)
  const [thumb, large] = await Promise.all([
    store.signUpload(keys.thumbKey, thumbBytes),
    store.signUpload(keys.largeKey, largeBytes),
  ])
  return { id, status: 'send', thumb, large }
})

function byteCount(value: unknown, max: number): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw createError({ statusCode: 400, statusMessage: 'No photo sent' })
  if (n > max) throw createError({ statusCode: 413, statusMessage: 'Photo too large' })
  return n
}
