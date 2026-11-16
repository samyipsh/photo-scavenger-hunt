import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { blockedDevices } from '../db/schema'
import { deviceCode } from '#shared/utils/device'


// The phone's random ID, sent with every upload. Missing or malformed means unknown.
export function readDeviceId(event: H3Event): string | null {
  const value = getHeader(event, 'x-device-id') ?? ''
  return UUID_PATTERN.test(value) ? value : null
}

export async function isDeviceBlocked(db: Db, deviceId: string | null) {
  if (!deviceId) return false
  return !!(await db.select({ id: blockedDevices.deviceId }).from(blockedDevices).where(eq(blockedDevices.deviceId, deviceId)).get())
}

export async function assertDeviceAllowed(db: Db, deviceId: string | null) {
  if (deviceId && await isDeviceBlocked(db, deviceId)) {
    throw createError({ statusCode: 403, statusMessage: `This phone can't send photos. Show a committee member this code: ${deviceCode(deviceId)}`, data: { code: 'phone-blocked' } })
  }
}

// Only the phone that sent a photo can move it, take it down or use it for a challenge.
export function assertSentBy(photo: { deviceId: string | null }, deviceId: string | null) {
  if (!deviceId || photo.deviceId !== deviceId) {
    throw createError({ statusCode: 403, statusMessage: 'Only the phone that sent this photo can change it' })
  }
}
