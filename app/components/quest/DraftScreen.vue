<script setup lang="ts">
import { computed } from 'vue'
import { SlidersHorizontalIcon, XIcon } from '@lucide/vue'
import { FULL_SCREEN_DIALOG } from '~/utils/fullScreen'

// A photo not sent yet (a draft on the phone, useDrafts), full screen: the X top left, "Edit"
// (crop and rotate, PhotoCrop; the sliders icon after it, as Google Photos has) opposite, the
// photo whole on its canvas, then the caller's buttons, if any.
// The check after a challenge's camera (QuestShotReview) puts what it's for, Send and "Take
// another instead" under it; a race photo's full-size look, opened from its thumbnail while it's
// named, has none. The buttons sit on the page's 16 px gutter. Between them a light grey canvas
// runs edge to edge, so it's clear what's photo and what isn't; the photo sits on it 32 px in from
// the sides and 16 px from the top and bottom, as in the editor.
// The X and Escape both emit `close`: the caller decides whether that asks first. Back is the
// caller's too (usePhotoDiscard or useBackClose). Focus starts on the element marked
// `data-autofocus`, else the X.
const props = defineProps<{
  token: string
  draftKey: string
  // For screen readers: what the photo is for, and what the X does.
  title: string
  closeLabel: string
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ close: [] }>()

const drafts = useDrafts(() => props.token)
const draft = computed(() => drafts.get(props.draftKey))
const { cropping, cropSrc, openCrop, cropTo } = useDraftCrop(() => props.token, props.draftKey)

function focusFirst(e: Event) {
  const el = e.target as HTMLElement | null
  const first = el?.querySelector<HTMLElement>('[data-autofocus]')
  if (!first) return
  e.preventDefault()
  first.focus()
}
</script>

<template>
  <Dialog :open="open && !!draft" @update:open="v => { if (!v) emit('close') }">
    <DialogContent :class="FULL_SCREEN_DIALOG" :show-close-button="false" @open-auto-focus="focusFirst">
      <DialogTitle class="sr-only">
        {{ title }}
      </DialogTitle>
      <DialogDescription class="sr-only">
        A photo not sent yet.
      </DialogDescription>
      <!-- The X's strokes on the gutter's left edge, the sliders icon's on its right edge. -->
      <div class="mx-auto flex w-full max-w-lg shrink-0 items-center justify-between px-4 pt-[env(safe-area-inset-top)]">
        <Button variant="ghost" size="icon" class="-ml-[15px]" :aria-label="closeLabel" @click="emit('close')">
          <XIcon class="size-6" />
        </Button>
        <Button variant="ghost" class="-mr-3 gap-2 px-3" @click="openCrop">
          Edit <SlidersHorizontalIcon />
        </Button>
      </div>
      <!-- The photo whole, at its own shape, on the canvas. -->
      <div class="relative min-h-0 flex-1 bg-muted">
        <div class="absolute inset-0 mx-auto flex max-w-lg items-center justify-center px-8 py-4">
          <img v-if="draft" :src="draft.url" alt="The photo to send" draggable="false" class="max-h-full max-w-full select-none object-contain">
        </div>
      </div>
      <div v-if="$slots.default" class="mx-auto w-full max-w-lg shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <slot />
      </div>
      <!-- No buttons: the canvas runs to the bottom. -->
      <div v-else class="h-[max(1rem,env(safe-area-inset-bottom))] shrink-0 bg-muted" aria-hidden="true" />
    </DialogContent>
  </Dialog>
  <PhotoCrop v-if="draft" v-model:open="cropping" :src="cropSrc" :frame="draft.frame ?? null" :turns="draft.turns ?? 0" :crop="cropTo" />
</template>
