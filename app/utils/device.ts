// A random ID for this phone, kept in the browser. Uploads send it so the committee can stop
// one phone without blocking its whole group. Private windows get a fresh one each visit.
let fallback: string | undefined

export function deviceId(): string {
  try {
    let id = localStorage.getItem('pq-device')
    if (!id) {
      id = crypto.randomUUID()
      localStorage.setItem('pq-device', id)
    }
    return id
  }
  catch {
    fallback ??= crypto.randomUUID()
    return fallback
  }
}
