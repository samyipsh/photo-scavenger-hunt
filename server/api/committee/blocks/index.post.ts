import { blockedDevices } from '../../../db/schema'

// Blocks a phone again, for undoing an Unblock tapped by mistake.
export default defineEventHandler(async (event) => {
  await requireCommittee(event)
  const body = await readBody<{ deviceId?: string, groupId?: string }>(event)
  if (!body.deviceId || !UUID_PATTERN.test(body.deviceId) || !body.groupId) {
    throw createError({ statusCode: 400, statusMessage: 'Which phone?' })
  }
  await useDb(event).insert(blockedDevices).values({ deviceId: body.deviceId, groupId: body.groupId, blockedAt: Date.now() }).onConflictDoNothing().run()
  return { ok: true }
})
