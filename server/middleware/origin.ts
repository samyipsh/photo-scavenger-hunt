// Requests that change anything must come from the app's own pages.
export default defineEventHandler((event) => {
  const method = event.method
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return
  if (!event.path.startsWith('/api/')) return
  const origin = getHeader(event, 'origin')
  const host = getRequestHost(event, { xForwardedHost: false })
  if (!origin) return
  let originHost = ''
  try {
    originHost = new URL(origin).host
  }
  catch {}
  if (originHost !== host) {
    throw createError({ statusCode: 403, statusMessage: 'Request from another site' })
  }
})
