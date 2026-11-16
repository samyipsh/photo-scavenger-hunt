import { eq } from 'drizzle-orm'
import { blockedDevices } from '../../../db/schema'

// Lets a blocked phone upload again.
export default defineEventHandler(async (event) => {
  await requireCommittee(event)
  const id = getRouterParam(event, 'id') ?? ''
  await useDb(event).delete(blockedDevices).where(eq(blockedDevices.deviceId, id)).run()
  setResponseStatus(event, 204)
  return null
})
