import { TYPES_OF_CHRIST } from '~~/data/types-of-christ'

// The Types of Christ answers (the /types page), once the committee shows them (Manage ›
// Controls). Until then it refuses with `types-hidden`, so the answers reach no phone before the
// results: they live only in the server's code, never in the app's files. Shown, they're the same
// for everyone, so a phone that already has them gets 304.
export default defineEventHandler(async (event) => {
  if (!(await getTypesShown(useDb(event)))) {
    setHeader(event, 'cache-control', 'no-store')
    throw createError({ statusCode: 403, statusMessage: 'Not shown yet', data: { code: 'types-hidden' } })
  }
  return sendWithEtag(event, TYPES_OF_CHRIST)
})
