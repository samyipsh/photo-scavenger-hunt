// Demo mode's nightly reset, on the first API request of each day (server/utils/demo.ts). Does
// nothing unless demo mode is on.
export default defineEventHandler(async (event) => {
  if (event.path.startsWith('/api/')) await resetDemoIfNewDay(event)
})
