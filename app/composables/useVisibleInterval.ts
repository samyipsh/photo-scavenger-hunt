import { onBeforeUnmount, onMounted } from 'vue'

// Runs fn every `ms` while the page is visible, and straight away when it becomes visible again.
// Hidden tabs don't poll, which keeps Cloudflare request counts down.
export function useVisibleInterval(fn: () => unknown, ms: number) {
  let timer: ReturnType<typeof setInterval> | undefined
  const start = () => {
    stop()
    timer = setInterval(() => {
      if (document.visibilityState === 'visible') fn()
    }, ms)
  }
  const stop = () => {
    if (timer) clearInterval(timer)
    timer = undefined
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') fn()
  }
  onMounted(() => {
    start()
    document.addEventListener('visibilitychange', onVisible)
  })
  onBeforeUnmount(() => {
    stop()
    document.removeEventListener('visibilitychange', onVisible)
  })
}
