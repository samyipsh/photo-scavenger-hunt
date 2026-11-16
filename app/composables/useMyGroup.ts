// The group this phone last used, so the home page can offer "Continue as Group 3".
const KEY = 'pq-my-group'

// `id` was added later, so phones that saved their group before then have only the name.
export interface MyGroup { token: string, name: string, id?: string }

export function readMyGroup(): MyGroup | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) as MyGroup : null
  }
  catch {
    return null
  }
}

export function rememberMyGroup(group: MyGroup) {
  try {
    localStorage.setItem(KEY, JSON.stringify(group))
  }
  catch {}
}

// For a link that no longer works (a group the committee removed), so the phone stops offering it.
export function forgetMyGroup(token: string) {
  try {
    if (readMyGroup()?.token === token) localStorage.removeItem(KEY)
  }
  catch {}
}
