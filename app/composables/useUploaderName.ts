// The name a phone's photos are credited to. Asked once, the first time the phone uploads,
// and kept on the phone. Skipping is fine: photos then go up without a name.
const NAME_KEY = 'pq-name'
const ASKED_KEY = 'pq-name-asked'

function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  }
  catch {
    return null
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  }
  catch {}
}

// For the upload queue, which reads the name at the moment each photo is sent.
export function uploaderName(): string | null {
  return read(NAME_KEY)
}

export function useUploaderName() {
  const name = useState<string | null>('uploader-name', () => read(NAME_KEY))
  const asked = useState<boolean>('uploader-name-asked', () => read(ASKED_KEY) === '1' || !!read(NAME_KEY))
  // Whether the name dialog is open; the menu and the first upload both open it.
  const editing = useState<boolean>('uploader-name-editing', () => false)

  function save(value: string | null) {
    const clean = cleanName(value)
    write(NAME_KEY, clean)
    write(ASKED_KEY, '1')
    name.value = clean
    asked.value = true
    editing.value = false
  }

  return { name, asked, editing, save }
}
