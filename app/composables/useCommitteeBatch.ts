import type { BatchAnswer } from '~/types/api'
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { COMMITTEE_BATCH } from '#shared/utils/photos'

// The committee's actions on many ticked photos at once, through POST /api/committee/photos/batch:
// Hide in the gallery's Select (`remove`, with Undo), and Unhide (`restore`) and Delete for good
// (`delete`) on the Hidden photos page. COMMITTEE_BATCH go to a request, one request after
// another, and one action at a time (an Undo tapped mid-Hide waits its turn). A session that ended
// goes to sign-in.
export type BatchAction = 'remove' | 'restore' | 'delete'
export type Refused = BatchAnswer['refused']

export function useCommitteeBatch() {
  // The action running now: the ticks hold still and its button shows a spinner.
  const busy = ref<BatchAction | null>(null)
  let queue: Promise<unknown> = Promise.resolve()
  function inTurn(kind: BatchAction, job: () => Promise<void>) {
    const run = queue.then(async () => {
      busy.value = kind
      try {
        await job()
      }
      finally {
        busy.value = null
      }
    })
    queue = run.catch(() => {})
    return run
  }

  const authError = ref<unknown>(null)
  useSignInAgain(authError)
  // `out`: the session ended (sign-in comes next). `why`: the server's reason when it gave one,
  // else the signal. `unsure`: the request that got no answer, which may have gone through; later
  // ones weren't sent.
  async function send(action: BatchAction, ids: string[]) {
    const done: string[] = []
    const refused: Refused = []
    for (let i = 0; i < ids.length; i += COMMITTEE_BATCH) {
      try {
        const answer = await $fetch<BatchAnswer>('/api/committee/photos/batch', { method: 'POST', body: { action, ids: ids.slice(i, i + COMMITTEE_BATCH) }, timeout: 20_000 })
        done.push(...answer.done)
        refused.push(...answer.refused)
      }
      catch (err) {
        const out = (err as { statusCode?: number } | null)?.statusCode === 401
        if (out) authError.value = err
        return { done, refused, failed: true, out, why: errorText(err, SIGNAL), unsure: ids.slice(i, i + COMMITTEE_BATCH) }
      }
    }
    return { done, refused, failed: false, out: false, why: '', unsure: [] as string[] }
  }

  return { busy, inTurn, send }
}

// One toast at a time for these. A new one replaces the last, so each says its Undo, or none,
// outright: a toast with the same id keeps whatever it isn't told.
export const BULK_TOAST = 'committee-bulk'
export const sayBulk = (text: string, undo?: () => void) => toast(text, {
  id: BULK_TOAST,
  duration: undo ? 8000 : undefined,
  action: undo ? { label: 'Undo', onClick: undo } : undefined,
})

export const photosOf = (n: number) => `${n} ${n === 1 ? 'photo' : 'photos'}`
const SIGNAL = 'Check your signal, then try again.'
// A request with no answer may still have gone through: this says neither.
export const unfinished = (n: number, of: number, what: string, why: string) => `${n ? `${n} of ${of} ${what}.` : 'Couldn\'t finish.'} ${why}`
// Why photos didn't come back: a copy in the gallery, or deleted for good meanwhile.
export function stillHidden(refused: Refused) {
  const copies = refused.filter(x => x.reason === 'copy-in-gallery').length
  const gone = refused.length - copies
  return [
    copies ? `${copies} still hidden: a copy is in the gallery` : '',
    gone ? `${gone} ${gone === 1 ? 'was' : 'were'} deleted for good` : '',
  ].filter(Boolean).join('. ')
}
