import type { Ref } from 'vue'
import { ref, watch } from 'vue'

// Nuxt empties a useFetch's data when a refresh fails. A page that refreshes by itself keeps what
// it last showed instead, and says it may be out of date (its `error` is set): losing signal for a
// moment must never turn a page into its error screen. Only a refresh that didn't get through
// keeps it: no answer (no signal, a time-out) or the server failing (5xx). An answer the server
// meant replaces it, so a link that stopped working (404) or a session that ended (401) shows as
// that, not as "No signal".
//   const { data: fresh, error, refresh } = await useFetch(url, { timeout: 10_000 })
//   const data = useLastGood(fresh, error)
// Give the useFetch a timeout shorter than the page's refresh: on a weak signal a request hangs
// rather than fails, and the next refresh would quietly cancel it, never setting `error`.
export function useLastGood<T>(fresh: Ref<T | null | undefined>, error: Ref<unknown>): Ref<T | null> {
  const kept = ref(fresh.value ?? null) as Ref<T | null>
  watch([fresh, error], ([value, failed]) => {
    if (failed && didntGetThrough(failed)) return
    kept.value = value ?? null
  })
  return kept
}

function didntGetThrough(failed: unknown) {
  const status = (failed as { statusCode?: number }).statusCode
  return !status || status >= 500
}
