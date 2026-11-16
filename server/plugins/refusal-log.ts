import type { H3Error } from 'h3'

// One log line saying why a request was refused (server/utils/refusalLog.ts). Failures (5xx) are
// left to Nitro, which already logs them with their stack.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event }) => {
    const pattern = event?.context.matchedRoute?.path as string | undefined
    const line = refusalLine(error as H3Error, {
      route: event && pattern ? `${event.method} ${pattern}` : undefined,
      group: event?.context.groupId as string | undefined,
    })
    if (line) console.log(line)
  })
})
