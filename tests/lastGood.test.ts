import { describe, expect, it } from 'vitest'
import { nextTick, ref } from 'vue'
import { useLastGood } from '../app/composables/useLastGood'

// What a page shows as its refreshes come and go. Nuxt sets error and empties data in the same
// tick when a refresh fails, and sets data then clears error when one succeeds.
function page<T>(first: T | null = null) {
  const fresh = ref<T | null>(first)
  const error = ref<unknown>(null)
  const kept = useLastGood(fresh, error)
  async function answer(value: T) {
    fresh.value = value
    error.value = null
    await nextTick()
  }
  async function fail(failure: unknown) {
    error.value = failure
    fresh.value = null
    await nextTick()
  }
  return { kept, answer, fail, fresh, error }
}

describe('useLastGood', () => {
  it('starts with what the first load gave, or nothing yet', () => {
    expect(page().kept.value).toBeNull()
    expect(page({ n: 1 }).kept.value).toEqual({ n: 1 })
  })

  it('keeps the last answer when a refresh gets no answer or the server fails', async () => {
    const p = page({ n: 1 })
    await p.fail(new Error('fetch failed'))
    expect(p.kept.value).toEqual({ n: 1 })
    await p.fail({ statusCode: 503 })
    expect(p.kept.value).toEqual({ n: 1 })
  })

  it('takes the next answer once a refresh gets through again', async () => {
    const p = page({ n: 1 })
    await p.fail({ statusCode: 500 })
    await p.answer({ n: 2 })
    expect(p.kept.value).toEqual({ n: 2 })
  })

  it('lets an answer the server meant through: a dead link, a session that ended', async () => {
    const dead = page({ n: 1 })
    await dead.fail({ statusCode: 404 })
    expect(dead.kept.value).toBeNull()
    const signedOut = page({ n: 1 })
    await signedOut.fail({ statusCode: 401 })
    expect(signedOut.kept.value).toBeNull()
  })

  it('empties when the data empties without an error', async () => {
    const p = page({ n: 1 })
    p.fresh.value = null
    await nextTick()
    expect(p.kept.value).toBeNull()
  })
})
