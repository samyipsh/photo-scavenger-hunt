import { ref } from 'vue'

// Whether the app is the public demo (GET /api/demo; docs/architecture.md, "Demo mode"), asked
// once per visit. Null until the answer comes, and asked again next time if it didn't.
type DemoInfo = { demo: false } | { demo: true, passphrase: string }
const info = ref<DemoInfo | null>(null)
let asking: Promise<void> | null = null

export function useDemo() {
  asking ??= $fetch<DemoInfo>('/api/demo', { timeout: 15_000 }).then((d) => {
    info.value = d
  }, () => {
    asking = null
  })
  return info
}
