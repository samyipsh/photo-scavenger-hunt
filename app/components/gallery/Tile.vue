<script setup lang="ts">
import type { GalleryPhoto } from '~/types/api'
import { computed, onBeforeUnmount, ref } from 'vue'
import { BanIcon, CheckIcon, HeartIcon, Maximize2Icon, RotateCwIcon } from '@lucide/vue'

// One photo in the gallery grid. The photo and its caption open it; the heart in the photo's
// corner likes it without opening. A photo a judge said doesn't count carries a "no" sign; the
// photo view says why. `caption` names it in up to three lines, with the `trailing` slot (the
// points pill) at the end of its first line, and the default slot holds a line under it
// ("Doesn't count"). With `words` that line says it, so the corner sign isn't repeated.
// `subject` says which photo a heart is for ("Swan from Group 3"). While `picking` (choosing
// photos to save), a tap picks or drops the photo instead of opening it, a round tick replaces
// the sign, and an expand icon in the heart's corner opens it (`expand`).
// Holding a photo for half a second (`hold`) picks it, and starts picking in the gallery; it
// replaces the phone's own menu for the image. `noLike` drops the heart (the committee's Hidden
// photos page, whose photos aren't in the gallery).
const props = defineProps<{ photo: GalleryPhoto, name: string, subject?: string, caption?: string, words?: boolean, picking?: boolean, picked?: boolean, noLike?: boolean }>()
const emit = defineEmits<{ open: [], like: [], hold: [], expand: [] }>()
const ariaNote = computed(() => props.photo.rejectReason ? ', doesn\'t count' : '')
const likeLabel = computed(() => {
  const n = props.photo.likes
  return `${props.photo.liked ? 'Unlike' : 'Like'} ${props.subject ?? props.name}${n ? `, ${n} ${n === 1 ? 'like' : 'likes'}` : ''}`
})

// A thumbnail that didn't load says so, and a tap tries it again instead of opening it (while
// picking, a tap still ticks it).
const broken = ref(false)
const attempt = ref(0)
// A hold is half a second down without moving; scrolling cancels it. The tap that ends a hold
// doesn't also open or pick.
let holdTimer: ReturnType<typeof setTimeout> | undefined
let start: { x: number, y: number } | null = null
let held = false
function down(e: PointerEvent) {
  held = false
  // Only the first finger or the main mouse button.
  if (!e.isPrimary || e.button !== 0) return
  start = { x: e.clientX, y: e.clientY }
  clearTimeout(holdTimer)
  holdTimer = setTimeout(() => {
    held = true
    start = null
    emit('hold')
  }, 500)
}
function moved(e: PointerEvent) {
  if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) endHold()
}
function endHold() {
  clearTimeout(holdTimer)
  start = null
}
// The click that ends a hold comes straight after the finger lifts, if at all (iPhone sends
// none), so the hold is forgotten just after: a later keyboard press still works.
function lifted() {
  endHold()
  if (held) setTimeout(() => { held = false }, 400)
}
onBeforeUnmount(endHold)
function onTap() {
  if (held) {
    held = false
    return
  }
  if (!broken.value || props.picking) return emit('open')
  broken.value = false
  attempt.value++
}
</script>

<template>
  <li class="min-w-0">
    <div class="relative">
      <button
        type="button" class="block w-full select-none text-left [-webkit-touch-callout:none]" :aria-label="broken && !picking ? `${name}, didn't load. Retry` : `${name}${ariaNote}`"
        :aria-pressed="picking ? picked : undefined" @click="onTap" @pointerdown="down" @pointermove="moved"
        @pointerup="lifted" @pointercancel="endHold" @pointerleave="endHold" @contextmenu.prevent
      >
        <img
          v-if="!broken" :key="attempt" :src="photo.thumbUrl" alt="" loading="lazy" decoding="async" draggable="false" class="aspect-square w-full rounded-md bg-muted object-cover [-webkit-user-drag:none]"
          :class="picked && 'opacity-80'"
          @error="broken = true"
        >
        <span v-else class="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-md bg-muted pb-6 text-base font-medium text-muted-foreground">
          <RotateCwIcon class="size-5" aria-hidden="true" />
          Retry
        </span>
        <span v-if="caption || $slots.default" class="block" :class="$slots.trailing ? 'mt-1.5' : 'mt-1'">
          <span v-if="caption" class="flex items-start gap-1.5">
            <span class="line-clamp-3 min-w-0 flex-1 text-base leading-snug">{{ caption }}</span>
            <!-- The pill is taller than the line: it hangs over it evenly instead of pushing it. -->
            <span v-if="$slots.trailing" class="-my-[3px] flex shrink-0"><slot name="trailing" /></span>
          </span>
          <slot />
        </span>
      </button>
      <!-- Over the photo's square: the marks, and the heart in the thumb-sized corner. -->
      <div class="pointer-events-none absolute inset-x-0 top-0 aspect-square">
        <div v-if="picked" class="absolute inset-0 rounded-md ring-3 ring-inset ring-primary" aria-hidden="true" />
        <span v-if="picking" class="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full border-2 border-white" :class="picked ? 'bg-primary' : 'bg-black/30'" aria-hidden="true">
          <CheckIcon v-if="picked" class="size-4 text-white" :stroke-width="3" />
        </span>
        <span v-if="!picking && photo.rejectReason && !words" class="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-black/60 text-white" aria-hidden="true">
          <BanIcon class="size-5" />
        </span>
        <!-- Bare, with a dark halo so it shows on any photo, until this phone likes it: then a
             filled heart on a dark pill. Others' likes only add the count. -->
        <button
          v-if="picking" type="button" class="pointer-events-auto absolute bottom-0 left-0 flex size-11 items-end p-1"
          :aria-label="`Open ${subject ?? name}`" @click="emit('expand')"
        >
          <span class="flex size-7 items-center justify-center rounded-full bg-black/55 text-white">
            <Maximize2Icon class="size-4" :stroke-width="2.5" />
          </span>
        </button>
        <button
          v-else-if="!noLike" type="button" class="pointer-events-auto absolute bottom-0 left-0 flex h-11 min-w-11 items-end p-1"
          :aria-pressed="photo.liked" :aria-label="likeLabel"
          @click="emit('like')"
        >
          <span
            class="flex h-7 items-center gap-1 rounded-full px-1.5 text-base font-semibold tabular-nums text-white"
            :class="photo.liked ? 'bg-black/55' : '[filter:drop-shadow(0_0_3px_rgb(0_0_0/0.55))_drop-shadow(0_1px_2px_rgb(0_0_0/0.75))]'"
          >
            <HeartIcon class="size-5" :class="photo.liked && 'fill-rose-500 text-rose-500'" />
            <span v-if="photo.likes">{{ photo.likes }}</span>
          </span>
        </button>
      </div>
    </div>
  </li>
</template>
