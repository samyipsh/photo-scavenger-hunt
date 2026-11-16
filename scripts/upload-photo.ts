// Uploads one photo the way a phone does: start (checks, and two signed links), the two files
// straight to storage, then finish. For scripts that fill the app with photos.

export interface PhotoUpload {
  base: string
  token: string
  id: string
  thumb: Buffer
  large: Buffer
  deviceId: string
  details?: { challengeId?: string | null, label?: string | null, hash?: string | null, width?: number, height?: number, by?: string | null }
}

interface Target { url: string, headers: Record<string, string> }

export async function uploadPhoto({ base, token, id, thumb, large, deviceId, details = {} }: PhotoUpload): Promise<void> {
  const photo = `${base}/api/g/${token}/photos/${id}`
  const headers = { 'origin': base, 'content-type': 'application/json', 'x-device-id': deviceId }
  const ask = async (step: string, body: unknown) => {
    const res = await fetch(`${photo}/${step}`, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`${step} ${id}: ${res.status} ${await res.text()}`)
    return res.json() as Promise<{ status: string, thumb?: Target, large?: Target }>
  }
  const send = async (target: Target, body: Buffer) => {
    // Links from `nuxt dev` are relative to the app; R2's are full URLs.
    const res = await fetch(new URL(target.url, base), { method: 'PUT', headers: target.headers, body: new Uint8Array(body) })
    if (!res.ok) throw new Error(`send ${id}: ${res.status} ${await res.text()}`)
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const start = await ask('start', { ...details, thumbBytes: thumb.length, largeBytes: large.length })
      if (start.status === 'saved') return
      await send(start.thumb!, thumb)
      await send(start.large!, large)
      await ask('finish', details)
      return
    }
    catch (err) {
      if (attempt >= 3) throw err
    }
  }
}
