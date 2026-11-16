<script setup lang="ts">
import { computed } from 'vue'
import { AlertTriangleIcon, ImageUpIcon, Trash2Icon } from '@lucide/vue'
import type { UploadItem } from '~/composables/useUploadQueue'

// One thing in the upload strip that needs someone: a photo the phone couldn't read, or photos
// the app refused for the same reason (already sent, a limit reached, uploads closed). Laid out
// like every row of the strip: the photo or a sign, the words, then its one button on the right.
// A choice between two buttons puts them in a row under the words; a notice that needs nothing
// (`fleeting`: the photo's already in) has no button and goes by itself.
export interface Notice {
  key: string
  items: UploadItem[]
  text: string
  unreadable: boolean
  // A photo already sent as "just a photo", now picked for a challenge: it can be used for that.
  claimable: boolean
  fleeting: boolean
}

const props = defineProps<{ notice: Notice, titleFor: (item: UploadItem) => string }>()
defineEmits<{ discard: [item: UploadItem], replace: [item: UploadItem], claim: [item: UploadItem] }>()
const choice = computed(() => props.notice.unreadable || props.notice.claimable)
</script>

<template>
  <div class="flex gap-3" :class="choice ? 'items-start' : 'items-center'">
    <span class="flex size-10 shrink-0 items-center justify-center" aria-hidden="true">
      <AlertTriangleIcon v-if="notice.unreadable" class="size-6 text-destructive" />
      <img v-else-if="notice.items[0]!.previewUrl" :src="notice.items[0]!.previewUrl" alt="" class="size-10 rounded-lg object-cover">
      <AlertTriangleIcon v-else class="size-6 text-warning" />
    </span>
    <div class="min-w-0 flex-1">
      <div class="flex min-h-10 flex-col justify-center">
        <p class="text-base font-semibold leading-snug">
          {{ notice.text }}
        </p>
        <!-- Which challenge it was for; nothing for just a photo. -->
        <p v-if="notice.unreadable && notice.items[0]!.challengeId" class="text-base text-muted-foreground">
          {{ titleFor(notice.items[0]!) }}
        </p>
      </div>
      <div v-if="choice" class="mt-2 flex flex-wrap gap-2">
        <template v-if="notice.unreadable">
          <Button variant="outline" @click="$emit('replace', notice.items[0]!)">
            <ImageUpIcon /> Pick another
          </Button>
          <Button variant="ghost" @click="$emit('discard', notice.items[0]!)">
            <Trash2Icon /> Discard
          </Button>
        </template>
        <template v-else>
          <!-- A long challenge name wraps rather than running off the screen. -->
          <Button class="h-auto min-h-11 max-w-full whitespace-normal py-2 text-left" @click="$emit('claim', notice.items[0]!)">
            Use for {{ titleFor(notice.items[0]!) }}
          </Button>
          <Button variant="outline" @click="$emit('discard', notice.items[0]!)">
            Not now
          </Button>
        </template>
      </div>
    </div>
    <Button v-if="!choice && !notice.fleeting" variant="outline" class="shrink-0" @click="notice.items.forEach(i => $emit('discard', i))">
      OK
    </Button>
  </div>
</template>
