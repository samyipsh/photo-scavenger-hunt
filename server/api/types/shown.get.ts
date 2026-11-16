// Whether the Types of Christ answers are out, for Help's Misc list: one settings row, without
// the answers themselves.
export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'no-store')
  return { shown: await getTypesShown(useDb(event)) }
})
