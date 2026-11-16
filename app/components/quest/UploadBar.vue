<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useIntervalFn, useNow, useOnline } from '@vueuse/core'
import { AlertTriangleIcon, CheckCircle2Icon, CheckIcon, ChevronRightIcon, Loader2Icon, WifiOffIcon } from '@lucide/vue'
import { type Draft, fleetingRefusal, type UploadItem } from '~/composables/useUploadQueue'
import type { Notice } from '~/components/quest/UploadNotice.vue'

// The upload strip above the bottom buttons: one flat surface, at most two rows, most urgent
// first. In order: photos that need someone (one row, or "3 photos need you" opening a sheet
// with them all), photos that keep failing, the photo sending now or waiting for signal, a photo
// taken but not sent yet, and a short done line. Every row is laid out the same: the photo (or a
// sign when there's none), the words, then its one button on the right. Only a row with two
// buttons puts them in a row under the words.
const props = defineProps<{
  pending: UploadItem[]
  failed: UploadItem[]
  current?: UploadItem
  titleFor: (item: UploadItem) => string
  doneText?: string
  doneAt?: number
  // The photo the done line is about, kept from when it was sending.
  doneThumb?: string
  batchDone?: number
  // The done line is about one photo the page can show full size: tapping it does.
  doneOpens?: boolean
  // Offer a name for photo credits under the done line, until the phone has given one or skipped.
  nameOffer?: boolean
  // Photos taken but not yet sent: an animal or flower not yet named, a photo not yet added.
  drafts?: Draft[]
  // What a draft's row calls it, when the page knows better than its kind ("Hornbill photo" for
  // one in the full-screen check), so two waiting photos never read the same.
  draftName?: (draft: Draft) => string | null
}>()
const emit = defineEmits<{
  retry: [item: UploadItem]
  discard: [item: UploadItem]
  replace: [item: UploadItem]
  claim: [item: UploadItem]
  viewDone: []
  name: []
  // Open the sheet that holds an unfinished photo.
  finish: [challengeId: string]
}>()

const online = useOnline()
const now = useNow({ scheduler: cb => useIntervalFn(cb, 1000) })
// A photo the phone couldn't read can be swapped for another. Anything else is the server
// saying no (already sent, a limit reached, uploads closed): shown as a calm notice.
const unreadable = (item: UploadItem) => !item.large
const claimable = (item: UploadItem) => !!item.challengeId && item.refusal?.code === 'already-sent' && item.refusal.challengeId === null
// Short notices, without the server's full stop.
const bare = (s: string) => s.replace(/\.$/, '')
// Refusals with the same reason share one notice, so re-picking a batch doesn't stack 20 rows.
// Already-sent refusals name different challenges, so they're grouped by code, not wording.
function refusalText(key: string, items: UploadItem[]) {
  const n = items.length
  if (key === 'sent-by-another-group') return n === 1 ? 'Already sent by another group' : `${n} photos already sent by another group`
  const reason = bare(items[0]!.error ?? 'Upload refused')
  if (n === 1) return reason
  if (key === 'already-sent') return `${n} photos already sent`
  return `${reason} (${n} photos)`
}
const notices = computed<Notice[]>(() => {
  const byReason = new Map<string, UploadItem[]>()
  for (const item of props.failed) {
    if (unreadable(item)) continue
    const key = item.refusal?.code ?? item.error ?? 'Upload refused'
    byReason.set(key, [...(byReason.get(key) ?? []), item])
  }
  return [
    ...props.failed.filter(unreadable).map(item => ({ key: item.id, items: [item], text: 'Couldn\'t open that photo', unreadable: true, claimable: false, fleeting: false })),
    ...[...byReason].map(([key, items]) => ({
      key: items[0]!.id,
      items,
      text: refusalText(key, items),
      unreadable: false,
      claimable: items.length === 1 && claimable(items[0]!),
      // Already in: no button, it goes by itself (fleetingRefusal).
      fleeting: items.every(fleetingRefusal),
    })),
  ]
})
// More than one would stack up over the page, so they fold into one row that opens a sheet
// listing them all.
const listOpen = ref(false)
watch(() => notices.value.length, (n) => {
  if (n <= 1) listOpen.value = false
})
function replace(item: UploadItem) {
  listOpen.value = false
  emit('replace', item)
}

const waitingOnly = computed(() => props.pending.length > 0 && !props.current)
// Waiting with a signal: the last try lost its connection (a weak signal), or the app or storage
// answered no and it's trying again. Only the first is the signal's fault.
const weakSignal = computed(() => props.pending.some(i => i.state === 'waiting' && i.attempts > 0 && !i.troubles))
// Refused again and again with a signal: a problem on the organisers' side, not the signal.
const stuckItems = computed(() => props.pending.filter(i => i.stuck))
const stuck = computed(() => online.value && stuckItems.value.length > 0)
const stuckSaved = computed(() => stuckItems.value.every(i => i.saved))
const total = computed(() => props.pending.length + (props.batchDone ?? 0))
// A short "Swan photo sent" line once the queue is empty, gone after a few seconds, or sooner
// when swiped sideways, like a notification. The name offer under it comes back with the next
// photo until the phone gives a name or skips.
const DONE_MS = 6000
const dismissedAt = ref(0)
const showDone = computed(() => !!props.doneText && props.pending.length === 0 && props.failed.length === 0
  && (props.doneAt ?? 0) > dismissedAt.value && now.value.getTime() - (props.doneAt ?? 0) < DONE_MS)
// The swipe: past 80 px it's gone; less springs back. A mostly vertical move is the page
// scrolling, and a drag never counts as a tap.
const swipeX = ref(0)
let swipe: { x: number, y: number, id: number, moved: boolean } | null = null
let dragged = false
function swipeStart(e: PointerEvent) {
  swipe = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false }
  dragged = false
}
function swipeMove(e: PointerEvent) {
  if (!swipe || e.pointerId !== swipe.id) return
  const dx = e.clientX - swipe.x
  if (!swipe.moved) {
    if (Math.abs(dx) < 8) return
    if (Math.abs(e.clientY - swipe.y) > Math.abs(dx)) {
      swipe = null
      return
    }
    swipe.moved = true
    // Followed even past the line's edge. Only now: from the first touch it would take taps
    // away from the buttons inside.
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
  }
  swipeX.value = dx
}
// Gone mid-swipe (its seconds ran out, an upload started): the next one starts in place.
watch(showDone, (shown) => {
  if (shown) return
  swipe = null
  swipeX.value = 0
})
function swipeEnd(e: PointerEvent) {
  if (!swipe || e.pointerId !== swipe.id) return
  dragged = swipe.moved
  swipe = null
  if (e.type === 'pointerup' && Math.abs(swipeX.value) > 80) dismissedAt.value = props.doneAt ?? Date.now()
  swipeX.value = 0
}
const swipeStyle = computed(() => ({
  transform: swipeX.value ? `translateX(${swipeX.value}px)` : undefined,
  opacity: swipeX.value ? Math.max(0.2, 1 - Math.abs(swipeX.value) / 160) : undefined,
  transition: swipe ? 'none' : 'transform 0.2s, opacity 0.2s',
}))
function openDone() {
  if (dragged) dragged = false
  else if (props.doneOpens) emit('viewDone')
}
function offerName() {
  if (dragged) dragged = false
  else emit('name')
}

type Row = { kind: 'needs' | 'stuck' | 'sending' | 'done' } | { kind: 'draft', draft: Draft }
const rows = computed<Row[]>(() => [
  ...(notices.value.length ? [{ kind: 'needs' as const }] : []),
  ...(stuck.value ? [{ kind: 'stuck' as const }] : props.pending.length ? [{ kind: 'sending' as const }] : []),
  ...(props.drafts ?? []).map(draft => ({ kind: 'draft' as const, draft })),
  ...(showDone.value ? [{ kind: 'done' as const }] : []),
].slice(0, 2))
const plural = (n: number, one: string, many: string) => n === 1 ? one : many
</script>

<template>
  <div v-if="rows.length" class="space-y-3" role="status" aria-live="polite">
    <template v-for="row in rows" :key="row.kind === 'draft' ? row.draft.key : row.kind">
      <template v-if="row.kind === 'needs'">
        <button
          v-if="notices.length > 1" type="button" class="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 text-left active:bg-muted"
          aria-haspopup="dialog" @click="listOpen = true"
        >
          <span class="flex size-10 shrink-0 items-center justify-center" aria-hidden="true"><AlertTriangleIcon class="size-6 text-warning" /></span>
          <span class="flex-1 text-base font-semibold">{{ failed.length }} photos need you</span>
          <ChevronRightIcon class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
        <QuestUploadNotice
          v-else :notice="notices[0]!" :title-for="titleFor"
          @discard="emit('discard', $event)" @replace="replace" @claim="emit('claim', $event)"
        />
      </template>

      <!-- Keeps failing with a signal: no waiting it out, so Retry is right there. -->
      <div v-else-if="row.kind === 'stuck'" class="flex items-center gap-3">
        <span class="flex size-10 shrink-0 items-center justify-center" aria-hidden="true"><AlertTriangleIcon class="size-6 text-warning" /></span>
        <!-- "Saved" folded into the line; the dot stays with the words before it. -->
        <p class="min-w-0 flex-1 text-base font-semibold leading-snug">
          {{ stuckItems.length }} {{ plural(stuckItems.length, 'photo isn\'t', 'photos aren\'t') }} sending<template v-if="stuckSaved">&nbsp;· <span class="font-normal text-muted-foreground">saved</span></template>
        </p>
        <Button variant="outline" class="shrink-0" @click="stuckItems.forEach(i => emit('retry', i))">
          Retry
        </Button>
      </div>

      <div v-else-if="row.kind === 'sending'" class="flex items-center gap-3">
        <span class="relative flex size-10 shrink-0 items-center justify-center" aria-hidden="true">
          <template v-if="current?.previewUrl">
            <img :src="current.previewUrl" alt="" class="size-10 rounded-lg object-cover">
            <span class="absolute inset-0 flex items-center justify-center rounded-lg bg-black/35"><Loader2Icon class="size-5 animate-spin text-white" /></span>
          </template>
          <WifiOffIcon v-else-if="!online" class="size-6 text-warning" />
          <Loader2Icon v-else class="size-6 animate-spin" :class="waitingOnly ? 'text-warning' : 'text-muted-foreground'" />
        </span>
        <p class="min-w-0 flex-1 text-base font-semibold leading-snug">
          <template v-if="!online">
            No signal · {{ pending.length }} waiting
          </template>
          <template v-else-if="waitingOnly">
            {{ weakSignal ? 'Weak signal' : 'Trying again' }} · {{ pending.length }} waiting
          </template>
          <!-- A count that moves, so a long batch never looks stuck. -->
          <template v-else>
            Sending {{ total === 1 ? 'photo' : `${(batchDone ?? 0) + 1} of ${total}` }}
          </template>
        </p>
      </div>

      <!-- A photo taken but not sent yet: its sheet opens on it. -->
      <button
        v-else-if="row.kind === 'draft'" type="button" class="-mx-2 flex min-h-11 w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 text-left active:bg-muted"
        @click="emit('finish', row.draft.challengeId)"
      >
        <img :src="row.draft.url" alt="" class="size-10 shrink-0 rounded-lg object-cover">
        <span class="flex-1 text-base font-semibold">Finish {{ draftName?.(row.draft) ?? (row.draft.kind === 'colour' ? 'flower photo' : row.draft.kind === 'animal' ? 'animal photo' : 'photo') }}</span>
        <ChevronRightIcon class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      <!-- A success stays one short line, with the photo it's about, ticked. For one photo the
           whole line opens it full size. It can be swiped away. -->
      <div
        v-else-if="row.kind === 'done'" class="touch-pan-y select-none" :style="swipeStyle"
        @pointerdown="swipeStart" @pointermove="swipeMove" @pointerup="swipeEnd" @pointercancel="swipeEnd"
      >
        <component
          :is="doneOpens ? 'button' : 'div'" :type="doneOpens ? 'button' : undefined"
          class="flex items-center gap-3" :class="doneOpens && '-mx-2 min-h-11 w-[calc(100%+1rem)] rounded-xl px-2 text-left active:bg-muted'"
          :aria-label="doneOpens ? `${doneText}. Open the photo` : undefined" @click="openDone"
        >
          <span class="relative flex size-10 shrink-0 items-center justify-center" aria-hidden="true">
            <template v-if="doneThumb">
              <img :src="doneThumb" alt="" class="size-10 rounded-lg object-cover">
              <span class="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-success text-success-foreground ring-2 ring-background">
                <CheckIcon class="size-3.5" :stroke-width="3" />
              </span>
            </template>
            <CheckCircle2Icon v-else class="size-6 text-success" />
          </span>
          <span class="min-w-0 flex-1 text-base font-semibold leading-snug">
            {{ doneText }}
          </span>
          <ChevronRightIcon v-if="doneOpens" class="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </component>
        <!-- Lines up with the words above. -->
        <button v-if="nameOffer" type="button" class="-mb-1 ml-13 flex min-h-11 items-center gap-0.5 text-base font-medium text-primary active:opacity-70" @click="offerName">
          Add your name for photo credits <ChevronRightIcon class="size-5 shrink-0" aria-hidden="true" />
        </button>
      </div>
    </template>
  </div>

  <BottomSheet v-model:open="listOpen" title="Photos that need you" content-class="max-h-[88dvh]">
    <div class="-mx-4 min-h-0 divide-y overflow-y-auto px-4 pb-1">
      <QuestUploadNotice
        v-for="n in notices" :key="n.key" :notice="n" :title-for="titleFor" class="py-3"
        @discard="emit('discard', $event)" @replace="replace" @claim="emit('claim', $event)"
      />
    </div>
  </BottomSheet>
</template>
