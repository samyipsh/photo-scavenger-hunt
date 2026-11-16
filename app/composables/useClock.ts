import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { DEMO_CLOCK, UTC_OFFSET } from '~~/data/event'
import { EVENT_DATE, eventTime } from '#shared/utils/rotation'

// A ticking clock for countdowns. `?at=2026-11-14T10:10` on any page pretends it's that time
// at the event, for previews and screenshots before the day. In demo mode, without `?at=`, it's
// the event day at DEMO_CLOCK when the page loaded (data/event.ts), so every visit lands mid-morning.
export function useClock(tickMs = 1000) {
  const route = useRoute()
  const demo = useDemo()
  const at = typeof route.query.at === 'string' ? Date.parse(`${route.query.at}${route.query.at.length <= 16 ? ':00' : ''}${UTC_OFFSET}`) : Number.NaN
  const offset = Number.isFinite(at) ? at - Date.now() : null
  const read = () => offset !== null
    ? Date.now() + offset
    : demo.value?.demo ? eventTime(EVENT_DATE, DEMO_CLOCK) + performance.now() : Date.now()
  const now = ref(read())
  // The demo's answer comes after the page has started.
  watch(demo, () => { now.value = read() })
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    timer = setInterval(() => { now.value = read() }, tickMs)
  })
  onBeforeUnmount(() => timer && clearInterval(timer))
  return now
}
