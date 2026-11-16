import type { Ref } from 'vue'
import { watch } from 'vue'

// Committee pages need the shared passphrase. If the session is missing or has expired,
// send people to the sign-in page and bring them back afterwards.
export async function useCommitteeGuard() {
  const { loggedIn, fetch } = useUserSession()
  const route = useRoute()
  await fetch()
  if (!loggedIn.value) {
    await navigateTo({ path: '/c', query: { next: route.fullPath } }, { replace: true })
  }
  return { loggedIn }
}

// A refresh refused because the session ended (401, after the 24 hours it lasts): back to
// sign-in, then here again. On the committee's home, which is the sign-in page, the form shows.
export function useSignInAgain(error: Ref<unknown>) {
  const { fetch } = useUserSession()
  const route = useRoute()
  watch(error, async (e) => {
    if ((e as { statusCode?: number } | null)?.statusCode !== 401) return
    await fetch()
    if (route.path !== '/c') await navigateTo({ path: '/c', query: { next: route.fullPath } }, { replace: true })
  })
}

// Turns an API error into a sentence for a toast.
export function errorText(err: unknown, fallback = 'Something went wrong. Check your signal and try again.') {
  const e = err as { data?: { statusMessage?: string }, statusMessage?: string, statusCode?: number }
  if (e?.data?.statusMessage && e.data.statusMessage !== 'Committee sign-in needed') return e.data.statusMessage
  if (e?.statusCode === 401) return 'Your sign-in expired. Sign in again.'
  return e?.statusMessage ?? fallback
}
