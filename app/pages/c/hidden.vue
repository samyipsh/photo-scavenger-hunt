<script setup lang="ts">
import type { GalleryPhoto, HiddenList } from '~/types/api'
import { EVENT, PHOTO_TIMES } from '~~/data/event'
import { computed, onBeforeUnmount, onMounted, ref, watch, watchEffect } from 'vue'
import { useElementSize } from '@vueuse/core'
import { ChevronLeftIcon, Loader2Icon, RefreshCwIcon, WifiOffIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { BULK_TOAST, photosOf, sayBulk, stillHidden, unfinished } from '~/composables/useCommitteeBatch'
import { photoName } from '~/utils/photoName'

// The committee's Hidden photos, like an iPhone's Hidden album: photos out of the gallery with
// their files kept, from Hide in the gallery's Select or the judge's ⋯ menu, the latest hidden
// first. Nothing empties it by itself. They're never in the gallery, so nobody picking photos
// there can tick one. Select ticks them to unhide or delete for good, and a photo opened here has
// the same two buttons under it.
await useCommitteeGuard()
useHead({ title: `Hidden photos · ${EVENT.appName}` })

type Meta = Pick<HiddenList, 'groups' | 'challenges' | 'photoTimes'>
const photos = ref<GalleryPhoto[]>([])
const meta = ref<Meta | null>(null)
const state = ref<'loading' | 'loaded' | 'failed'>('loading')
// A look after the list loaded didn't get through: the photos stay, with a line saying so.
const stale = ref(false)
const loadError = ref<unknown>(null)
useSignInAgain(loadError)

// Photos a Delete for good didn't finish (no answer, or storage failed after they were marked):
// they stay here, ticked, whatever a look says, until a Delete for good on them goes through. The
// server finishes the files of photos already marked.
const held = new Map<string, GalleryPhoto>()

// On opening, every 30 s while no photo is open and nothing is being ticked (a photo another member
// hides would push the grid down under a finger), when the photo view closes, and after each
// change made here. Each look makes any earlier one still on its way count for nothing. Ticks on photos another committee member
// unhid or deleted meanwhile go.
let run = 0
async function load() {
  const mine = ++run
  try {
    const list = await $fetch<HiddenList>('/api/committee/photos/hidden', { timeout: 15_000, headers: { 'x-device-id': deviceId() } })
    if (mine !== run) return
    const { photos: listed, ...rest } = list
    meta.value = rest
    const here = new Set(listed.map(p => p.id))
    // Held ones first: they're the ones still to finish.
    photos.value = [...[...held.values()].filter(p => !here.has(p.id)), ...listed.map(p => ({ ...p, liked: false, mine: false }))]
    state.value = 'loaded'
    stale.value = false
    const now = new Set(photos.value.map(p => p.id))
    for (const id of ticked.value) if (!now.has(id)) ticked.value.delete(id)
  }
  catch (err) {
    if (mine !== run) return
    loadError.value = err
    if (state.value === 'loaded') stale.value = true
    else state.value = 'failed'
  }
}
onMounted(load)
useVisibleInterval(() => {
  if (viewIndex.value === null && !picking.value) load()
}, 30_000)

const groupName = (id: string) => meta.value?.groups.find(g => g.id === id)?.name ?? ''
// "G3", as in the judge's queue, so "G3 · Squirrel" fits a tile's line.
const shortGroup = (id: string) => groupName(id).replace(/^Group (\d+).*/, 'G$1')
// "Swan", "Monitor lizard" (an animal for the race), "White flower", or "Just a photo".
const what = (p: GalleryPhoto) => photoName(p.challengeId ? meta.value?.challenges.find(x => x.id === p.challengeId) : null, p.label)

// ---------- Picking ----------
// Select, or holding a photo, turns taps into ticks, as in the gallery. Android's Back, or
// Cancel, ends picking.
const picking = ref(false)
const ticked = ref(new Set<string>())
const isTicked = (id: string) => ticked.value.has(id)
function toggle(id: string) {
  if (batch.busy.value) return
  if (ticked.value.has(id)) ticked.value.delete(id)
  else ticked.value.add(id)
}
const allTicked = computed(() => photos.value.length > 0 && photos.value.every(p => ticked.value.has(p.id)))
function selectAll() {
  if (allTicked.value) ticked.value.clear()
  else for (const p of photos.value) ticked.value.add(p.id)
}
function stopPicking() {
  picking.value = false
  ticked.value.clear()
}
useBackClose(picking, stopPicking)
// The finger that held a photo lifts over whatever is under it then: a button that appears under
// it in that moment ignores the tap.
let heldAt = 0
let lift: AbortController | null = null
function hold(p: GalleryPhoto) {
  if (batch.busy.value) return
  picking.value = true
  toggle(p.id)
  lift?.abort()
  const ctrl = new AbortController()
  lift = ctrl
  heldAt = Number.POSITIVE_INFINITY
  const done = () => {
    heldAt = Date.now()
    ctrl.abort()
  }
  window.addEventListener('pointerup', done, { signal: ctrl.signal })
  window.addEventListener('pointercancel', done, { signal: ctrl.signal })
  // Should the lift never reach the page, the guard ends anyway.
  setTimeout(() => !ctrl.signal.aborted && done(), 5000)
}
const justHeld = () => Date.now() - heldAt < 800
onBeforeUnmount(() => lift?.abort())

// ---------- The photo view ----------
const viewPhotos = ref<GalleryPhoto[]>([])
const viewIndex = ref<number | null>(null)
function open(p: GalleryPhoto) {
  // A toast would sit over the photo view's buttons.
  toast.dismiss(BULK_TOAST)
  viewPhotos.value = [...photos.value]
  viewIndex.value = viewPhotos.value.indexOf(p)
}
function tap(p: GalleryPhoto) {
  if (picking.value) toggle(p.id)
  else open(p)
}
// Changes made in the photo view show at once; an ended session goes to sign-in.
watch(viewIndex, (i) => {
  if (i === null) load()
})
function onRemoved(id: string) {
  held.delete(id)
  ticked.value.delete(id)
  photos.value = photos.value.filter(p => p.id !== id)
  viewPhotos.value = viewPhotos.value.filter(p => p.id !== id)
}
// A Delete for good from the photo view, held from when it's sent, as the bar's are, until the
// photo leaves the list (onRemoved).
function holdPurge(id: string) {
  const p = photos.value.find(x => x.id === id)
  if (p) held.set(id, p)
}

// ---------- Unhide and Delete for good, on what's ticked ----------
// Unhide puts them back in the gallery, with Undo for 8 s, as Hide has; Delete for good deletes
// their files, after asking. What went, or had already gone, leaves the ticks and the list; what
// didn't stays ticked. A toast always says what happened, with the reason for any that didn't go.
const batch = useCommitteeBatch()
const confirmPurge = ref(false)
useBackClose(confirmPurge)
const bar = ref<HTMLElement | null>(null)
const { height: barHeight } = useElementSize(bar, undefined, { box: 'border-box' })
// Toasts sit above the bar while it's up, so one saying "try again" doesn't cover the buttons.
const toastLift = useState<number>('toast-lift', () => 0)
watchEffect(() => {
  toastLift.value = picking.value ? Math.round(barHeight.value) + 8 : 0
})
onBeforeUnmount(() => {
  toastLift.value = 0
})
function drop(ids: Iterable<string>) {
  const gone = new Set(ids)
  for (const id of gone) {
    ticked.value.delete(id)
    held.delete(id)
  }
  photos.value = photos.value.filter(p => !gone.has(p.id))
  if (!ticked.value.size) stopPicking()
}
function unhideTicked() {
  if (batch.busy.value || justHeld()) return
  const ids = [...ticked.value]
  return batch.inTurn('restore', async () => {
    const r = await batch.send('restore', ids)
    if (r.out) return
    // A photo with a copy in the gallery stays ticked; one deleted for good meanwhile goes.
    drop([...r.done, ...r.refused.filter(x => x.reason !== 'copy-in-gallery').map(x => x.id)])
    load()
    const back = r.done.length ? `${photosOf(r.done.length)} back in the gallery` : ''
    const undo = r.done.length ? () => hideAgain(r.done) : undefined
    if (r.failed) sayBulk(unfinished(r.done.length, ids.length, 'back in the gallery', r.why), undo)
    else sayBulk([back, stillHidden(r.refused)].filter(Boolean).join('. '), undo)
  })
}
// Unhide's Undo: hides again what that Unhide put back. They come back here with the next look.
function hideAgain(ids: string[]) {
  return batch.inTurn('remove', async () => {
    const r = await batch.send('remove', ids)
    if (r.out) return
    load()
    if (r.failed) sayBulk(`${r.done.length ? `${r.done.length} of ${ids.length} hidden again.` : 'Couldn\'t undo.'} ${r.why}`)
  })
}
function askPurge() {
  if (batch.busy.value || justHeld()) return
  confirmPurge.value = true
}
function purgeTicked() {
  confirmPurge.value = false
  const ids = [...ticked.value]
  const before = photos.value.filter(p => ticked.value.has(p.id))
  return batch.inTurn('delete', async () => {
    // Held here, ticked, while the run is out: a look that lands after the server marked them
    // mustn't drop them before the outcome is known.
    for (const p of before) held.set(p.id, p)
    const r = await batch.send('delete', ids)
    // Then only those that got no answer stay held, to try again.
    const unsure = new Set(r.unsure)
    for (const p of before) if (!unsure.has(p.id)) held.delete(p.id)
    if (r.out) return
    // One unhidden meanwhile is back in the gallery: it leaves here too.
    const back = r.refused.filter(x => x.reason === 'in-gallery').length
    drop([...r.done, ...r.refused.map(x => x.id)])
    load()
    if (r.failed) sayBulk(unfinished(r.done.length, ids.length, 'deleted for good', r.why))
    else if (r.done.length) sayBulk(`${photosOf(r.done.length)} deleted for good`)
    else if (back) sayBulk(back === 1 ? 'Already back in the gallery' : `${back} already back in the gallery`)
    else sayBulk('Already deleted for good')
  })
}
</script>

<template>
  <main class="mx-auto min-h-dvh max-w-lg px-4 pt-2" :class="!picking && 'pb-[max(1.5rem,env(safe-area-inset-bottom))]'" :style="picking ? { paddingBottom: `${barHeight + 16}px` } : undefined">
    <!-- As the gallery's: while picking, how many are ticked, with Select all and Cancel; the back
         arrow gives way to Cancel. As tall as its buttons even when there are none, so nothing
         jumps. -->
    <div class="flex min-h-11 items-center gap-2">
      <Button v-if="!picking" as-child variant="ghost" size="icon" class="-ml-4 shrink-0">
        <NuxtLink to="/c" aria-label="Back">
          <ChevronLeftIcon class="size-6 -translate-x-0.5" />
        </NuxtLink>
      </Button>
      <h1 class="min-w-0 flex-1 truncate text-2xl font-bold leading-tight" aria-live="polite">
        {{ !picking ? 'Hidden photos' : ticked.size ? `${ticked.size} selected` : 'Select photos' }}
      </h1>
      <div class="-mr-2.5 flex shrink-0">
        <Button v-if="picking" variant="ghost" class="px-2.5 text-base" :disabled="!photos.length || !!batch.busy.value" @click="selectAll">
          {{ allTicked ? 'Deselect all' : 'Select all' }}
        </Button>
        <Button v-if="photos.length || picking" variant="ghost" class="px-2.5 text-base" :disabled="!!batch.busy.value" @click="picking ? stopPicking() : (picking = true)">
          {{ picking ? 'Cancel' : 'Select' }}
        </Button>
      </div>
    </div>

    <!-- A look that didn't get through: the photos stay, and say so. -->
    <div v-if="stale" class="mt-3 flex items-center gap-2 text-base" role="status">
      <WifiOffIcon class="size-5 shrink-0 text-warning" aria-hidden="true" />
      <span class="min-w-0 flex-1">No signal · showing earlier photos</span>
      <Button variant="ghost" size="icon" class="-mr-2.5 shrink-0" aria-label="Try again" @click="load()">
        <RefreshCwIcon class="size-5" />
      </Button>
    </div>

    <p v-if="state === 'failed'" class="mt-6 text-center text-base">
      Photos couldn't load. <button type="button" class="inline-flex min-h-11 items-center font-semibold underline" @click="state = 'loading'; load()">Try again</button>
    </p>
    <div v-else-if="state === 'loading'" class="mt-3 grid grid-cols-3 gap-1" aria-busy="true">
      <Skeleton v-for="n in 12" :key="n" class="aspect-square w-full rounded-md" />
    </div>
    <p v-else-if="!photos.length" class="mt-10 text-center text-base text-muted-foreground">
      Nothing hidden.
    </p>
    <!-- Each captioned "G3 · Squirrel", a little apart so one doesn't run into the next. No hearts:
         these aren't in the gallery. -->
    <ul v-else class="mt-3 grid grid-cols-3 gap-x-2 gap-y-3">
      <GalleryTile
        v-for="p in photos" :key="p.id" :photo="p" :name="`${groupName(p.groupId)}, ${what(p)}`" :caption="`${shortGroup(p.groupId)} · ${what(p)}`" words no-like
        :picking="picking" :picked="isTicked(p.id)" @open="tap(p)" @hold="hold(p)" @expand="open(p)"
      />
    </ul>

    <!-- Picking: Unhide a third of the row, no wider than on a 412 px phone, as in the photo
         editor, and Delete for good the rest, outlined in red, as weighty as Unhide: it asks
         first. While one runs, its spinner takes its label's place. -->
    <div v-if="picking" ref="bar" class="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-4px_12px_rgb(0_0_0/0.06)]">
      <div class="mx-auto max-w-lg px-4">
        <div v-if="ticked.size" class="grid grid-cols-[min(calc((100%-0.75rem)/3),123px)_1fr] gap-3">
          <Button size="lg" variant="outline" class="px-3" :disabled="!!batch.busy.value" :aria-busy="batch.busy.value === 'restore'" @click="unhideTicked">
            <Loader2Icon v-if="batch.busy.value === 'restore'" class="animate-spin" aria-hidden="true" />
            <span :class="batch.busy.value === 'restore' && 'sr-only'">Unhide</span>
          </Button>
          <Button size="lg" variant="outline" class="border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive" :disabled="!!batch.busy.value" :aria-busy="batch.busy.value === 'delete'" @click="askPurge">
            <Loader2Icon v-if="batch.busy.value === 'delete'" class="animate-spin" aria-hidden="true" />
            <span :class="batch.busy.value === 'delete' && 'sr-only'">Delete for good</span>
          </Button>
        </div>
        <Button v-else size="lg" class="w-full" disabled>
          Tap photos to select
        </Button>
      </div>
    </div>

    <!-- Delete for good: asks first, as deleting one photo for good does. -->
    <Dialog v-model:open="confirmPurge">
      <DialogContent class="w-[calc(100vw-2rem)] max-w-md" :show-close-button="false">
        <DialogTitle>Delete {{ photosOf(ticked.size) }} for good?</DialogTitle>
        <DialogDescription>It can't be undone.</DialogDescription>
        <div class="grid grid-cols-2 gap-2">
          <Button variant="outline" @click="confirmPurge = false">
            {{ ticked.size === 1 ? 'Keep it' : 'Keep them' }}
          </Button>
          <Button variant="destructive" @click="purgeTicked">
            Delete
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    <PhotoViewer
      v-model:index="viewIndex" :photos="viewPhotos" :groups="meta?.groups ?? []" :challenges="meta?.challenges ?? []" :time-style="meta?.photoTimes ?? PHOTO_TIMES" hidden
      :ticked="picking ? isTicked : undefined" :tick-locked="!!batch.busy.value"
      @removed="onRemoved" @tick="toggle" @purging="holdPurge"
    />
  </main>
</template>
