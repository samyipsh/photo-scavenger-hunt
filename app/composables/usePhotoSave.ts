import { computed, reactive, ref } from 'vue'

// Saving gallery photos to the phone, straight from storage by their signed view links (the
// Worker never carries the bytes). docs/ux/saving-photos.md has the research behind it.
// - iPhone and iPad (browsers that can share files): the share sheet ("Save 30 Images" puts
//   them in Photos; a download there would land in Files). The sheet needs every photo in
//   memory, and each sheet needs its own tap, so it takes them 30 at a time in the order they
//   were ticked; each save unticks what it shared. The next 30 download as they're ticked, so
//   the sheet usually opens on the tap; if the wait used up the tap, the button says "Ready"
//   and the next tap shares the files already in hand.
// - Elsewhere (Android, computers): one tap downloads every ticked photo as a file, three
//   workers each downloading one and handing it to the browser before taking the next, so only
//   a few wait in memory. Chrome may ask to allow several downloads, and remembers a Block
//   without telling the page, so the ticks stay until Done.
// Downloads run three at a time. 30 s without a byte stops that photo and, for a save, every
// photo of it still missing, so a dead connection ends the save. What arrived is saved; failed
// photos stay ticked and move to the back. R2 refuses a deleted photo without CORS headers, so
// the page can't tell it from no signal: `recheck` asks the app.
// A save holds the ticks until it has fully finished; Cancel (`clear`) stops everything.
export const SAVE_BATCH = 30
const PARALLEL = 3
const STALL_MS = 30_000

const apple = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
const canShareFiles = () => {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [new File([''], 'test.jpg', { type: 'image/jpeg' })] })
  }
  catch {
    return false
  }
}
const stalled = () => new DOMException('No data for 30 s', 'TimeoutError')
const isStall = (e: unknown) => (e as Error | undefined)?.name === 'TimeoutError'
const pause = (ms: number) => new Promise(r => setTimeout(r, ms))
// A photo whose own download failed (not stopped by a stall or Cancel) is worth asking the app
// about: a deleted one fails fast, it never stalls.
const askable = (e: unknown) => !isStall(e) && (e as Error | undefined)?.name !== 'AbortError'
interface Lost { p: SavePick, ask: boolean }

export interface SavePick { id: string, url: string, name: string }
// A failed photo's fresh link, null if it's gone, undefined if the app couldn't be asked.
type Recheck = (id: string, signal: AbortSignal) => Promise<string | null | undefined>
interface Job { promise: Promise<File>, ctrl: AbortController }

// `onGone`: photos found deleted during a save, so the page can drop their tiles.
export function usePhotoSave(recheck: Recheck, onGone?: (ids: string[]) => void) {
  const picked = reactive(new Map<string, SavePick>())
  const jobs = new Map<string, Job>()
  // getting: a save is running and holds the ticks. ready: the files are in hand, one more tap
  // shares them. started: downloads went to the browser; the ticks stay until Done.
  const state = ref<'idle' | 'getting' | 'ready' | 'started'>('idle')
  const got = ref(0)
  const of = ref(0)
  // What the last save couldn't do.
  const failed = ref(0)
  const gone = ref(0)
  const refused = ref(false)
  const readyCount = ref(0)
  // How the last save ended: saved everything it tried, or not.
  const outcome = ref<'saved' | 'unsaved'>('unsaved')
  const batch = computed(() => import.meta.client && apple() && canShareFiles() ? SAVE_BATCH : Number.POSITIVE_INFINITY)
  const sharing = computed(() => Number.isFinite(batch.value))
  let ready: { ids: string[], files: File[] } | null = null
  // Bumped by Cancel: a save in progress stops, and opens or downloads nothing afterwards.
  let run = 0
  let asking: AbortController | null = null

  // At most three downloads at once, the rest waiting their turn.
  let active = 0
  const waiting: (() => void)[] = []
  const slot = () => new Promise<void>((resolve) => {
    if (active < PARALLEL) {
      active++
      resolve()
    }
    else {
      waiting.push(() => {
        active++
        resolve()
      })
    }
  })
  const release = () => {
    active--
    waiting.shift()?.()
  }

  // `no-store`, so a copy the gallery's <img> cached without CORS headers isn't reused.
  async function download(p: SavePick, ctrl: AbortController) {
    await slot()
    let timer: ReturnType<typeof setTimeout> | undefined
    let timedOut = false
    const poke = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        timedOut = true
        ctrl.abort(stalled())
      }, STALL_MS)
    }
    try {
      if (ctrl.signal.aborted) throw new DOMException('Stopped', 'AbortError')
      poke()
      const r = await fetch(p.url, { cache: 'no-store', signal: ctrl.signal })
      if (!r.ok) throw new Error(String(r.status))
      const parts: BlobPart[] = []
      if (r.body) {
        const reader = r.body.getReader()
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          parts.push(value)
          poke()
        }
      }
      else {
        parts.push(await r.blob())
      }
      return new File(parts, p.name, { type: r.headers.get('content-type') || 'image/jpeg' })
    }
    catch (e) {
      // Older browsers reject with a plain AbortError whatever the reason.
      throw timedOut ? stalled() : e
    }
    finally {
      clearTimeout(timer)
      release()
    }
  }
  function fileFor(p: SavePick) {
    const had = jobs.get(p.id)
    if (had) return had.promise
    const ctrl = new AbortController()
    const promise = download(p, ctrl)
    jobs.set(p.id, { promise, ctrl })
    // A failed download is tried again on the next save.
    promise.catch(() => forgetJob(p.id, promise))
    return promise
  }
  // Only the job that's still the current one for that photo, not a newer download of it.
  function forgetJob(id: string, promise: Promise<File>) {
    if (jobs.get(id)?.promise === promise) jobs.delete(id)
  }
  function stopJob(id: string) {
    jobs.get(id)?.ctrl.abort()
    jobs.delete(id)
  }
  // While picking for the share sheet, the next batch downloads ahead; no more, so a big
  // selection doesn't fill the phone's memory.
  function prefetch() {
    if (!sharing.value) return
    for (const p of [...picked.values()].slice(0, batch.value)) fileFor(p).catch(() => {})
  }
  function changed() {
    ready = null
    refused.value = false
    if (state.value === 'ready' || state.value === 'started') state.value = 'idle'
  }
  // Names stay unique within the ticks: "G3-Swan-0952-Ethan-2.jpg". `used` is built once per
  // change, so Select all on hundreds stays quick.
  const usedNames = () => new Set([...picked.values()].map(q => q.name))
  function unique(p: SavePick, used: Set<string>) {
    let name = p.name
    if (used.has(name)) {
      const stem = p.name.replace(/\.jpg$/, '')
      let n = 2
      while (used.has(`${stem}-${n}.jpg`)) n++
      name = `${stem}-${n}.jpg`
    }
    used.add(name)
    return name === p.name ? p : { ...p, name }
  }

  const isPicked = (id: string) => picked.has(id)
  const locked = computed(() => state.value === 'getting')
  function toggle(p: SavePick) {
    if (locked.value) return
    changed()
    if (picked.has(p.id)) {
      picked.delete(p.id)
      stopJob(p.id)
    }
    else {
      picked.set(p.id, unique(p, usedNames()))
    }
    prefetch()
  }
  function add(list: SavePick[]) {
    if (locked.value) return
    changed()
    const used = usedNames()
    for (const p of list) {
      if (!picked.has(p.id)) picked.set(p.id, unique(p, used))
    }
    prefetch()
  }
  function remove(ids: string[]) {
    if (locked.value) return
    changed()
    for (const id of ids) {
      picked.delete(id)
      stopJob(id)
    }
    prefetch()
  }
  // A photo removed from the gallery (its sender deleted it in the photo view): drop it even
  // mid-save, and from a batch that's ready to share.
  function forget(id: string) {
    picked.delete(id)
    stopJob(id)
    if (ready?.ids.includes(id)) {
      ready = null
      if (state.value === 'ready') state.value = 'idle'
    }
  }
  function clear() {
    run++
    for (const id of [...jobs.keys()]) stopJob(id)
    asking?.abort()
    picked.clear()
    ready = null
    failed.value = 0
    gone.value = 0
    refused.value = false
    state.value = 'idle'
  }

  // The batch's photos, three at a time; the first stall stops the ones still missing.
  async function gather(list: SavePick[], mine: number) {
    const arrived = new Set<string>()
    let stop = false
    const results = await Promise.allSettled(list.map(p => fileFor(p).then((f) => {
      arrived.add(p.id)
      if (mine === run) got.value++
      return f
    }, (e) => {
      // Done with, if not downloaded: the progress counts it, so nothing reads as still coming.
      if (mine === run) got.value++
      if (isStall(e) && !stop) {
        stop = true
        for (const q of list) {
          if (!arrived.has(q.id)) jobs.get(q.id)?.ctrl.abort()
        }
      }
      throw e
    })))
    const files: { id: string, f: File }[] = []
    const lost: Lost[] = []
    list.forEach((p, i) => {
      const r = results[i]!
      // A photo removed meanwhile isn't shared.
      if (!picked.has(p.id)) return
      if (r.status === 'fulfilled') files.push({ id: p.id, f: r.value })
      else lost.push({ p, ask: askable(r.reason) })
    })
    return { files, lost }
  }

  // Three workers, each downloading a photo and handing it to the browser before taking the
  // next, a third of a second apart (browsers drop downloads started in a burst).
  async function handOff(list: SavePick[], mine: number) {
    let next = 0
    const handed: string[] = []
    let stop = false
    const lost: Lost[] = []
    let turn = Promise.resolve()
    async function worker() {
      while (next < list.length) {
        const p = list[next++]!
        if (mine !== run) return
        // A photo removed meanwhile isn't downloaded.
        if (!picked.has(p.id)) continue
        if (stop) {
          lost.push({ p, ask: false })
          continue
        }
        const promise = fileFor(p)
        try {
          const f = await promise
          if (mine !== run) return
          let clicked = false
          const mineTurn = turn.then(async () => {
            if (mine !== run || !picked.has(p.id)) return
            const a = document.createElement('a')
            a.href = URL.createObjectURL(f)
            a.download = f.name
            a.click()
            clicked = true
            setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
            await pause(300)
          })
          turn = mineTurn
          await mineTurn
          if (mine !== run) return
          if (clicked) handed.push(p.id)
          forgetJob(p.id, promise)
        }
        catch (e) {
          if (mine !== run) return
          // Removed meanwhile (its download was stopped): not a failure.
          if (!picked.has(p.id)) continue
          if (isStall(e) && !stop) {
            stop = true
            for (const q of list) {
              if (q.id !== p.id) jobs.get(q.id)?.ctrl.abort()
            }
          }
          lost.push({ p, ask: askable(e) })
        }
        got.value++
      }
    }
    await Promise.all(Array.from({ length: Math.min(PARALLEL, list.length) }, worker))
    return { handed, lost }
  }

  // Failed photos stay ticked and go to the back, so they can't hold up the next batch. Ones
  // whose own download failed are asked about, three at a time: gone ones are unticked, the
  // rest get a fresh link. The asking stops once the app can't be reached, or after three in a
  // row are still there (the signal, not deletions, is the problem).
  async function settle(list: Lost[], mine: number) {
    const ctrl = new AbortController()
    asking = ctrl
    const answers = new Map<string, string | null | undefined>()
    const ask = list.filter(l => l.ask).map(l => l.p)
    let stop = false
    let still = 0
    let next = 0
    await Promise.all(Array.from({ length: Math.min(PARALLEL, ask.length) }, async () => {
      while (next < ask.length) {
        const p = ask[next++]!
        if (stop || mine !== run) continue
        const a = await recheck(p.id, ctrl.signal)
        answers.set(p.id, a)
        still = typeof a === 'string' ? still + 1 : 0
        if (a === undefined || still >= 3) {
          stop = true
          ctrl.abort()
        }
      }
    }))
    if (mine !== run) return
    const goneIds: string[] = []
    for (const { p } of list) {
      if (!picked.has(p.id)) continue
      const a = answers.get(p.id)
      picked.delete(p.id)
      jobs.delete(p.id)
      if (a === null) {
        gone.value++
        goneIds.push(p.id)
        continue
      }
      failed.value++
      picked.set(p.id, a ? { ...p, url: a } : p)
    }
    if (goneIds.length) onGone?.(goneIds)
  }

  // How the share sheet went: shared, closed, the wait used up the tap, or refused.
  async function share(files: File[], waited: boolean) {
    try {
      await navigator.share({ files })
      return 'shared'
    }
    catch (e) {
      const name = (e as Error).name
      if (name === 'AbortError') return 'closed'
      return name === 'NotAllowedError' && waited ? 'ready' : 'refused'
    }
  }

  async function save(done: () => void) {
    if (!picked.size || state.value === 'getting') return
    const mine = run
    const wasReady = state.value === 'ready' ? ready : null
    failed.value = 0
    gone.value = 0
    refused.value = false
    state.value = 'getting'
    let saved = 0
    let next: 'idle' | 'ready' | 'started' = 'idle'
    let lost: Lost[] = []
    let batchIds: string[] = []
    let files: File[] = []
    let waited = false
    if (wasReady) {
      // The files are already in hand: share them on this tap, with nothing to wait for.
      batchIds = wasReady.ids.filter(id => picked.has(id))
      files = wasReady.files.filter((_, i) => picked.has(wasReady.ids[i]!))
      got.value = files.length
      of.value = files.length
    }
    else if (sharing.value) {
      const list = [...picked.values()].slice(0, batch.value)
      got.value = 0
      of.value = list.length
      const start = performance.now()
      const g = await gather(list, mine)
      if (mine !== run) return
      waited = performance.now() - start > 1000
      batchIds = g.files.map(x => x.id)
      files = g.files.map(x => x.f)
      lost = g.lost
    }
    else {
      const list = [...picked.values()]
      got.value = 0
      of.value = list.length
      const h = await handOff(list, mine)
      if (mine !== run) return
      saved = h.handed.length
      lost = h.lost
      // All went: the ticks stay, in case the browser blocked some without saying. Some failed:
      // untick the ones handed over, so saving again fetches just the failed ones.
      if (lost.length) {
        for (const id of h.handed) picked.delete(id)
      }
      else if (saved) {
        next = 'started'
      }
    }
    ready = null
    if (files.length) {
      const how = await share(files, waited)
      if (mine !== run) return
      if (how === 'shared') {
        saved = files.length
        for (const id of batchIds) {
          picked.delete(id)
          jobs.delete(id)
        }
      }
      else if (how === 'ready') {
        ready = { ids: batchIds, files }
        readyCount.value = files.length
        next = 'ready'
      }
      else if (how === 'refused') {
        refused.value = true
      }
    }
    if (lost.length) await settle(lost, mine)
    if (mine !== run) return
    outcome.value = saved && !lost.length && next !== 'ready' && !refused.value ? 'saved' : 'unsaved'
    state.value = next
    // Close only after a save that went without a hitch; otherwise the note says what happened.
    if (!picked.size && saved && !failed.value && !gone.value) done()
    else prefetch()
  }

  const count = computed(() => picked.size)
  // The ticked photos' IDs, in the order they were ticked.
  const ids = () => [...picked.keys()]
  return { count, state, got, of, failed, gone, refused, readyCount, outcome, batch, sharing, locked, isPicked, ids, toggle, add, remove, forget, clear, save }
}
